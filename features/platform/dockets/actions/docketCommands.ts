'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { commandResult, formChoice, formText, type CommandState } from '@/features/platform/components/commandState'
import { validTimeZone, zonedWallTimeToInstant } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

import { COURT_TYPES, DEADLINE_TYPES, DOCKET_TRANSITIONS, ENTRY_OUTCOMES, ENTRY_TYPES } from '../lib/docketTypes'

const courtTypes = COURT_TYPES.map(([value]) => value)
const entryTypes = ENTRY_TYPES.map(([value]) => value)
const deadlineTypes = DEADLINE_TYPES.map(([value]) => value)
const DOCKETS = '/dashboard/platform/dockets'
const docketPath = (docketId: string) => `${DOCKETS}/${encodeURIComponent(docketId)}`

function httpsUrl(formData: FormData, key: string, label: string) {
  const value = formText(formData, key, { label, max: 2000 })
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error()
  } catch {
    throw new Error(`${label} must be a valid https address.`)
  }
  return value
}

// Wall-clock input is read in the firm's zone, never in the server's own zone.
async function wallInstant(formData: FormData, key: string, label: string, required: boolean) {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) {
    if (required) throw new Error(`${label} is required.`)
    return null
  }
  const zone = validTimeZone(formData.get('timezone')) ?? await getFirmTimeZone()
  const date = zonedWallTimeToInstant(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00` : raw, zone)
  if (!date) throw new Error(`${label} is not a valid time in ${zone}.`)
  return date.toISOString()
}

/** Creates a court, or saves changes to one. */
export async function saveCourt(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const id = formText(formData, 'id', { max: 200 })
    const data = {
      name: formText(formData, 'name', { label: 'Name', min: 2, max: 200 }),
      courtType: formChoice(formData, 'courtType', courtTypes, 'court type'),
      jurisdiction: formText(formData, 'jurisdiction', { label: 'Jurisdiction', min: 2, max: 200 }),
      division: formText(formData, 'division', { label: 'Division', max: 200 }),
      phone: formText(formData, 'phone', { label: 'Phone', max: 60 }),
      website: httpsUrl(formData, 'website', 'Website'),
      filingUrl: httpsUrl(formData, 'filingUrl', 'Filing address'),
      status: formChoice(formData, 'status', ['active', 'inactive'] as const, 'status'),
    }
    const response = id
      ? await keystoneClient<{ updateCourt: { id: string } | null }>('mutation SaveCourt($id: ID!, $data: CourtUpdateInput!) { updateCourt(where: { id: $id }, data: $data) { id } }', { id, data })
      : await keystoneClient<{ createCourt: { id: string } | null }>('mutation CreateCourt($data: CourtCreateInput!) { createCourt(data: $data) { id } }', { data })
    if (!response.success) throw new Error('The court was not saved. Calendar management permission is required.')
    revalidatePath(DOCKETS)
    return commandResult(previous, true, id ? 'Court saved.' : 'Court added.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The court was not saved.')
  }
}

/** Opens a docket on a matter in a court. */
export async function createDocket(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const matterId = formText(formData, 'matterId', { label: 'Matter', min: 1, max: 200 })
    const courtId = formText(formData, 'courtId', { label: 'Court', min: 1, max: 200 })
    const docketNumber = formText(formData, 'docketNumber', { label: 'Docket number', min: 1, max: 120 })
    const title = formText(formData, 'title', { label: 'Title', min: 2, max: 300 })
    const filedAt = await wallInstant(formData, 'filedAt', 'Filed date', false)
    const check = await keystoneClient<{ matter: { id: string; status: string } | null; court: { id: string; status: string | null } | null; docketsCount: number }>(`
      query DocketCreateCheck($matterId: ID!, $courtId: ID!, $where: DocketWhereInput!) {
        matter(where: { id: $matterId }) { id status }
        court(where: { id: $courtId }) { id status }
        docketsCount(where: $where)
      }
    `, { matterId, courtId, where: { matter: { id: { equals: matterId } }, docketNumber: { equals: docketNumber } } })
    if (!check.success) throw new Error('The matter or court could not be checked. Calendar access is required.')
    if (!check.data.matter) throw new Error('This matter is unavailable in your current access.')
    if (!check.data.court) throw new Error('Choose a court.')
    if (check.data.court.status === 'inactive') throw new Error('This court is inactive.')
    if (check.data.docketsCount > 0) throw new Error('This matter already has a docket with that number.')
    const response = await keystoneClient<{ createDocket: { id: string } | null }>('mutation CreateDocket($data: DocketCreateInput!) { createDocket(data: $data) { id } }', {
      data: { matter: { connect: { id: matterId } }, court: { connect: { id: courtId } }, docketNumber, title, ...(filedAt ? { filedAt } : {}) },
    })
    if (!response.success || !response.data.createDocket) throw new Error('The docket was not created. Calendar management permission and matter access are required.')
    revalidatePath(DOCKETS)
    revalidatePath(`/dashboard/platform/matters/${encodeURIComponent(matterId)}`)
    return commandResult(previous, true, 'Docket created.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The docket was not created.')
  }
}

/** Moves a docket through active / stayed / appealed / closed. */
export async function changeDocketStatus(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const docketId = formText(formData, 'docketId', { label: 'Docket', min: 1, max: 200 })
    const toStatus = formChoice(formData, 'toStatus', ['active', 'stayed', 'appealed', 'closed'] as const, 'status')
    const current = await keystoneClient<{ docket: { id: string; status: string } | null }>('query DocketStatus($id: ID!) { docket(where: { id: $id }) { id status } }', { id: docketId })
    if (!current.success || !current.data.docket) throw new Error('This docket is unavailable in your current access.')
    if (!(DOCKET_TRANSITIONS[current.data.docket.status] ?? []).includes(toStatus)) throw new Error(`A ${current.data.docket.status} docket cannot move to ${toStatus}.`)
    const response = await keystoneClient<{ updateDocket: { id: string } | null }>('mutation ChangeDocketStatus($id: ID!, $data: DocketUpdateInput!) { updateDocket(where: { id: $id }, data: $data) { id } }', {
      id: docketId,
      data: { status: toStatus, ...(toStatus === 'closed' ? { closedAt: new Date().toISOString() } : {}) },
    })
    if (!response.success || !response.data.updateDocket) throw new Error('The docket status was not changed. Calendar management permission is required.')
    revalidatePath(DOCKETS)
    revalidatePath(docketPath(docketId))
    return commandResult(previous, true, `Docket ${toStatus}.`)
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The docket status was not changed.')
  }
}

/** Records a docket entry by hand as an unverified draft. */
export async function recordEntry(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const docketId = formText(formData, 'docketId', { label: 'Docket', min: 1, max: 200 })
    const title = formText(formData, 'title', { label: 'Title', min: 1, max: 300 })
    const entryType = formChoice(formData, 'entryType', entryTypes, 'entry type')
    const occurredAt = await wallInstant(formData, 'occurredAt', 'Entry date', true)
    const filedAt = await wallInstant(formData, 'filedAt', 'Filed date', false)
    const enteredAt = await wallInstant(formData, 'enteredAt', 'Entered date', false)
    const description = formText(formData, 'description', { label: 'Description', max: 8000 })
    const sourceUrl = httpsUrl(formData, 'sourceUrl', 'Source address')
    const documentVersionId = formText(formData, 'documentVersionId', { max: 200 })
    const docket = await keystoneClient<{ docket: { id: string; status: string } | null }>('query EntryDocket($id: ID!) { docket(where: { id: $id }) { id status } }', { id: docketId })
    if (!docket.success || !docket.data.docket) throw new Error('This docket is unavailable in your current access.')
    if (docket.data.docket.status === 'closed') throw new Error('A closed docket cannot receive new entries.')
    const response = await keystoneClient<{ recordDocketEntry: { id: string; status: string } }>(`
      mutation RecordDocketEntry($docketId: ID!, $title: String!, $entryType: String!, $occurredAt: DateTime!, $filedAt: DateTime, $enteredAt: DateTime, $description: String, $sourceUrl: String, $documentVersionId: ID) {
        recordDocketEntry(docketId: $docketId, title: $title, entryType: $entryType, occurredAt: $occurredAt, filedAt: $filedAt, enteredAt: $enteredAt, description: $description, sourceUrl: $sourceUrl, documentVersionId: $documentVersionId) { id status }
      }
    `, { docketId, title, entryType, occurredAt, filedAt, enteredAt, description: description || null, sourceUrl: sourceUrl || null, documentVersionId: documentVersionId || null })
    if (!response.success) throw new Error('The entry was not recorded. Calendar management permission and matter access are required; a supporting document must be a version on this matter.')
    revalidatePath(docketPath(docketId))
    return commandResult(previous, true, 'Draft entry recorded. Verify it against the court record.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The entry was not recorded.')
  }
}

/** Verifies an entry against the court record and records its outcome. */
export async function verifyEntry(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const docketId = formText(formData, 'docketId', { label: 'Docket', min: 1, max: 200 })
    const entryId = formText(formData, 'entryId', { label: 'Entry', min: 1, max: 200 })
    const toStatus = formChoice(formData, 'toStatus', ['filed', 'entered', 'rejected', 'withdrawn'] as const, 'outcome')
    const reason = formText(formData, 'reason', { label: 'Verification note', min: 3, max: 2000 })
    const entry = await keystoneClient<{ docketEntry: { id: string; status: string; isVerified: boolean; filedAt: string | null; enteredAt: string | null } | null }>('query EntryVerifyCheck($id: ID!) { docketEntry(where: { id: $id }) { id status isVerified filedAt enteredAt } }', { id: entryId })
    if (!entry.success || !entry.data.docketEntry) throw new Error('This entry is unavailable in your current access.')
    const current = entry.data.docketEntry
    if (current.isVerified) throw new Error('This entry is already verified.')
    if (!(ENTRY_OUTCOMES[current.status] ?? []).includes(toStatus)) throw new Error(`A ${current.status} entry cannot be verified as ${toStatus}.`)
    if (toStatus === 'filed' && !current.filedAt) throw new Error("Record the court's filed date before verifying a filing.")
    if (toStatus === 'entered' && !current.enteredAt) throw new Error("Record the court's entered date before verifying an entry.")
    const response = await keystoneClient<{ verifyDocketEntry: { id: string; status: string } }>(`
      mutation VerifyDocketEntry($entryId: ID!, $toStatus: String!, $reason: String!) { verifyDocketEntry(entryId: $entryId, toStatus: $toStatus, reason: $reason) { id status } }
    `, { entryId, toStatus, reason })
    if (!response.success) throw new Error('The entry was not verified. Calendar management permission and matter access are required.')
    revalidatePath(docketPath(docketId))
    return commandResult(previous, true, `Entry verified as ${toStatus}.`)
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The entry was not verified.')
  }
}

/** Adds a draft deadline linked to this docket and its matter. */
export async function addDocketDeadline(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const docketId = formText(formData, 'docketId', { label: 'Docket', min: 1, max: 200 })
    const title = formText(formData, 'title', { label: 'Title', min: 1, max: 300 })
    const deadlineType = formChoice(formData, 'deadlineType', deadlineTypes, 'deadline type')
    const timezone = validTimeZone(formData.get('timezone')) ?? await getFirmTimeZone()
    const dueAt = await wallInstant(formData, 'dueAt', 'Due time', true)
    const docket = await keystoneClient<{ docket: { id: string; matter: { id: string } | null } | null }>('query DeadlineDocket($id: ID!) { docket(where: { id: $id }) { id matter { id } } }', { id: docketId })
    if (!docket.success || !docket.data.docket?.matter) throw new Error('This docket is unavailable in your current access.')
    const response = await keystoneClient<{ createDeadline: { id: string } | null }>('mutation CreateDocketDeadline($data: DeadlineCreateInput!) { createDeadline(data: $data) { id } }', {
      data: { matter: { connect: { id: docket.data.docket.matter.id } }, docket: { connect: { id: docketId } }, title, deadlineType, source: 'manual', dueAt, timezone },
    })
    if (!response.success || !response.data.createDeadline) throw new Error('The deadline was not created. Calendar management permission and matter access are required.')
    revalidatePath(docketPath(docketId))
    revalidatePath('/dashboard/platform/work')
    return commandResult(previous, true, 'Draft deadline created. It still needs verification.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The deadline was not created.')
  }
}
