'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { formatInstant } from '@/features/platform/lib/datetime'

import { loadActiveHourlyRules, priceEntries } from '../lib/loadRateRules'

export type BillingMatterOption = {
  id: string
  matterNumber: string
  title: string
  status: string
  client: { id: string; displayName: string } | null
}

export type BillingTimeSource = {
  id: string
  workDate: string
  durationMinutes: number
  description: string
  amountMinor: number | null
  currencyCode: string
  isBillable: boolean
  matter: { id: string; matterNumber: string }
  invoiceLine: { id: string } | null
}

export type BillingExpenseSource = {
  id: string
  incurredAt: string
  description: string
  amountMinor: number
  currencyCode: string
  isBillable: boolean
  matter: { id: string; matterNumber: string }
  invoiceLine: { id: string } | null
}

export type BillingAssemblySetup = {
  matters: BillingMatterOption[]
  suggestedInvoiceNumber: string
}

export type InvoiceAssemblyState = { ok: boolean; message: string; unpricedIds?: string[] }

export type MatterBillingSources = {
  timeEntries: BillingTimeSource[]
  expenses: BillingExpenseSource[]
  timeTotal: number
  expenseTotal: number
}

const BILLING_SOURCE_PAGE = 100
const MATTER_SEARCH_LIMIT = 25
const eligibleSource = 'status: { equals: approved }, isBillable: { equals: true }, invoiceLine: null'
const matterFields = 'id matterNumber title status client { id displayName }'

// Suggested matters come from the oldest approved, billable, unbilled sources, so every
// suggestion is genuinely billable. Any other matter is reachable through search.
export async function getBillingAssemblySetup() {
  const response = await keystoneClient<{
    timeEntries: Array<{ matter: BillingMatterOption | null }>
    expenses: Array<{ matter: BillingMatterOption | null }>
  }>(`
    query BillingAssemblySetup {
      timeEntries(where: { status: { equals: approved }, isBillable: { equals: true }, invoiceLine: null }, orderBy: [{ workDate: asc }, { id: asc }], take: 100) {
        matter { id matterNumber title status client { id displayName } }
      }
      expenses(where: { status: { equals: approved }, isBillable: { equals: true }, invoiceLine: null }, orderBy: [{ incurredAt: asc }, { id: asc }], take: 100) {
        matter { id matterNumber title status client { id displayName } }
      }
    }
  `)
  if (!response.success) return response
  const matters = new Map<string, BillingMatterOption>()
  for (const row of [...response.data.timeEntries, ...response.data.expenses]) {
    if (row.matter?.client && ['open', 'on_hold', 'closing'].includes(row.matter.status)) matters.set(row.matter.id, row.matter)
  }
  return { success: true as const, data: { matters: [...matters.values()], suggestedInvoiceNumber: await suggestInvoiceNumber() } }
}

