'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { validTimeZone, zonedWallTimeToInstant } from '@/features/platform/lib/datetime'
import { decimalToMinorUnits } from '@/features/platform/lib/money'

export type DeskCreateState = { ok: boolean; message: string; href?: string }

const deadlineTypes = ['court', 'statutory', 'contractual', 'internal', 'limitation', 'other']
const priorities = ['low', 'normal', 'high', 'urgent']
const documentCategories = ['pleading', 'correspondence', 'evidence', 'contract', 'research', 'billing', 'internal', 'other']
const confidentialities = ['matter', 'restricted', 'client_shareable']
const channels = ['email', 'sms', 'phone', 'portal', 'internal', 'other']
const expenseTypes = ['filing_fee', 'travel', 'expert', 'copying', 'service', 'other']

function text(formData: FormData, key: string, { min = 1, max = 500, label = key }: { min?: number; max?: number; label?: string } = {}) {
  const value = String(formData.get(key) ?? '').trim()
  if (value.length < min || value.length > max) throw new Error(`${label} must be ${min}–${max} characters.`)
  return value
}

function choice(formData: FormData, key: string, allowed: string[], label: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!allowed.includes(value)) throw new Error(`Choose a ${label}.`)
  return value
}

// Wall-clock form input is read in the stated zone (the record's or the firm's), never in
// the server's own zone.
function instant(formData: FormData, key: string, label: string) {
  const zone = validTimeZone(formData.get('timezone')) ?? 'UTC'
  const raw = String(formData.get(key) ?? '').trim()
  // A date-only value is anchored at midday so the calendar date never shifts by zone.
  const date = zonedWallTimeToInstant(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00` : raw, zone)
  if (!date) throw new Error(`${label} is required.`)
  return date.toISOString()
}

// Creates the first ordinary record for a desk through the generated, access-controlled
// create of that list: the viewer's manage permission, matter scope, ethical walls and the
// list's lifecycle hooks all apply, and every record starts in its draft/open state.
// Protected lifecycle (approval, issue, filing, sending) still happens through the
// dedicated transition commands afterwards.
export async function createDeskRecord(_previous: DeskCreateState, formData: FormData): Promise<DeskCreateState> {
  try {
    const kind = String(formData.get('kind') ?? '')
    if (kind === 'reply') return await createReplyDraft(formData)
    const matterId = text(formData, 'matterId', { max: 200, label: 'Matter' })
    const matter = { connect: { id: matterId } }

    if (kind === 'task') {
      const response = await keystoneClient<{ createLegalTask: { id: string } | null }>(`mutation CreateDeskTask($data: LegalTaskCreateInput!) { createLegalTask(data: $data) { id } }`, {
        data: { matter, title: text(formData, 'title', { max: 300, label: 'Title' }), priority: choice(formData, 'priority', priorities, 'priority'), ...(formData.get('dueAt') ? { dueAt: instant(formData, 'dueAt', 'Due time') } : {}), ...(String(formData.get('assignedToId') ?? '').trim() ? { assignedTo: { connect: { id: String(formData.get('assignedToId')).trim().slice(0, 200) } } } : {}) },
      })
      if (!response.success || !response.data.createLegalTask) throw new Error(response.success ? 'The task was not created.' : response.error)
      revalidatePath('/dashboard/platform/work')
      return { ok: true, message: 'Task created.', href: `/dashboard/platform/work/task/${encodeURIComponent(response.data.createLegalTask.id)}` }
    }

    if (kind === 'deadline') {
      const timezone = validTimeZone(formData.get('timezone'))
      if (!timezone) throw new Error('Choose a valid time zone.')
      const response = await keystoneClient<{ createDeadline: { id: string } | null }>(`mutation CreateDeskDeadline($data: DeadlineCreateInput!) { createDeadline(data: $data) { id } }`, {
        data: { matter, title: text(formData, 'title', { max: 300, label: 'Title' }), deadlineType: choice(formData, 'deadlineType', deadlineTypes, 'deadline type'), source: 'manual', dueAt: instant(formData, 'dueAt', 'Due time'), timezone },
      })
      if (!response.success || !response.data.createDeadline) throw new Error(response.success ? 'The deadline was not created.' : response.error)
      revalidatePath('/dashboard/platform/work')
      return { ok: true, message: 'Draft deadline created. It still needs human verification.', href: `/dashboard/platform/work/deadline/${encodeURIComponent(response.data.createDeadline.id)}` }
    }

    if (kind === 'document') {
      const response = await keystoneClient<{ createDocument: { id: string } | null }>(`mutation CreateDeskDocument($data: DocumentCreateInput!) { createDocument(data: $data) { id } }`, {
        data: { matter, title: text(formData, 'title', { max: 300, label: 'Title' }), category: choice(formData, 'category', documentCategories, 'category'), confidentiality: choice(formData, 'confidentiality', confidentialities, 'confidentiality') },
      })
      if (!response.success || !response.data.createDocument) throw new Error(response.success ? 'The document was not created.' : response.error)
      revalidatePath('/dashboard/platform/documents')
      return { ok: true, message: 'Draft document record created. Attach versions through the document workflow.', href: `/dashboard/platform/documents/document/${encodeURIComponent(response.data.createDocument.id)}` }
    }

    if (kind === 'message') {
      const channel = choice(formData, 'channel', channels, 'channel')
      const subject = text(formData, 'subject', { max: 300, label: 'Subject' })
      const body = text(formData, 'body', { max: 20_000, label: 'Message' })
      const thread = await keystoneClient<{ createCommunicationThread: { id: string } | null }>(`mutation CreateDeskThread($data: CommunicationThreadCreateInput!) { createCommunicationThread(data: $data) { id } }`, {
        data: { matter, subject, primaryChannel: channel },
      })
      if (!thread.success || !thread.data.createCommunicationThread) throw new Error(thread.success ? 'The conversation was not created.' : thread.error)
      const threadId = thread.data.createCommunicationThread.id
      const message = await keystoneClient<{ createCommunicationMessage: { id: string } | null }>(`mutation CreateDeskMessage($data: CommunicationMessageCreateInput!) { createCommunicationMessage(data: $data) { id } }`, {
        data: { matter, thread: { connect: { id: threadId } }, direction: 'outbound', channel, subject, body },
      })
      revalidatePath('/dashboard/platform/communications')
      if (!message.success || !message.data.createCommunicationMessage) {
        return { ok: false, message: `The conversation was created, but its draft message was not: ${message.success ? 'no record returned' : message.error}`, href: `/dashboard/platform/communications/thread/${encodeURIComponent(threadId)}` }
      }
      return { ok: true, message: 'Draft message created. Add recipients and queue it through the controlled delivery workflow.', href: `/dashboard/platform/communications/message/${encodeURIComponent(message.data.createCommunicationMessage.id)}` }
    }

    if (kind === 'time') {
      const hours = Number(String(formData.get('hours') ?? '').trim() || '0')
      const minutes = Number(String(formData.get('minutes') ?? '').trim() || '0')
      if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) throw new Error('Enter the time spent.')
      const durationMinutes = Math.round(hours * 60 + minutes)
      if (durationMinutes < 1 || durationMinutes > 24 * 60) throw new Error('Time spent must be between 1 minute and 24 hours.')
      const viewer = await keystoneClient<{ authenticatedItem: { id: string } | null }>('query TimeViewer { authenticatedItem { ... on User { id } } }')
      if (!viewer.success || !viewer.data.authenticatedItem?.id) throw new Error('Sign in again to record time.')
      const response = await keystoneClient<{ createTimeEntry: { id: string } | null }>(`mutation CreateDeskTime($data: TimeEntryCreateInput!) { createTimeEntry(data: $data) { id } }`, {
        data: {
          matter,
          user: { connect: { id: viewer.data.authenticatedItem.id } },
          workDate: instant(formData, 'workDate', 'Date worked'),
          durationMinutes,
          description: text(formData, 'description', { min: 3, max: 2000, label: 'Work description' }),
          isBillable: formData.get('isBillable') === 'on',
        },
      })
      if (!response.success || !response.data.createTimeEntry) throw new Error(response.success ? 'The time entry was not created.' : 'The time entry was not created. Billing permission on this matter is required.')
      revalidatePath('/dashboard/platform/time-expenses')
      return { ok: true, message: `Draft time entry created (${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'}).`, href: `/dashboard/platform/time-expenses/time-entry/${encodeURIComponent(response.data.createTimeEntry.id)}` }
    }

    if (kind === 'party') {
      const contactId = text(formData, 'contactId', { max: 200, label: 'Contact' })
      const partyRole = text(formData, 'partyRole', { max: 60, label: 'Role' })
      const side = String(formData.get('side') ?? '').trim() || 'unknown'
      const response = await keystoneClient<{ addMatterParty: { id: string } }>(`mutation AddDeskParty($matterId: ID!, $contactId: ID!, $partyRole: String!, $side: String, $notes: String) { addMatterParty(matterId: $matterId, contactId: $contactId, partyRole: $partyRole, side: $side, notes: $notes) { id } }`, {
        matterId, contactId, partyRole, side, notes: String(formData.get('notes') ?? '').trim().slice(0, 2000) || null,
      })
      if (!response.success) throw new Error('The party was not added. The contact may already have that role, or matter edit access is required.')
      revalidatePath(`/dashboard/platform/matters/${matterId}`)
      return { ok: true, message: 'Party added. A conflict re-review was requested for this party.' }
    }

    if (kind === 'expense') {
      const currencyCode = text(formData, 'currencyCode', { min: 3, max: 3, label: 'Currency' }).toUpperCase()
      const response = await keystoneClient<{ createExpense: { id: string } | null }>(`mutation CreateDeskExpense($data: ExpenseCreateInput!) { createExpense(data: $data) { id } }`, {
        data: {
          matter,
          description: text(formData, 'description', { min: 3, max: 2000, label: 'Description' }),
          expenseType: choice(formData, 'expenseType', expenseTypes, 'expense type'),
          incurredAt: instant(formData, 'incurredAt', 'Date incurred'),
          amountMinor: decimalToMinorUnits(String(formData.get('amount') ?? ''), currencyCode),
          currencyCode,
          isBillable: formData.get('isBillable') === 'on',
        },
      })
      if (!response.success || !response.data.createExpense) throw new Error(response.success ? 'The expense was not created.' : response.error)
      revalidatePath('/dashboard/platform/time-expenses')
      return { ok: true, message: 'Draft expense created for review.', href: `/dashboard/platform/time-expenses/expense/${encodeURIComponent(response.data.createExpense.id)}` }
    }

    throw new Error('Unsupported record type.')
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The record could not be created.' }
  }
}

// A reply draft joins an existing conversation the viewer can read; its matter and
// channel come from that thread, never from the form.
async function createReplyDraft(formData: FormData): Promise<DeskCreateState> {
  const threadId = text(formData, 'threadId', { max: 200, label: 'Conversation' })
  const thread = await keystoneClient<{ communicationThread: { id: string; subject: string | null; primaryChannel: string | null; matter: { id: string } | null } | null }>(`query ReplyThread($id: ID!) { communicationThread(where: { id: $id }) { id subject primaryChannel matter { id } } }`, { id: threadId })
  if (!thread.success) throw new Error(thread.error)
  const current = thread.data.communicationThread
  if (!current) throw new Error('This conversation is unavailable.')
  const channel = channels.includes(current.primaryChannel ?? '') ? current.primaryChannel : 'other'
  const response = await keystoneClient<{ createCommunicationMessage: { id: string } | null }>(`mutation CreateReplyDraft($data: CommunicationMessageCreateInput!) { createCommunicationMessage(data: $data) { id } }`, {
    data: {
      ...(current.matter ? { matter: { connect: { id: current.matter.id } } } : {}),
      thread: { connect: { id: current.id } },
      direction: 'outbound',
      channel,
      subject: text(formData, 'subject', { max: 300, label: 'Subject' }),
      body: text(formData, 'body', { max: 20_000, label: 'Message' }),
    },
  })
  if (!response.success || !response.data.createCommunicationMessage) throw new Error(response.success ? 'The draft was not created.' : response.error)
  revalidatePath('/dashboard/platform/communications')
  return { ok: true, message: 'Reply draft created. Add recipients and queue it through the controlled delivery workflow.', href: `/dashboard/platform/communications/message/${encodeURIComponent(response.data.createCommunicationMessage.id)}` }
}
