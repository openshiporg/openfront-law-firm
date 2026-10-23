'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { communicationDispatchState } from '@/features/shared/dispatch-outcome'

import { formatInstant, validTimeZone } from '../lib/datetime'
import { getFirmTimeZone } from '../lib/firmTimeZone'
import { formatMoneyLabel } from '../lib/money'

export type PlatformDrillInList = { title: string; total: number; rows: Array<{ title: string; meta: string; href?: string }> }

export type PlatformDrillIn = {
  title: string
  status: string
  kind: string
  facts: Array<[string, string]>
  notice: string
  related: Array<{ label: string; href: string }>
  lists: PlatformDrillInList[]
}

type Result = { success: true; data: PlatformDrillIn } | { success: false; error: string }
type RelatedRecord = Record<string, unknown> & { id?: string }
type RecordValue = Record<string, unknown> & {
  matter?: RelatedRecord & { office?: RelatedRecord | null }
  assignedTo?: RelatedRecord
  deadline?: RelatedRecord
  docket?: RelatedRecord
  intake?: RelatedRecord
  host?: RelatedRecord
  currentVersion?: RelatedRecord
  retentionPolicy?: RelatedRecord
  documentVersion?: RelatedRecord & { document?: RelatedRecord | null }
  thread?: RelatedRecord
  message?: RelatedRecord & { thread?: RelatedRecord | null }
  recipientContact?: RelatedRecord
  user?: RelatedRecord
  task?: RelatedRecord
  approvedBy?: RelatedRecord
  incurredBy?: RelatedRecord
  vendor?: RelatedRecord
  receiptVersion?: RelatedRecord
  versions?: RelatedRecord[]
  signers?: RelatedRecord[]
  messages?: RelatedRecord[]
  attachments?: RelatedRecord[]
}

type Format = { date: (value: unknown) => string }

type DrillInDefinition = {
  query: string
  root: string
  kind: string
  notice: string
  title: (record: RecordValue) => string
  facts: (record: RecordValue, format: Format) => Array<[string, string]>
  zone?: (record: RecordValue) => unknown
  related?: (record: RecordValue) => Array<{ label: string; href: string } | null>
  lists?: (record: RecordValue, format: Format) => PlatformDrillInList[]
}

const LIST_LIMIT = 20
const label = (value: unknown, fallback = 'Not recorded') => {
  if (value === null || value === undefined || value === '') return fallback
  const text = String(value).replaceAll('_', ' ')
  return /^[a-z][a-z ]*$/.test(text) ? text.charAt(0).toUpperCase() + text.slice(1) : text
}
const money = (minor: unknown, currency: unknown, missing?: string) => formatMoneyLabel(minor, currency, missing)
const matter = (record: RecordValue) => record.matter ? `${record.matter.matterNumber ?? 'Matter'} · ${record.matter.title ?? ''}` : 'Firm-level'
const matterFields = 'matter { id matterNumber title office { timezone } }'
const matterLink = (record: RecordValue) => record.matter?.id
  ? { label: `Open matter ${label(record.matter.matterNumber, '')}`.trim(), href: `/dashboard/platform/matters/${encodeURIComponent(String(record.matter.id))}` }
  : null
const count = (value: unknown) => (typeof value === 'number' ? value : 0)
const bytes = (value: unknown) => (typeof value === 'number' ? `${value.toLocaleString('en')} bytes` : 'size not recorded')

