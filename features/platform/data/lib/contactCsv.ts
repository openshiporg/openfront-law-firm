// Client-side CSV → contact import rows, in the exact shape runDataTransfer and the
// previewContactImport / applyContactImport commands already validate.

export type CsvContactRow = {
  sourceId: string
  contactType: string
  firstName?: string
  lastName?: string
  organizationName?: string
  email?: string
  phone?: string
  status?: string
}

export const MAX_CSV_ROWS = 500

/** RFC 4180-style parse: quoted fields, doubled quotes, commas and newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1 } else quoted = false
      } else field += char
      continue
    }
    if (char === '"' && field === '') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(field); field = ''
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
    } else field += char
  }
  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

const headerAliases: Record<string, keyof CsvContactRow> = {
  id: 'sourceId', sourceid: 'sourceId', externalid: 'sourceId', contactid: 'sourceId', legacyid: 'sourceId',
  type: 'contactType', contacttype: 'contactType',
  firstname: 'firstName', first: 'firstName', givenname: 'firstName', forename: 'firstName',
  lastname: 'lastName', last: 'lastName', surname: 'lastName', familyname: 'lastName',
  organization: 'organizationName', organisation: 'organizationName', organizationname: 'organizationName', organisationname: 'organizationName', company: 'organizationName', companyname: 'organizationName', firm: 'organizationName', business: 'organizationName',
  email: 'email', emailaddress: 'email', primaryemail: 'email', mail: 'email',
  phone: 'phone', phonenumber: 'phone', primaryphone: 'phone', mobile: 'phone', telephone: 'phone', cell: 'phone',
  status: 'status', contactstatus: 'status',
}

const statusAliases: Record<string, string> = {
  prospect: 'prospective_client', prospective: 'prospective_client', prospectiveclient: 'prospective_client', lead: 'prospective_client',
  client: 'client', current: 'client', currentclient: 'client', active: 'client',
  former: 'former_client', formerclient: 'former_client', past: 'former_client', inactive: 'former_client',
  opposing: 'opposing', opposingparty: 'opposing', other: 'other',
}

const key = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '')

export function csvToContactRows(text: string): { rows: CsvContactRow[]; error: string | null; unknownColumns: string[] } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], error: 'Add a header row and at least one contact.', unknownColumns: [] }
  const header = table[0].map((name) => headerAliases[key(name)] ?? null)
  const unknownColumns = table[0].filter((_, index) => !header[index]).map((name) => name.trim()).filter(Boolean)
  if (!header.some((field) => field === 'firstName' || field === 'lastName' || field === 'organizationName')) {
    return { rows: [], error: 'Include a first name, last name or organization column.', unknownColumns }
  }
  const body = table.slice(1)
  if (body.length > MAX_CSV_ROWS) return { rows: [], error: `Import up to ${MAX_CSV_ROWS} contacts at a time.`, unknownColumns }
  const rows = body.map((cells) => {
    const values: Partial<Record<keyof CsvContactRow, string>> = {}
    header.forEach((field, index) => {
      const value = cells[index]?.trim()
      if (field && value && !values[field]) values[field] = value
    })
    const isOrganization = values.contactType
      ? key(values.contactType).startsWith('org') || key(values.contactType) === 'company'
      : Boolean(values.organizationName && !values.firstName && !values.lastName)
    const status = values.status ? statusAliases[key(values.status)] ?? values.status.toLowerCase().replace(/\s+/g, '_') : undefined
    const email = values.email?.toLowerCase()
    // A stable source ID lets the import refuse a row that was already imported.
    const sourceId = (values.sourceId
      ?? `csv:${email || [values.firstName, values.lastName, values.organizationName].filter(Boolean).join(' ').toLowerCase()}`).slice(0, 200)
    const row: CsvContactRow = { sourceId, contactType: isOrganization ? 'organization' : 'person' }
    if (values.firstName) row.firstName = values.firstName
    if (values.lastName) row.lastName = values.lastName
    if (values.organizationName) row.organizationName = values.organizationName
    if (email) row.email = email
    if (values.phone) row.phone = values.phone
    if (status) row.status = status
    return row
  })
  return { rows, error: null, unknownColumns }
}

export const CSV_TEMPLATE = 'First name,Last name,Organization,Email,Phone\nAvery,Morgan,,avery@example.com,+1 555 010 2000\n,,Northwind Holdings,legal@northwind.example,\n'
