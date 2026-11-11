'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { ContactEmailMethod, ParticipantRow, RecipientActionState, ThreadRecipientSetup } from './recipientTypes'

const PARTICIPANT_FIELDS = 'id participantRole status displayAddress addedAt user { name } contact { displayName } portalAccount { email }'
const CONTACT_ROLES = new Set(['client', 'external_counsel', 'third_party'])

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

async function loadThread(threadId: string) {
  const response = await keystoneClient<{ communicationThread: { status: string | null; participants: ParticipantRow[] } | null }>(`
    query ThreadRecipients($id: ID!) { communicationThread(where: { id: $id }) { status participants(orderBy: [{ addedAt: desc }, { id: asc }], take: 100) { ${PARTICIPANT_FIELDS} } } }
  `, { id: threadId })
  return response.success ? response.data.communicationThread : null
}

export async function getThreadRecipients(threadId: string): Promise<ThreadRecipientSetup | null> {
  const thread = await loadThread(threadId)
  return thread ? { threadStatus: thread.status, participants: thread.participants ?? [] } : null
}

/** Contactable email methods for the contact picker; the command accepts only these. */
export async function getContactEmailMethods(contactId: string): Promise<ContactEmailMethod[]> {
  const id = String(contactId ?? '').trim()
  if (!id) return []
  const response = await keystoneClient<{ contactMethods: ContactEmailMethod[] }>(`
    query ContactEmailMethods($id: ID!) { contactMethods(where: { contact: { id: { equals: $id } }, methodType: { equals: email }, canContact: { equals: true } }, orderBy: [{ isPrimary: desc }, { id: asc }], take: 25) { id label value isPrimary } }
  `, { id })
  return response.success ? response.data.contactMethods ?? [] : []
}

function refreshThread(threadId: string) {
  revalidatePath(`/dashboard/platform/communications/thread/${threadId}`)
  revalidatePath('/dashboard/platform/communications')
}

export async function addParticipantAction(previous: RecipientActionState, formData: FormData): Promise<RecipientActionState> {
  const revision = previous.revision + 1
  const threadId = text(formData, 'threadId')
  const type = text(formData, 'type')
  const userId = type === 'staff' ? text(formData, 'userId') : ''
  const contactId = type === 'contact' ? text(formData, 'contactId') : ''
  const portalAccountId = type === 'portal' ? text(formData, 'portalAccountId') : ''
  const contactMethodId = type === 'contact' ? text(formData, 'contactMethodId') : ''
  const participantRole = type === 'staff' ? 'staff' : type === 'portal' ? 'client' : text(formData, 'participantRole')
  if (!threadId) return { ok: false, message: 'Thread is missing.', revision }
  if (type === 'staff' && !userId) return { ok: false, message: 'Choose a staff member.', revision }
  if (type === 'contact' && !contactId) return { ok: false, message: 'Choose a contact.', revision }
  if (type === 'portal' && !portalAccountId) return { ok: false, message: 'Choose a portal account.', revision }
  if (!['staff', 'contact', 'portal'].includes(type)) return { ok: false, message: 'Choose who to add.', revision }
  if (type === 'contact' && !CONTACT_ROLES.has(participantRole)) return { ok: false, message: 'Choose a role.', revision }
  const thread = await loadThread(threadId)
  if (!thread) return { ok: false, message: 'This thread is unavailable.', revision }
  if (thread.status !== 'open') return { ok: false, message: 'Recipients can be added only to open threads.', revision }
  if (type === 'contact') {
    const methods = await getContactEmailMethods(contactId)
    if (!methods.length) return { ok: false, message: 'This contact has no contactable email address.', revision }
    if (contactMethodId && !methods.some((method) => method.id === contactMethodId)) return { ok: false, message: 'Choose one of this contact’s email addresses.', revision }
    if (!contactMethodId) {
      const contact = await keystoneClient<{ contact: { primaryEmail: string | null } | null }>(`query ParticipantContact($id: ID!) { contact(where: { id: $id }) { primaryEmail } }`, { id: contactId })
      const primary = contact.success ? contact.data.contact?.primaryEmail ?? '' : ''
      if (!methods.some((method) => method.value === primary)) return { ok: false, message: 'Choose an email address for this contact.', revision }
    }
  }
  const result = await keystoneClient<{ addCommunicationParticipant: { replayed: boolean } }>(`
    mutation AddParticipant($threadId: ID!, $participantRole: CommunicationParticipantRole!, $userId: ID, $contactId: ID, $portalAccountId: ID, $contactMethodId: ID) {
      addCommunicationParticipant(threadId: $threadId, participantRole: $participantRole, userId: $userId, contactId: $contactId, portalAccountId: $portalAccountId, contactMethodId: $contactMethodId) { replayed }
    }
  `, { threadId, participantRole, userId: userId || null, contactId: contactId || null, portalAccountId: portalAccountId || null, contactMethodId: contactMethodId || null })
  if (!result.success) {
    const hint = type === 'staff'
      ? 'The staff member must be active, able to read communications and allowed on this matter.'
      : type === 'portal'
        ? 'The portal account must be active and have a current message-capable share of this thread.'
        : 'The contact may already be on this thread with another role.'
    return { ok: false, message: `The recipient was not added. ${hint}`, revision }
  }
  refreshThread(threadId)
  return { ok: true, message: result.data.addCommunicationParticipant.replayed ? 'Already a recipient.' : 'Recipient added.', revision }
}

export async function removeParticipantAction(previous: RecipientActionState, formData: FormData): Promise<RecipientActionState> {
  const revision = previous.revision + 1
  const threadId = text(formData, 'threadId')
  const participantId = text(formData, 'participantId')
  const reason = text(formData, 'reason')
  if (!threadId || !participantId) return { ok: false, message: 'Recipient is missing.', revision }
  if (reason.length < 5 || reason.length > 2000) return { ok: false, message: 'Enter a reason between 5 and 2,000 characters.', revision }
  const result = await keystoneClient<{ removeCommunicationParticipant: { replayed: boolean } }>(`
    mutation RemoveParticipant($participantId: ID!, $reason: String!) { removeCommunicationParticipant(participantId: $participantId, reason: $reason) { replayed } }
  `, { participantId, reason })
  if (!result.success) return { ok: false, message: 'The recipient was not removed. Communication management permission and access to the matter are required.', revision }
  refreshThread(threadId)
  return { ok: true, message: 'Recipient removed.', revision }
}
