import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import {
  CONTACT_PAGE_SIZE,
  CONTACT_STATUSES,
  type ContactAddressRow,
  type ContactDetailResult,
  type ContactIdentity,
  type ContactIntakeRow,
  type ContactListResult,
  type ContactListRow,
  type ContactMatterPartyRow,
  type ContactMethodRow,
  type ContactPortalAccountRow,
  type ContactStatus,
  type ContactType,
  type Related,
} from './contactTypes'

const listFields = 'id displayName contactType status preferredName organizationName primaryEmail primaryPhone updatedAt'

function searchWhere(query: string, type: ContactType | 'all') {
  const and: Record<string, unknown>[] = []
  if (type !== 'all') and.push({ contactType: { equals: type } })
  if (query) {
    const contains = { contains: query, mode: 'insensitive' }
    and.push({
      OR: [
        { firstName: contains },
        { lastName: contains },
        { middleName: contains },
        { preferredName: contains },
        { organizationName: contains },
        { primaryEmail: contains },
      ],
    })
  }
  return and
}

/** One page of contacts plus a count per status tab under the same search and type filter. */
export async function getContactList(options: { query: string; status: ContactStatus | 'all'; type: ContactType | 'all'; page: number }): Promise<ContactListResult> {
  const query = options.query.trim().slice(0, 100)
  const base = searchWhere(query, options.type)
  const statusWhere = (status: ContactStatus | 'all') => ({ AND: status === 'all' ? base : [...base, { status: { equals: status } }] })

  const countVariables: Record<string, unknown> = { all: statusWhere('all') }
  CONTACT_STATUSES.forEach((status, index) => { countVariables[`s${index}`] = statusWhere(status) })
  const counts = await keystoneClient<Record<string, number>>(`
    query ContactCounts($all: ContactWhereInput!, ${CONTACT_STATUSES.map((_, index) => `$s${index}: ContactWhereInput!`).join(', ')}) {
      all: contactsCount(where: $all)
      ${CONTACT_STATUSES.map((_, index) => `s${index}: contactsCount(where: $s${index})`).join('\n')}
    }
  `, countVariables)
  if (!counts.success) return { status: 'error', message: 'Contacts could not be loaded. Viewing people requires people access.' }

  const countMap = { all: counts.data.all ?? 0 } as Record<ContactStatus | 'all', number>
  CONTACT_STATUSES.forEach((status, index) => { countMap[status] = counts.data[`s${index}`] ?? 0 })
  const total = countMap[options.status]
  const pageCount = Math.max(1, Math.ceil(total / CONTACT_PAGE_SIZE))
  const page = Math.min(Math.max(options.page, 1), pageCount)

  const rows = await keystoneClient<{ contacts: ContactListRow[] }>(`
    query ContactPage($where: ContactWhereInput!, $take: Int!, $skip: Int!) {
      contacts(where: $where, orderBy: [{ updatedAt: desc }, { id: asc }], take: $take, skip: $skip) { ${listFields} }
    }
  `, { where: statusWhere(options.status), take: CONTACT_PAGE_SIZE, skip: (page - 1) * CONTACT_PAGE_SIZE })
  if (!rows.success) return { status: 'error', message: 'Contacts could not be loaded.' }

  return {
    status: 'loaded',
    rows: rows.data.contacts ?? [],
    total,
    counts: countMap,
    page,
    pageCount,
    query,
    statusFilter: options.status,
    typeFilter: options.type,
  }
}

const identityFields = 'id displayName contactType status firstName middleName lastName organizationName preferredName primaryEmail primaryPhone conflictSearchAliases createdAt updatedAt'
const addressFields = 'id label addressType line1 line2 city region postalCode countryCode isPrimary'
const methodFields = 'id methodType label value isPrimary canContact verifiedAt'

async function related<T>(query: string, key: string, id: string): Promise<Related<T>> {
  const response = await keystoneClient<Record<string, T[] | null>>(query, { id })
  if (!response.success) return { status: 'unavailable' }
  return { status: 'loaded', rows: response.data[key] ?? [] }
}

/** Contact identity, addresses and methods; matters, intakes and portal access load separately
 * so a viewer without matter, intake or portal access still sees the contact. */
export async function getContactDetail(contactId: string): Promise<ContactDetailResult> {
  const id = contactId.trim()
  if (!id || id.length > 200) return { status: 'missing' }
  const response = await keystoneClient<{ contact: ContactIdentity | null; addresses: ContactAddressRow[]; contactMethods: ContactMethodRow[] }>(`
    query ContactDetail($id: ID!) {
      contact(where: { id: $id }) { ${identityFields} }
      addresses(where: { contact: { id: { equals: $id } } }, orderBy: [{ isPrimary: desc }, { createdAt: asc }], take: 50) { ${addressFields} }
      contactMethods(where: { contact: { id: { equals: $id } } }, orderBy: [{ isPrimary: desc }, { createdAt: asc }], take: 50) { ${methodFields} }
    }
  `, { id })
  if (!response.success) return { status: 'error', message: 'Contact could not be loaded. Viewing people requires people access.' }
  if (!response.data.contact) return { status: 'missing' }

  const [matters, intakes, portalAccounts] = await Promise.all([
    related<ContactMatterPartyRow>(`
      query ContactMatters($id: ID!) {
        matterParties(where: { contact: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: 50) {
          id partyRole side status isPrimaryClient
          matter { id matterNumber title status }
        }
      }
    `, 'matterParties', id),
    related<ContactIntakeRow>(`
      query ContactIntakes($id: ID!) {
        intakes(
          where: { OR: [{ primaryContact: { id: { equals: $id } } }, { participants: { some: { contact: { id: { equals: $id } } } } }] }
          orderBy: [{ receivedAt: desc }]
          take: 50
        ) { id intakeNumber title status receivedAt }
      }
    `, 'intakes', id),
    related<ContactPortalAccountRow>(`
      query ContactPortal($id: ID!) {
        portalAccounts(where: { contact: { id: { equals: $id } } }, take: 5) { id email status invitedAt lastLoginAt }
      }
    `, 'portalAccounts', id),
  ])

  return {
    status: 'loaded',
    contact: response.data.contact,
    addresses: response.data.addresses ?? [],
    methods: response.data.contactMethods ?? [],
    matters,
    intakes,
    portalAccounts,
  }
}
