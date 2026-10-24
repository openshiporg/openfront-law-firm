import type { Tone } from '@/features/platform/components/ui'

export const CONTACT_STATUSES = ['prospective_client', 'client', 'former_client', 'opposing', 'other', 'archived'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  prospective_client: 'Prospective client',
  client: 'Client',
  former_client: 'Former client',
  opposing: 'Opposing',
  other: 'Other',
  archived: 'Archived',
}

export const CONTACT_STATUS_TONES: Record<ContactStatus, Tone> = {
  prospective_client: 'amber',
  client: 'emerald',
  former_client: 'sky',
  opposing: 'rose',
  other: 'violet',
  archived: 'zinc',
}

export const CONTACT_TYPES = ['person', 'organization'] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const ADDRESS_TYPES = ['mailing', 'home', 'work', 'billing', 'other'] as const
export type AddressType = (typeof ADDRESS_TYPES)[number]
export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = { mailing: 'Mailing', home: 'Home', work: 'Work', billing: 'Billing', other: 'Other' }

export const METHOD_TYPES = ['email', 'phone', 'portal', 'other'] as const
export type MethodType = (typeof METHOD_TYPES)[number]
export const METHOD_TYPE_LABELS: Record<MethodType, string> = { email: 'Email', phone: 'Phone', portal: 'Secure portal', other: 'Other' }

export const CONTACT_PAGE_SIZE = 25
export const MAX_CONFLICT_ALIASES = 20

export function isContactStatus(value: unknown): value is ContactStatus {
  return typeof value === 'string' && (CONTACT_STATUSES as readonly string[]).includes(value)
}

export function isContactType(value: unknown): value is ContactType {
  return typeof value === 'string' && (CONTACT_TYPES as readonly string[]).includes(value)
}

export type ContactListRow = {
  id: string
  displayName: string
  contactType: ContactType
  status: ContactStatus
  preferredName: string | null
  organizationName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  updatedAt: string | null
}

export type ContactListResult =
  | {
      status: 'loaded'
      rows: ContactListRow[]
      total: number
      counts: Record<ContactStatus | 'all', number>
      page: number
      pageCount: number
      query: string
      statusFilter: ContactStatus | 'all'
      typeFilter: ContactType | 'all'
    }
  | { status: 'error'; message: string }

export type ContactAddressRow = {
  id: string
  label: string | null
  addressType: AddressType | null
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  countryCode: string | null
  isPrimary: boolean
}

export type ContactMethodRow = {
  id: string
  methodType: MethodType
  label: string | null
  value: string | null
  isPrimary: boolean
  canContact: boolean
  verifiedAt: string | null
}

export type ContactIdentity = {
  id: string
  displayName: string
  contactType: ContactType
  status: ContactStatus
  firstName: string | null
  middleName: string | null
  lastName: string | null
  organizationName: string | null
  preferredName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  conflictSearchAliases: unknown
  createdAt: string | null
  updatedAt: string | null
}

export type ContactMatterPartyRow = {
  id: string
  partyRole: string
  side: string | null
  status: string | null
  isPrimaryClient: boolean
  matter: { id: string; matterNumber: string | null; title: string | null; status: string | null } | null
}

export type ContactIntakeRow = { id: string; intakeNumber: string | null; title: string | null; status: string; receivedAt: string | null }
export type ContactPortalAccountRow = { id: string; email: string | null; status: string; invitedAt: string | null; lastLoginAt: string | null }

/** A related section either loads or is withheld by the viewer's access. */
export type Related<T> = { status: 'loaded'; rows: T[] } | { status: 'unavailable' }

export type ContactDetailResult =
  | {
      status: 'loaded'
      contact: ContactIdentity
      addresses: ContactAddressRow[]
      methods: ContactMethodRow[]
      matters: Related<ContactMatterPartyRow>
      intakes: Related<ContactIntakeRow>
      portalAccounts: Related<ContactPortalAccountRow>
    }
  | { status: 'missing' }
  | { status: 'error'; message: string }

export type ContactActionState = { ok: boolean; message: string; revision: number; id?: string }

export const initialContactActionState: ContactActionState = { ok: false, message: '', revision: 0 }

export function aliasList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export const PARTY_ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  claimant: 'Plaintiff / claimant',
  respondent: 'Defendant / respondent',
  opposing_party: 'Opposing party',
  witness: 'Witness',
  expert: 'Expert',
  counsel: 'Counsel',
  adjudicator: 'Judge / adjudicator',
  other: 'Other',
}