const drillIns: Record<string, DrillInDefinition> = {
  task: {
    root: 'legalTask', kind: 'Task', notice: 'Task transitions remain controlled and completion is checked against unfinished dependencies.',
    query: `legalTask(where: { id: $id }) { id title status priority dueAt completedAt blockedReason ${matterFields} assignedTo { name } deadline { id title } }`,
    title: (r) => label(r.title, 'Untitled task'),
    facts: (r, f) => [['Matter', matter(r)], ['Owner', label(r.assignedTo?.name, 'Unassigned')], ['Due', f.date(r.dueAt)], ['Priority', label(r.priority)], ['Linked deadline', label(r.deadline?.title, 'None')], ['Blocker', label(r.blockedReason, 'None')]],
    related: (r) => [matterLink(r), r.deadline?.id ? { label: 'Open linked deadline', href: `/dashboard/platform/work/deadline/${encodeURIComponent(String(r.deadline.id))}` } : null],
  },
  deadline: {
    root: 'deadline', kind: 'Deadline', notice: 'Verification, court-rule applicability, and filing acceptance require human review; this desk does not calculate legal deadlines.',
    query: `deadline(where: { id: $id }) { id title status dueAt timezone source deadlineType isVerified verifiedAt ${matterFields} assignedTo { name } }`,
    title: (r) => label(r.title, 'Untitled deadline'),
    zone: (r) => r.timezone,
    facts: (r, f) => [['Matter', matter(r)], ['Owner', label(r.assignedTo?.name, 'Unassigned')], ['Due', f.date(r.dueAt)], ['Verification', r.isVerified ? `Verified ${f.date(r.verifiedAt)}` : 'Requires verification'], ['Source', label(r.source)], ['Time zone', label(r.timezone)]],
    related: (r) => [matterLink(r)],
  },
  'docket-entry': {
    root: 'docketEntry', kind: 'Docket entry', notice: 'Docket activity is a record of source state, not a filing or court-integration confirmation.',
    query: `docketEntry(where: { id: $id }) { id title status entryType occurredAt isVerified ${matterFields} docket { docketNumber } }`,
    title: (r) => label(r.title, 'Docket entry'),
    facts: (r, f) => [['Matter', matter(r)], ['Docket', label(r.docket?.docketNumber)], ['Occurred', f.date(r.occurredAt)], ['Entry type', label(r.entryType)], ['Verification', r.isVerified ? 'Verified' : 'Unverified']],
    related: (r) => [matterLink(r)],
  },
  consultation: {
    root: 'consultation', kind: 'Consultation', notice: 'Consultation times are shown in the consultation’s own time zone. Calendar delivery and reminders require a configured integration.',
    query: 'consultation(where: { id: $id }) { id status startsAt endsAt timezone location intake { id intakeNumber title } host { name } }',
    title: (r) => label(r.intake?.title, 'Prospective-client consultation'),
    zone: (r) => r.timezone,
    facts: (r, f) => [['Intake', label(r.intake?.intakeNumber)], ['Host', label(r.host?.name, 'Unassigned')], ['Starts', f.date(r.startsAt)], ['Ends', f.date(r.endsAt)], ['Time zone', label(r.timezone)], ['Location', label(r.location)]],
    related: (r) => [r.intake?.id ? { label: 'Open intake pipeline', href: `/dashboard/platform/intake#pipeline-${encodeURIComponent(String(r.intake.id))}` } : null],
  },
  document: {
    root: 'document', kind: 'Document', notice: 'Each version keeps its file name, size and SHA-256 checksum. Files are stored in the firm bucket.',
    query: `document(where: { id: $id }) { id title status category confidentiality updatedAt ${matterFields} currentVersion { versionNumber fileName checksumSha256 source } versionsCount versions(orderBy: [{ versionNumber: desc }, { id: asc }], take: ${LIST_LIMIT}) { id versionNumber fileName mediaType byteSize checksumSha256 source createdAt } retentionPolicy { name } }`,
    title: (r) => label(r.title, 'Untitled document'),
    facts: (r) => [['Matter', matter(r)], ['Category', label(r.category)], ['Confidentiality', label(r.confidentiality)], ['Current version', r.currentVersion ? `v${r.currentVersion.versionNumber ?? '?'} · ${r.currentVersion.fileName ?? 'unnamed file'}` : 'No current version'], ['Checksum', label(r.currentVersion?.checksumSha256, 'Not recorded')], ['Version count', label(r.versionsCount, '0')], ['Retention policy', label(r.retentionPolicy?.name, 'None')]],
    related: (r) => [matterLink(r)],
    lists: (r, f) => [{
      title: 'Version history',
      total: count(r.versionsCount),
      rows: (r.versions ?? []).map((version) => ({
        title: `v${label(version.versionNumber, '?')} · ${label(version.fileName, 'unnamed file')}`,
        meta: `${label(version.mediaType, 'type not recorded')} · ${bytes(version.byteSize)} · ${label(version.source)} · ${f.date(version.createdAt)} · sha256 ${label(version.checksumSha256, 'not recorded')}`,
      })),
    }],
  },
  'signature-request': {
    root: 'signatureRequest', kind: 'Signature request', notice: 'Signatures are collected outside this workspace; this view records the exact document version, signers and request state.',
    query: `signatureRequest(where: { id: $id }) { id title status updatedAt sentAt expiresAt ${matterFields} documentVersion { versionNumber fileName document { id title } } signersCount signers(orderBy: [{ signingOrder: asc }, { id: asc }], take: ${LIST_LIMIT}) { id name email signingOrder status signedAt } }`,
    title: (r) => label(r.title, 'Signature request'),
    facts: (r, f) => [['Matter', matter(r)], ['Document version', r.documentVersion ? `${label(r.documentVersion.document?.title, 'Document')} · v${label(r.documentVersion.versionNumber, '?')} · ${label(r.documentVersion.fileName, 'unnamed file')}` : 'Not recorded'], ['Workflow state', label(r.status)], ['Sent', f.date(r.sentAt)], ['Expires', f.date(r.expiresAt)], ['Last updated', f.date(r.updatedAt)]],
    related: (r) => [matterLink(r), r.documentVersion?.document?.id ? { label: 'Open document', href: `/dashboard/platform/documents/document/${encodeURIComponent(String(r.documentVersion.document.id))}` } : null],
    lists: (r, f) => [{
      title: 'Signers',
      total: count(r.signersCount),
      rows: (r.signers ?? []).map((signer) => ({ title: `${label(signer.signingOrder, '?')}. ${label(signer.name, 'Signer')}`, meta: `${label(signer.email, 'no email')} · ${label(signer.status)}${signer.signedAt ? ` · signed ${f.date(signer.signedAt)}` : ''}` })),
    }],
  },
  thread: {
    root: 'communicationThread', kind: 'Communication thread', notice: 'Messages are shown newest first. Sending happens only through the controlled queue and delivery evidence.',
    query: `communicationThread(where: { id: $id }) { id subject status primaryChannel lastMessageAt ${matterFields} intake { intakeNumber title } participantsCount messagesCount messages(orderBy: [{ createdAt: desc }, { id: asc }], take: ${LIST_LIMIT}) { id subject body direction status createdAt } }`,
    title: (r) => label(r.subject, 'Untitled conversation'),
    facts: (r, f) => [['Matter / intake', r.matter ? matter(r) : `${r.intake?.intakeNumber ?? 'Firm-level'} · ${r.intake?.title ?? ''}`], ['Primary channel', label(r.primaryChannel)], ['Last activity', f.date(r.lastMessageAt)], ['Participants', label(r.participantsCount, '0')], ['Messages', label(r.messagesCount, '0')]],
    related: (r) => [matterLink(r)],
    lists: (r, f) => [{
      title: 'Conversation',
      total: count(r.messagesCount),
      rows: (r.messages ?? []).map((message) => ({
        title: `${label(message.direction)} · ${label(message.subject, 'No subject')} · ${label(message.status)} · ${f.date(message.createdAt)}`,
        meta: label(message.body, 'No message body'),
        href: `/dashboard/platform/communications/message/${encodeURIComponent(String(message.id))}`,
      })),
    }],
  },
  message: {
    root: 'communicationMessage', kind: 'Message', notice: 'Outbound messages are sent only through controlled queueing and delivery evidence. Message content cannot be edited after it is recorded.',
    query: `communicationMessage(where: { id: $id }) { id subject body status direction channel queuedAt sentAt receivedAt ${matterFields} thread { id subject } deliveriesCount attachmentsCount attachments(orderBy: [{ versionNumber: desc }, { id: asc }], take: ${LIST_LIMIT}) { id versionNumber fileName byteSize checksumSha256 document { id title } } }`,
    title: (r) => label(r.subject, label(r.thread?.subject, 'Untitled message')),
    facts: (r, f) => [['Matter', matter(r)], ['Thread', label(r.thread?.subject)], ['Direction', label(r.direction)], ['Channel', label(r.channel)], ['Queued', f.date(r.queuedAt)], ['Sent / received', r.sentAt ? f.date(r.sentAt) : f.date(r.receivedAt)], ['Deliveries', label(r.deliveriesCount, '0')], ['Attachments', label(r.attachmentsCount, '0')]],
    related: (r) => [matterLink(r), r.thread?.id ? { label: 'Open conversation', href: `/dashboard/platform/communications/thread/${encodeURIComponent(String(r.thread.id))}` } : null],
    lists: (r) => [
      { title: 'Message', total: r.body ? 1 : 0, rows: r.body ? [{ title: label(r.subject, 'No subject'), meta: String(r.body) }] : [] },
      {
        title: 'Attachments (exact versions)',
        total: count(r.attachmentsCount),
        rows: (r.attachments ?? []).map((version) => ({
          title: `${label((version.document as RelatedRecord | undefined)?.title, 'Document')} · v${label(version.versionNumber, '?')} · ${label(version.fileName, 'unnamed file')}`,
          meta: `${bytes(version.byteSize)} · sha256 ${label(version.checksumSha256, 'not recorded')}`,
          href: (version.document as RelatedRecord | undefined)?.id ? `/dashboard/platform/documents/document/${encodeURIComponent(String((version.document as RelatedRecord).id))}` : undefined,
        })),
      },
    ],
  },
  delivery: {
    root: 'communicationDelivery', kind: 'Delivery', notice: 'Delivery outcomes are retained as provider evidence. Retrying and provider dispatch are not simulated from this desk.',
    query: `communicationDelivery(where: { id: $id }) { id status channel attemptCount lastAttemptAt deliveredAt recipientAddress provider errorCode recipientContact { displayName } ${matterFields} message { id subject thread { subject } } }`,
    title: (r) => `Delivery to ${label(r.recipientContact?.displayName, label(r.recipientAddress, 'recipient'))}`,
    facts: (r, f) => [['Message', label(r.message?.subject, label(r.message?.thread?.subject, 'Untitled message'))], ['Recipient', `${label(r.recipientContact?.displayName, 'Contact not linked')} · ${label(r.recipientAddress, 'no address')}`], ['Channel', label(r.channel)], ['Provider', label(r.provider)], ['Attempts', label(r.attemptCount, '0')], ['Last attempt', f.date(r.lastAttemptAt)], ['Delivered', f.date(r.deliveredAt)], ['Outcome', communicationDispatchState(String(r.status ?? ''), typeof r.errorCode === 'string' ? r.errorCode : null).guidance || label(r.status)]],
    related: (r) => [matterLink(r), r.message?.id ? { label: 'Open message', href: `/dashboard/platform/communications/message/${encodeURIComponent(String(r.message.id))}` } : null],
  },
  'time-entry': {
    root: 'timeEntry', kind: 'Time entry', notice: 'Billability and lifecycle review happen before billing assembly. Approved or billed source records cannot be freely rewritten.',
    query: `timeEntry(where: { id: $id }) { id description status workDate startedAt endedAt durationMinutes isBillable amountMinor currencyCode ${matterFields} user { name } task { id title } approvedBy { name } approvedAt }`,
    title: (r) => label(r.description, 'Time entry'),
    facts: (r, f) => [['Matter', matter(r)], ['Timekeeper', label(r.user?.name)], ['Task', label(r.task?.title, 'None')], ['Work date', f.date(r.workDate)], ['Elapsed', `${label(r.durationMinutes, '0')} minutes`], ['Billability', r.isBillable ? money(r.amountMinor, r.currencyCode, 'Billable · unpriced') : 'Non-billable'], ['Started / ended', r.startedAt ? `${f.date(r.startedAt)} → ${f.date(r.endedAt)}` : 'Not timed'], ['Reviewed by', r.approvedBy?.name ? `${r.approvedBy.name} · ${f.date(r.approvedAt)}` : 'Not approved']],
    related: (r) => [matterLink(r), r.task?.id ? { label: 'Open task', href: `/dashboard/platform/work/task/${encodeURIComponent(String(r.task.id))}` } : null],
  },
  expense: {
    root: 'expense', kind: 'Expense', notice: 'Expense approval and billability remain distinct from client trust and operating-account activity.',
    query: `expense(where: { id: $id }) { id description status expenseType incurredAt amountMinor currencyCode isBillable ${matterFields} incurredBy { name } vendor { displayName } approvedBy { name } approvedAt receiptVersion { versionNumber fileName } }`,
    title: (r) => label(r.description, 'Expense'),
    facts: (r, f) => [['Matter', matter(r)], ['Incurred by', label(r.incurredBy?.name)], ['Vendor', label(r.vendor?.displayName)], ['Incurred', f.date(r.incurredAt)], ['Amount', money(r.amountMinor, r.currencyCode)], ['Billability', r.isBillable ? 'Billable' : 'Non-billable'], ['Expense type', label(r.expenseType)], ['Receipt version', r.receiptVersion ? `v${r.receiptVersion.versionNumber ?? '?'} · ${r.receiptVersion.fileName ?? 'unnamed file'}` : 'Not attached'], ['Reviewed by', r.approvedBy?.name ? `${r.approvedBy.name} · ${f.date(r.approvedAt)}` : 'Not approved']],
    related: (r) => [matterLink(r)],
  },
}

