export const COURT_TYPES = [
  ['federal', 'Federal'],
  ['state', 'State / provincial'],
  ['local', 'County / local'],
  ['administrative', 'Administrative'],
  ['arbitration', 'Arbitration'],
  ['other', 'Other tribunal'],
] as const

export const DOCKET_STATUSES = ['active', 'stayed', 'appealed', 'closed'] as const
export type DocketStatus = (typeof DOCKET_STATUSES)[number]

// Mirrors the docket lifecycle in features/keystone/lib/lifecycles.ts.
export const DOCKET_TRANSITIONS: Record<string, DocketStatus[]> = {
  active: ['stayed', 'appealed', 'closed'],
  stayed: ['active', 'closed'],
  appealed: ['active', 'closed'],
  closed: [],
}

export const ENTRY_TYPES = [
  ['filing', 'Filing'],
  ['order', 'Order'],
  ['hearing', 'Hearing'],
  ['notice', 'Notice'],
  ['service', 'Service'],
  ['correspondence', 'Correspondence'],
  ['other', 'Other'],
] as const

// verifyDocketEntry outcomes allowed from each unverified entry status.
export const ENTRY_OUTCOMES: Record<string, Array<'filed' | 'entered' | 'rejected' | 'withdrawn'>> = {
  draft: ['filed', 'entered', 'rejected', 'withdrawn'],
  filed: ['entered', 'rejected', 'withdrawn'],
}

export const DEADLINE_TYPES = [
  ['court', 'Court'],
  ['statutory', 'Statutory'],
  ['contractual', 'Contractual'],
  ['internal', 'Internal'],
  ['limitation', 'Limitation'],
  ['other', 'Other'],
] as const

export type CourtRow = {
  id: string
  name: string
  courtType: string
  jurisdiction: string
  division: string | null
  status: string | null
  phone: string | null
  website: string | null
  filingUrl: string | null
  docketsCount: number | null
}

export type DocketRow = {
  id: string
  docketNumber: string
  title: string | null
  status: string
  filedAt: string | null
  court: { id: string; name: string | null } | null
  matter: { id: string; matterNumber: string | null; title: string | null } | null
  entriesCount: number | null
}

export type DocketEntryRow = {
  id: string
  title: string | null
  entryType: string
  status: string
  occurredAt: string | null
  filedAt: string | null
  enteredAt: string | null
  description: string | null
  sourceUrl: string | null
  isVerified: boolean
  verifiedAt: string | null
  verifiedBy: { name: string | null } | null
  documentVersion: { id: string; fileName: string | null; versionNumber: number | null } | null
}

export type DocketDeadlineRow = { id: string; title: string | null; status: string; deadlineType: string | null; dueAt: string | null; timezone: string | null; isVerified: boolean | null }

export type DocketDetail = DocketRow & {
  notes: string | null
  closedAt: string | null
  entries: DocketEntryRow[]
  deadlines: DocketDeadlineRow[]
}

export type DocumentVersionOption = { id: string; label: string }
