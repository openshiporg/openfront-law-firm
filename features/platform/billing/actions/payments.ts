'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { zonedWallTimeToInstant } from '@/features/platform/lib/datetime'
import { decimalToMinorUnits, formatMoneyLabel } from '@/features/platform/lib/money'

export type PaymentActionState = { ok: boolean; message: string }

export type OpenInvoiceOption = {
  id: string
  invoiceNumber: string
  status: string
  balanceDueMinor: number
  currencyCode: string
  client: { id: string; displayName: string } | null
  matter: { matterNumber: string } | null
}

export type UnallocatedPaymentOption = {
  id: string
  paymentNumber: string
  currencyCode: string
  remainingMinor: number
  payerName: string | null
}

export type PaymentSetup = {
  invoices: OpenInvoiceOption[]
  payments: UnallocatedPaymentOption[]
  today: string
}

const PAYMENT_METHODS = ['check', 'ach', 'wire', 'cash', 'card', 'other']

type PaymentRow = {
  id: string
  paymentNumber: string
  amountMinor: number
  refundedMinor: number | null
  currencyCode: string
  payer: { displayName: string | null } | null
  allocations: Array<{ amountMinor: number; allocationType: string }>
}

function remaining(payment: PaymentRow) {
  const allocated = payment.allocations.reduce((total, row) => total + (row.allocationType === 'reversal' ? -row.amountMinor : row.amountMinor), 0)
  return payment.amountMinor - (payment.refundedMinor ?? 0) - allocated
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

async function firmToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: await getFirmTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function revalidateBilling() {
  revalidatePath('/dashboard/platform/billing')
}

export async function getPaymentSetup(): Promise<{ success: true; data: PaymentSetup } | { success: false; error: string }> {
  const response = await keystoneClient<{ invoices: OpenInvoiceOption[]; payments: PaymentRow[] }>(`
    query PaymentSetup {
      invoices(where: { status: { in: [issued, partially_paid, overdue] }, balanceDueMinor: { gt: 0 } }, orderBy: [{ dueAt: asc }, { id: asc }], take: 100) {
        id invoiceNumber status balanceDueMinor currencyCode client { id displayName } matter { matterNumber }
      }
      payments(where: { status: { in: [captured, settled] }, paymentType: { equals: operating } }, orderBy: [{ createdAt: desc }, { id: asc }], take: 100) {
        id paymentNumber amountMinor refundedMinor currencyCode payer { displayName }
        allocations(take: 200) { amountMinor allocationType }
      }
    }
  `)
  if (!response.success) return { success: false, error: response.error }
  return {
    success: true,
    data: {
      invoices: response.data.invoices,
      payments: response.data.payments
        .map((payment) => ({ id: payment.id, paymentNumber: payment.paymentNumber, currencyCode: payment.currencyCode, remainingMinor: remaining(payment), payerName: payment.payer?.displayName ?? null }))
        .filter((payment) => payment.remainingMinor > 0),
      today: await firmToday(),
    },
  }
}

async function loadOpenInvoice(invoiceId: string) {
  const response = await keystoneClient<{ invoice: OpenInvoiceOption | null }>(`
    query PaymentInvoice($id: ID!) {
      invoice(where: { id: $id }) { id invoiceNumber status balanceDueMinor currencyCode client { id displayName } matter { matterNumber } }
    }
  `, { id: invoiceId })
  if (!response.success) return { error: response.error }
  const invoice = response.data.invoice
  if (!invoice) return { error: 'Choose an invoice you can access.' }
  if (!['issued', 'partially_paid', 'overdue'].includes(invoice.status) || invoice.balanceDueMinor <= 0) {
    return { error: `Invoice ${invoice.invoiceNumber} has no open balance.` }
  }
  return { invoice }
}

async function allocate(paymentId: string, invoiceId: string, amountMinor: number, idempotencyKey: string) {
  return keystoneClient<{ allocatePayment: { allocation: { id: string }; replayed: boolean } }>(`
    mutation AllocateRecordedPayment($paymentId: ID!, $invoiceId: ID!, $amountMinor: Int!, $idempotencyKey: String!) {
      allocatePayment(paymentId: $paymentId, invoiceId: $invoiceId, amountMinor: $amountMinor, idempotencyKey: $idempotencyKey) { allocation { id } replayed }
    }
  `, { paymentId, invoiceId, amountMinor, idempotencyKey })
}

function operationKey(formData: FormData) {
  const key = field(formData, 'idempotencyKey')
  return /^[A-Za-z0-9:_-]{12,120}$/.test(key) ? key : null
}

// Books a receipt against one open issued invoice and allocates it in full. Both steps
// carry keys derived from one form attempt, so a resubmitted attempt replays instead of
// recording the money twice.
export async function recordPayment(_previous: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  try {
    const key = operationKey(formData)
    if (!key) return { ok: false, message: 'Reload the page and try again.' }
    const invoiceId = field(formData, 'invoiceId')
    const method = field(formData, 'method')
    const receivedDate = field(formData, 'receivedDate')
    const reference = field(formData, 'reference')
    if (!invoiceId || invoiceId.length > 200) return { ok: false, message: 'Choose an invoice.' }
    if (!PAYMENT_METHODS.includes(method)) return { ok: false, message: 'Choose a payment method.' }
    if (reference.length > 200) return { ok: false, message: 'Reference must be 200 characters or fewer.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) return { ok: false, message: 'Received date is required.' }
    if (receivedDate > await firmToday()) return { ok: false, message: 'Received date cannot be in the future.' }
    const receivedAt = zonedWallTimeToInstant(`${receivedDate}T12:00`, await getFirmTimeZone())
    if (!receivedAt) return { ok: false, message: 'Received date is not a valid date.' }

    const loaded = await loadOpenInvoice(invoiceId)
    if ('error' in loaded) return { ok: false, message: loaded.error ?? 'Choose an invoice.' }
    const { invoice } = loaded
    const amountMinor = decimalToMinorUnits(field(formData, 'amount'), invoice.currencyCode)
    if (amountMinor <= 0) return { ok: false, message: 'Amount must be greater than zero.' }
    if (amountMinor > invoice.balanceDueMinor) {
      return { ok: false, message: `Amount exceeds the ${formatMoneyLabel(invoice.balanceDueMinor, invoice.currencyCode)} balance of ${invoice.invoiceNumber}.` }
    }
    const payerId = field(formData, 'payerId') || invoice.client?.id || ''
    if (!payerId || payerId.length > 200) return { ok: false, message: 'Choose the payer.' }

    const recorded = await keystoneClient<{ recordManualPayment: { payment: { id: string; paymentNumber: string }; replayed: boolean } }>(`
      mutation RecordManualPayment(
        $idempotencyKey: String!, $payerId: ID!, $invoiceId: ID, $amountMinor: Int!, $currencyCode: String!,
        $method: String!, $receivedAt: DateTime!, $reference: String
      ) {
        recordManualPayment(
          idempotencyKey: $idempotencyKey, payerId: $payerId, invoiceId: $invoiceId, amountMinor: $amountMinor,
          currencyCode: $currencyCode, method: $method, receivedAt: $receivedAt, reference: $reference
        ) { payment { id paymentNumber } replayed }
      }
    `, {
      idempotencyKey: key,
      payerId,
      invoiceId: invoice.id,
      amountMinor,
      currencyCode: invoice.currencyCode,
      method,
      receivedAt: receivedAt.toISOString(),
      reference,
    })
    if (!recorded.success) return { ok: false, message: 'The payment was not recorded. Check payment permission and matter access.' }
    const payment = recorded.data.recordManualPayment.payment
    revalidateBilling()
    const allocation = await allocate(payment.id, invoice.id, amountMinor, `${key}-allocation`)
    if (!allocation.success) return { ok: false, message: `Payment ${payment.paymentNumber} recorded but not allocated.` }
    return { ok: true, message: `${formatMoneyLabel(amountMinor, invoice.currencyCode)} recorded as ${payment.paymentNumber} and applied to ${invoice.invoiceNumber}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The payment was not recorded.' }
  }
}

export async function allocateExistingPayment(_previous: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  try {
    const key = operationKey(formData)
    if (!key) return { ok: false, message: 'Reload the page and try again.' }
    const paymentId = field(formData, 'paymentId')
    const invoiceId = field(formData, 'invoiceId')
    if (!paymentId || paymentId.length > 200) return { ok: false, message: 'Choose a payment.' }
    if (!invoiceId || invoiceId.length > 200) return { ok: false, message: 'Choose an invoice.' }
    const [loaded, paymentResponse] = await Promise.all([
      loadOpenInvoice(invoiceId),
      keystoneClient<{ payment: (PaymentRow & { status: string; paymentType: string }) | null }>(`
        query AllocationPayment($id: ID!) {
          payment(where: { id: $id }) {
            id paymentNumber status paymentType amountMinor refundedMinor currencyCode payer { displayName }
            allocations(take: 200) { amountMinor allocationType }
          }
        }
      `, { id: paymentId }),
    ])
    if ('error' in loaded) return { ok: false, message: loaded.error ?? 'Choose an invoice.' }
    if (!paymentResponse.success) return { ok: false, message: paymentResponse.error }
    const payment = paymentResponse.data.payment
    if (!payment || !['captured', 'settled'].includes(payment.status) || payment.paymentType !== 'operating') {
      return { ok: false, message: 'Choose a received operating payment.' }
    }
    const { invoice } = loaded
    if (payment.currencyCode !== invoice.currencyCode) return { ok: false, message: 'Payment and invoice currencies must match.' }
    const amountMinor = decimalToMinorUnits(field(formData, 'amount'), invoice.currencyCode)
    const available = remaining(payment)
    if (amountMinor <= 0) return { ok: false, message: 'Amount must be greater than zero.' }
    if (amountMinor > available) return { ok: false, message: `Only ${formatMoneyLabel(available, payment.currencyCode)} of ${payment.paymentNumber} is unallocated.` }
    if (amountMinor > invoice.balanceDueMinor) return { ok: false, message: `Amount exceeds the ${formatMoneyLabel(invoice.balanceDueMinor, invoice.currencyCode)} balance of ${invoice.invoiceNumber}.` }
    const response = await allocate(payment.id, invoice.id, amountMinor, key)
    if (!response.success) return { ok: false, message: 'The allocation was not recorded. Check payment permission and matter access.' }
    revalidateBilling()
    return { ok: true, message: `${formatMoneyLabel(amountMinor, invoice.currencyCode)} of ${payment.paymentNumber} applied to ${invoice.invoiceNumber}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The allocation was not recorded.' }
  }
}
