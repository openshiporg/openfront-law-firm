'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

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
}

export type InvoiceAssemblyState = { ok: boolean; message: string }

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
  return { success: true as const, data: { matters: [...matters.values()] } }
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
  if (!selected.length || selected.length > 200) return { ok: false, message: 'Select between 1 and 200 approved sources.' }
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
  if (!response.success) return { ok: false, message: response.error }
  revalidatePath('/dashboard/platform/billing')
  return { ok: true, message: `Draft ${response.data.assembleDraftInvoice.invoice.invoiceNumber} assembled through the controlled source-locking workflow.` }
}
