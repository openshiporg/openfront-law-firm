export type PracticeOptionKind =
  | 'member' | 'office' | 'practiceArea' | 'role' | 'contact' | 'matter'
  | 'portalAccount' | 'trustAccount' | 'trustLedger' | 'connection'

export type PracticeOption = { value: string; label: string; currencyCode?: string }

type Row = Record<string, unknown>

// Reads a nested string from an untyped GraphQL row without trusting its shape.
function text(row: Row, ...path: string[]): string {
  let value: unknown = row
  for (const key of path) value = value && typeof value === 'object' ? (value as Row)[key] : undefined
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}
export type PracticeOptionDefinition = { query: string; where: (q: { contains: string; mode: 'insensitive' }) => Record<string, unknown>; map: (row: Row) => PracticeOption }

export const PRACTICE_OPTION_SEARCH_LIMIT = 25

// Fixed, read-only option searches. Each runs as the signed-in viewer through the normal
// list access filters, so a search can only surface records the viewer could already select.
export const practiceOptionDefinitions: Record<PracticeOptionKind, PracticeOptionDefinition> = {
  member: {
    query: `query MemberOptions($where: FirmMembershipWhereInput!, $take: Int!, $skip: Int!) { rows: firmMemberships(where: $where, orderBy: [{ createdAt: asc }, { id: asc }], take: $take, skip: $skip) { user { id name email } } }`,
    // Global login email deliberately remains non-filterable on User. Page
    // duplicate names and support an exact already-known identity ID instead.
    where: (q) => ({ status: { equals: 'active' }, OR: [{ user: { name: q } }, { user: { id: { equals: q.contains } } }] }),
    map: (row) => ({ value: text(row, 'user', 'id'), label: `${text(row, 'user', 'name') || 'Unnamed member'}${text(row, 'user', 'email') ? ` · ${text(row, 'user', 'email')}` : ''}` }),
  },
  office: {
    query: `query OfficeOptions($where: OfficeWhereInput!, $take: Int!, $skip: Int!) { rows: offices(where: $where, orderBy: [{ name: asc }, { id: asc }], take: $take, skip: $skip) { id name code } }`,
    where: (q) => ({ status: { equals: 'active' }, OR: [{ name: q }, { code: q }] }),
    map: (row) => ({ value: text(row, 'id'), label: `${text(row, 'name')} · ${text(row, 'code')}` }),
  },
  practiceArea: {
    query: `query PracticeAreaOptions($where: PracticeAreaWhereInput!, $take: Int!, $skip: Int!) { rows: practiceAreas(where: $where, orderBy: [{ name: asc }, { id: asc }], take: $take, skip: $skip) { id name } }`,
    where: (q) => ({ status: { equals: 'active' }, OR: [{ name: q }, { code: q }] }),
    map: (row) => ({ value: text(row, 'id'), label: text(row, 'name') }),
  },
  role: {
    query: `query RoleOptions($where: RoleWhereInput!, $take: Int!, $skip: Int!) { rows: roles(where: $where, orderBy: [{ name: asc }, { id: asc }], take: $take, skip: $skip) { id name } }`,
    where: (q) => ({ status: { equals: 'active' }, name: q }),
    map: (row) => ({ value: text(row, 'id'), label: text(row, 'name') }),
  },
  contact: {
    query: `query ContactOptions($where: ContactWhereInput!, $take: Int!, $skip: Int!) { rows: contacts(where: $where, orderBy: [{ lastName: asc }, { id: asc }], take: $take, skip: $skip) { id displayName primaryEmail } }`,
    where: (q) => ({ status: { not: { equals: 'archived' } }, OR: [{ firstName: q }, { lastName: q }, { organizationName: q }, { preferredName: q }, { primaryEmail: q }] }),
    map: (row) => ({ value: text(row, 'id'), label: `${text(row, 'displayName')}${text(row, 'primaryEmail') ? ` · ${text(row, 'primaryEmail')}` : ''}` }),
  },
  matter: {
    query: `query MatterOptions($where: MatterWhereInput!, $take: Int!, $skip: Int!) { rows: matters(where: $where, orderBy: [{ matterNumber: asc }, { id: asc }], take: $take, skip: $skip) { id matterNumber title } }`,
    where: (q) => ({ status: { in: ['open', 'on_hold', 'closing'] }, OR: [{ matterNumber: q }, { title: q }] }),
    map: (row) => ({ value: text(row, 'id'), label: `${text(row, 'matterNumber')} · ${text(row, 'title')}` }),
  },
  portalAccount: {
    query: `query PortalAccountOptions($where: PortalAccountWhereInput!, $take: Int!, $skip: Int!) { rows: portalAccounts(where: $where, orderBy: [{ updatedAt: desc }, { id: asc }], take: $take, skip: $skip) { id email contact { displayName } } }`,
    where: (q) => ({ status: { in: ['invited', 'active', 'suspended'] }, email: q }),
    map: (row) => ({ value: text(row, 'id'), label: `${text(row, 'contact', 'displayName') || text(row, 'email')} · ${text(row, 'email')}` }),
  },
  trustAccount: {
    query: `query TrustAccountOptions($where: TrustAccountWhereInput!, $take: Int!, $skip: Int!) { rows: trustAccounts(where: $where, orderBy: [{ name: asc }, { id: asc }], take: $take, skip: $skip) { id name accountType currencyCode bankAccountLastFour } }`,
    where: (q) => ({ name: q }),
    map: (row) => ({ value: text(row, 'id'), label: `${text(row, 'name')} · ${text(row, 'accountType')} · ${text(row, 'currencyCode')} · ••••${text(row, 'bankAccountLastFour') || '----'}`, currencyCode: text(row, 'currencyCode') }),
  },
  trustLedger: {
    query: `query TrustLedgerOptions($where: TrustLedgerAccountWhereInput!, $take: Int!, $skip: Int!) { rows: trustLedgerAccounts(where: $where, orderBy: [{ ledgerNumber: asc }, { id: asc }], take: $take, skip: $skip) { id ledgerNumber currencyCode trustAccount { name } client { displayName } } }`,
    where: (q) => ({ status: { in: ['active', 'frozen'] }, ledgerNumber: q }),
    map: (row) => ({ value: text(row, 'id'), label: `${text(row, 'ledgerNumber')} · ${text(row, 'client', 'displayName') || 'Client'} · ${text(row, 'trustAccount', 'name') || 'Trust account'} · ${text(row, 'currencyCode')}` , currencyCode: text(row, 'currencyCode')}),
  },
  connection: {
    query: `query ConnectionOptions($where: IntegrationConnectionWhereInput!, $take: Int!, $skip: Int!) { rows: integrationConnections(where: $where, orderBy: [{ name: asc }, { id: asc }], take: $take, skip: $skip) { id name provider category } }`,
    where: (q) => ({ status: { equals: 'active' }, OR: [{ name: q }, { provider: q }] }),
    map: (row) => ({ value: text(row, 'id'), label: `${text(row, 'name')} · ${text(row, 'provider')} · ${text(row, 'category')}` }),
  },
}