export async function getPlatformDrillIn(kind: string, id: string): Promise<Result> {
  const definition = Object.hasOwn(drillIns, kind) ? drillIns[kind] : undefined
  const recordId = id.trim()
  if (!definition || !recordId || recordId.length > 200) return { success: false, error: 'This platform record is unavailable.' }
  const [response, firmZone] = await Promise.all([
    keystoneClient<Record<string, RecordValue | null>>(`query PlatformDrillIn($id: ID!) { ${definition.query} }`, { id: recordId }),
    getFirmTimeZone(),
  ])
  if (!response.success) return { success: false, error: response.error }
  const record = response.data[definition.root]
  if (!record) return { success: false, error: 'This record is unavailable in the current authorization scope.' }
  // Record zone first (deadline/consultation), then the matter's office, then the firm.
  const zone = validTimeZone(definition.zone?.(record)) ?? validTimeZone(record.matter?.office?.timezone) ?? firmZone
  const format: Format = { date: (value) => formatInstant(value, zone) }
  return {
    success: true,
    data: {
      title: definition.title(record),
      status: kind === 'delivery' ? communicationDispatchState(String(record.status ?? 'recorded'), typeof record.errorCode === 'string' ? record.errorCode : null).status : typeof record.status === 'string' && record.status ? record.status : 'recorded',
      kind: definition.kind,
      facts: definition.facts(record, format),
      notice: definition.notice,
      related: (definition.related?.(record) ?? []).filter((link): link is { label: string; href: string } => Boolean(link)),
      lists: definition.lists?.(record, format) ?? [],
    },
  }
}