// Next number in the firm's INV-YYYY-NNNN sequence for the current year in the firm time
// zone, from the invoices the viewer can read. It is a suggestion: staff may edit it, and
// assembly still rejects a number that is already used.
async function suggestInvoiceNumber() {
  const year = new Intl.DateTimeFormat('en', { timeZone: await getFirmTimeZone(), year: 'numeric' }).format(new Date())
  const prefix = `INV-${year}-`
  const response = await keystoneClient<{ invoices: Array<{ invoiceNumber: string }> }>(`
    query InvoiceNumberSequence($prefix: String!) {
      invoices(where: { invoiceNumber: { startsWith: $prefix } }, orderBy: [{ createdAt: desc }, { id: asc }], take: 100) { invoiceNumber }
    }
  `, { prefix })
  let highest = 0
  if (response.success) {
    for (const { invoiceNumber } of response.data.invoices) {
      const match = /^INV-\d{4}-(\d+)$/.exec(invoiceNumber)
      if (match) highest = Math.max(highest, Number(match[1]))
    }
  }
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

export async function searchBillingMatters(query: string): Promise<{ success: true; data: BillingMatterOption[] } | { success: false; error: string }> {
  const q = String(query ?? '').trim().slice(0, 100)
  if (!q) return { success: true, data: [] }
  const response = await keystoneClient<{ matters: BillingMatterOption[] }>(`
    query BillingMatterSearch($q: String!, $take: Int!) {
      matters(
        where: {
          status: { in: [open, on_hold, closing] }
          OR: [{ matterNumber: { contains: $q, mode: insensitive } }, { title: { contains: $q, mode: insensitive } }]
        }
        orderBy: [{ updatedAt: desc }, { id: asc }]
        take: $take
      ) { ${matterFields} }
    }
  `, { q, take: MATTER_SEARCH_LIMIT })
  if (!response.success) return { success: false, error: response.error }
  return { success: true, data: response.data.matters.filter((matter) => matter.client) }
}

// Sources for exactly one matter, oldest first. One draft takes at most 200 sources, so a
// matter with more is billed across successive drafts; the counts make that explicit.
export async function loadMatterBillingSources(matterId: string): Promise<{ success: true; data: MatterBillingSources } | { success: false; error: string }> {
  const id = String(matterId ?? '').trim()
  if (!id || id.length > 200) return { success: false, error: 'Select a matter.' }
  const where = `{ matter: { id: { equals: $matterId } }, ${eligibleSource} }`
  const response = await keystoneClient<{
    timeEntries: BillingTimeSource[]
    expenses: BillingExpenseSource[]
    timeEntriesCount: number
    expensesCount: number
  }>(`
    query MatterBillingSources($matterId: ID!, $take: Int!) {
      timeEntries(where: ${where}, orderBy: [{ workDate: asc }, { id: asc }], take: $take) {
        id workDate durationMinutes description amountMinor currencyCode isBillable
        matter { id matterNumber }
        invoiceLine { id }
      }
      timeEntriesCount(where: ${where})
      expenses(where: ${where}, orderBy: [{ incurredAt: asc }, { id: asc }], take: $take) {
        id incurredAt description amountMinor currencyCode isBillable
        matter { id matterNumber }
        invoiceLine { id }
      }
      expensesCount(where: ${where})
    }
  `, { matterId: id, take: BILLING_SOURCE_PAGE })
  if (!response.success) return { success: false, error: response.error }
  return {
    success: true,
    data: {
      timeEntries: response.data.timeEntries,
      expenses: response.data.expenses,
      timeTotal: response.data.timeEntriesCount,
      expenseTotal: response.data.expensesCount,
    },
  }
}

export async function assembleInvoice(
  _previous: InvoiceAssemblyState,
  formData: FormData,
): Promise<InvoiceAssemblyState> {
  const matterId = String(formData.get('matterId') ?? '').trim()
  const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim()
  const selected = formData.getAll('source').map(String)
  const timeEntryIds = selected.filter((value) => value.startsWith('time:')).map((value) => value.slice(5))
  const expenseIds = selected.filter((value) => value.startsWith('expense:')).map((value) => value.slice(8))
  if (!matterId || !invoiceNumber) return { ok: false, message: 'Matter and invoice number are required.' }
  if (!selected.length || selected.length > 100) return { ok: false, message: 'Select between 1 and 100 approved sources.' }
  if (invoiceNumber.length > 120 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(invoiceNumber)) {
    return { ok: false, message: 'Invoice number must be 120 characters or fewer and use letters, numbers, dot, slash, underscore, or hyphen.' }
  }

  const matter = await keystoneClient<{ matter: { client: { id: string } | null } | null }>(`
    query InvoiceMatterClient($matterId: ID!) {
      matter(where: { id: $matterId }) { client { id } }
    }
  `, { matterId })
  if (!matter.success || !matter.data.matter?.client?.id) {
    return { ok: false, message: matter.success ? 'The selected matter has no authorized client.' : matter.error }
  }
  const clientId = matter.data.matter.client.id

  // The shared GraphQL client replaces every server error with a generic message, so the
  // conditions staff can fix are checked here first and named exactly.
  const precheck = await keystoneClient<{
    timeEntries: Array<{ id: string; description: string; workDate: string; durationMinutes: number; amountMinor: number | null }>
    invoicesCount: number
  }>(`
    query InvoiceAssemblyPrecheck($ids: [ID!], $invoiceNumber: String!) {
      timeEntries(where: { id: { in: $ids } }, take: 100) { id description workDate durationMinutes amountMinor }
      invoicesCount(where: { invoiceNumber: { equals: $invoiceNumber, mode: insensitive } })
    }
  `, { ids: timeEntryIds, invoiceNumber })
  if (!precheck.success) return { ok: false, message: precheck.error }
  if (precheck.data.invoicesCount > 0) return { ok: false, message: `Invoice number ${invoiceNumber} is already used.` }
  // Approved time with no amount is priced during assembly; only time no active rate
  // covers blocks the draft.
  const missing = precheck.data.timeEntries.filter((entry) => entry.amountMinor === null)
  let unpriced = missing
  if (missing.length) {
    const [rules, sources] = await Promise.all([
      loadActiveHourlyRules(),
      keystoneClient<{ timeEntries: Array<{ id: string; durationMinutes: number; workDate: string; user: { id: string } | null; matter: { id: string; practiceArea: { id: string } | null } | null }> }>(`
        query UnpricedAssemblySources($ids: [ID!]) { timeEntries(where: { id: { in: $ids } }, take: 100) { id durationMinutes workDate user { id } matter { id practiceArea { id } } } }
      `, { ids: missing.map((entry) => entry.id) }),
    ])
    if (rules.success && sources.success) {
      const priced = priceEntries(rules.data.rateRules, sources.data.timeEntries)
      unpriced = missing.filter((entry) => !priced.has(entry.id))
    }
  }
  if (unpriced.length) {
    const timeZone = await getFirmTimeZone()
    const named = unpriced.slice(0, 5).map((entry) => `"${entry.description.slice(0, 60)}" (${formatInstant(entry.workDate, timeZone, { includeTime: false })}, ${entry.durationMinutes} min)`).join(', ')
    const more = unpriced.length > 5 ? ` and ${unpriced.length - 5} more` : ''
    return { ok: false, message: `Set a rate for this time before billing it: ${named}${more}.`, unpricedIds: unpriced.map((entry) => entry.id) }
  }

  const response = await keystoneClient<{ assembleDraftInvoice: { invoice: { id: string; status: string; invoiceNumber: string }; replayed: boolean } }>(`
    mutation AssembleInvoice(
      $idempotencyKey: String!
      $invoiceNumber: String!
      $matterId: ID!
      $clientId: ID!
      $timeEntryIds: [ID!]
      $expenseIds: [ID!]
    ) {
      assembleDraftInvoice(
        idempotencyKey: $idempotencyKey
        invoiceNumber: $invoiceNumber
        matterId: $matterId
        clientId: $clientId
        timeEntryIds: $timeEntryIds
        expenseIds: $expenseIds
      ) { invoice { id status invoiceNumber } replayed }
    }
  `, {
    idempotencyKey: `billing-ui:${invoiceNumber.toLowerCase()}`,
    invoiceNumber,
    matterId,
    clientId,
    timeEntryIds,
    expenseIds,
  })
  if (!response.success) return { ok: false, message: 'The draft was not assembled. Reload the sources and try again.' }
  revalidatePath('/dashboard/platform/billing')
  return { ok: true, message: `Draft ${response.data.assembleDraftInvoice.invoice.invoiceNumber} assembled.` }
}
