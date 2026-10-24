'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { decimalToMinorUnits, formatMoneyLabel } from '@/features/platform/lib/money'

export type RefundActionState = { ok: boolean; message: string }

export type RefundablePayment = {
  id: string
  paymentNumber: string
  status: string
  paymentType: string
  currencyCode: string
  amountMinor: number
  refundableMinor: number
  payerName: string | null
  invoiceNumber: string | null
}

export type RefundRow = {
  id: string
  refundNumber: string
  status: string
  reason: string
  amountMinor: number
  currencyCode: string
  explanation: string | null
  requestedAt: string | null
  approvedAt: string | null
  failureReason: string | null
  requestedById: string | null
  requestedByName: string | null
  approvedByName: string | null
  paymentNumber: string | null
  invoiceNumber: string | null
}

export type RefundSetup = {
  payments: RefundablePayment[]
  refunds: RefundRow[]
  viewerId: string | null
  timeZone: string
}

const REASONS = ['overpayment', 'duplicate', 'matter_closed', 'client_request', 'other']
const OPEN_REFUND_STATUSES = ['requested', 'approved', 'processing']
const ID = /^[A-Za-z0-9_-]{1,200}$/

type PaymentRow = {
  id: string
  paymentNumber: string
  status: string
  paymentType: string
  amountMinor: number
  refundedMinor: number | null
  currencyCode: string
  payer: { displayName: string | null } | null
  invoice: { invoiceNumber: string } | null
  allocations: Array<{ amountMinor: number; allocationType: string }>
  refunds: Array<{ amountMinor: number; status: string }>
}

const paymentFields = `
  id paymentNumber status paymentType amountMinor refundedMinor currencyCode
  payer { displayName } invoice { invoiceNumber }
  allocations(take: 500) { amountMinor allocationType }
  refunds(take: 200) { amountMinor status }
`

// Mirrors requestRefund: captured amount less refunded, pending refunds and net allocations.
function refundable(payment: PaymentRow) {
  const allocated = payment.allocations.reduce((total, row) => total + (row.allocationType === 'reversal' ? -row.amountMinor : row.amountMinor), 0)
  const pending = payment.refunds.filter((row) => OPEN_REFUND_STATUSES.includes(row.status)).reduce((total, row) => total + row.amountMinor, 0)
  return payment.amountMinor - (payment.refundedMinor ?? 0) - pending - allocated
}

function toOption(payment: PaymentRow): RefundablePayment {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    status: payment.status,
    paymentType: payment.paymentType,
    currencyCode: payment.currencyCode,
    amountMinor: payment.amountMinor,
    refundableMinor: refundable(payment),
    payerName: payment.payer?.displayName ?? null,
    invoiceNumber: payment.invoice?.invoiceNumber ?? null,
  }
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function getRefundSetup(): Promise<{ success: true; data: RefundSetup } | { success: false; error: string }> {
  const [response, timeZone] = await Promise.all([
    keystoneClient<{
      payments: PaymentRow[]
      refunds: Array<Omit<RefundRow, 'requestedById' | 'requestedByName' | 'approvedByName' | 'paymentNumber' | 'invoiceNumber'> & {
        requestedBy: { id: string; name: string | null } | null
        approvedBy: { name: string | null } | null
        payment: { paymentNumber: string } | null
        invoice: { invoiceNumber: string } | null
      }>
      authenticatedItem: { id: string } | null
    }>(`
      query RefundSetup {
        payments(where: { status: { in: [captured, settled] } }, orderBy: [{ createdAt: desc }, { id: asc }], take: 100) { ${paymentFields} }
        refunds(orderBy: [{ requestedAt: desc }, { id: asc }], take: 50) {
          id refundNumber status reason amountMinor currencyCode explanation requestedAt approvedAt failureReason
          requestedBy { id name } approvedBy { name } payment { paymentNumber } invoice { invoiceNumber }
        }
        authenticatedItem { ... on User { id } }
      }
    `),
    getFirmTimeZone(),
  ])
  if (!response.success) return { success: false, error: 'Refunds could not be loaded. Check payment permission.' }
  return {
    success: true,
    data: {
      payments: response.data.payments.map(toOption).filter((payment) => payment.refundableMinor > 0),
      refunds: response.data.refunds.map(({ requestedBy, approvedBy, payment, invoice, ...row }) => ({
        ...row,
        requestedById: requestedBy?.id ?? null,
        requestedByName: requestedBy?.name ?? null,
        approvedByName: approvedBy?.name ?? null,
        paymentNumber: payment?.paymentNumber ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
      })),
      viewerId: response.data.authenticatedItem?.id ?? null,
      timeZone,
    },
  }
}

function revalidateBilling() {
  revalidatePath('/dashboard/platform/billing')
}

export async function requestPaymentRefund(_previous: RefundActionState, formData: FormData): Promise<RefundActionState> {
  try {
    const idempotencyKey = field(formData, 'idempotencyKey')
    if (!/^[A-Za-z0-9:_-]{12,160}$/.test(idempotencyKey)) return { ok: false, message: 'Reload the page and try again.' }
    const paymentId = field(formData, 'paymentId')
    const reason = field(formData, 'reason')
    const explanation = field(formData, 'explanation')
    if (!ID.test(paymentId)) return { ok: false, message: 'Choose a payment.' }
    if (!REASONS.includes(reason)) return { ok: false, message: 'Choose a refund reason.' }
    if (explanation.length < 10 || explanation.length > 4000) return { ok: false, message: 'Explanation must be between 10 and 4,000 characters.' }

    const loaded = await keystoneClient<{ payment: PaymentRow | null }>(`
      query RefundPayment($id: ID!) { payment(where: { id: $id }) { ${paymentFields} } }
    `, { id: paymentId })
    if (!loaded.success) return { ok: false, message: 'The payment could not be loaded.' }
    const payment = loaded.data.payment
    if (!payment || !['captured', 'settled'].includes(payment.status)) return { ok: false, message: 'Only a captured or settled payment can be refunded.' }
    const amountMinor = decimalToMinorUnits(field(formData, 'amount'), payment.currencyCode)
    if (amountMinor <= 0) return { ok: false, message: 'Amount must be greater than zero.' }
    if (amountMinor > 2_147_483_647) return { ok: false, message: 'The amount is too large.' }
    const available = refundable(payment)
    // A replayed attempt was already counted as pending; let the command confirm the replay.
    const replay = await keystoneClient<{ count: number }>(`query RefundReplay($key: String!) { count: refundsCount(where: { idempotencyKey: { equals: $key } }) }`, { key: idempotencyKey })
    const isReplay = replay.success && replay.data.count > 0
    if (!isReplay && amountMinor > available) {
      return { ok: false, message: available > 0
        ? `Only ${formatMoneyLabel(available, payment.currencyCode)} of ${payment.paymentNumber} is refundable (unallocated and not already requested).`
        : `${payment.paymentNumber} has nothing refundable. Reverse its allocations first.` }
    }

    const response = await keystoneClient<{ requestRefund: { refund: { refundNumber: string }; replayed: boolean } }>(`
      mutation RequestRefund($paymentId: ID!, $amountMinor: Int!, $reason: String!, $explanation: String!, $idempotencyKey: String!) {
        requestRefund(paymentId: $paymentId, amountMinor: $amountMinor, reason: $reason, explanation: $explanation, idempotencyKey: $idempotencyKey) {
          refund { refundNumber } replayed
        }
      }
    `, { paymentId, amountMinor, reason, explanation, idempotencyKey })
    if (!response.success) return { ok: false, message: 'The refund was not requested. Check payment permission and billing access on the matter.' }
    revalidateBilling()
    const { refund, replayed } = response.data.requestRefund
    return { ok: true, message: `${replayed ? 'Already requested' : 'Requested'}: ${refund.refundNumber} for ${formatMoneyLabel(amountMinor, payment.currencyCode)} from ${payment.paymentNumber}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The refund was not requested.' }
  }
}

export async function reviewPaymentRefund(_previous: RefundActionState, formData: FormData): Promise<RefundActionState> {
  try {
    const refundId = field(formData, 'refundId')
    const decision = field(formData, 'decision')
    const reason = field(formData, 'reason')
    if (!ID.test(refundId)) return { ok: false, message: 'Reload the page and try again.' }
    if (decision !== 'approve' && decision !== 'cancel') return { ok: false, message: 'Choose approve or reject.' }
    if (reason.length < 5 || reason.length > 2000) return { ok: false, message: 'Review reason must be between 5 and 2,000 characters.' }

    const loaded = await keystoneClient<{ refund: { refundNumber: string; status: string; requestedBy: { id: string } | null } | null; authenticatedItem: { id: string } | null }>(`
      query RefundForReview($id: ID!) {
        refund(where: { id: $id }) { refundNumber status requestedBy { id } }
        authenticatedItem { ... on User { id } }
      }
    `, { id: refundId })
    if (!loaded.success || !loaded.data.refund) return { ok: false, message: 'Refund was not found.' }
    const refund = loaded.data.refund
    if (refund.status !== 'requested') return { ok: false, message: `${refund.refundNumber} is no longer awaiting review.` }
    if (decision === 'approve' && refund.requestedBy?.id && refund.requestedBy.id === loaded.data.authenticatedItem?.id) {
      return { ok: false, message: 'A different person must approve a refund you requested.' }
    }

    const response = await keystoneClient<{ reviewRefund: { refund: { refundNumber: string; status: string } } }>(`
      mutation ReviewRefund($refundId: ID!, $decision: String!, $reason: String!) {
        reviewRefund(refundId: $refundId, decision: $decision, reason: $reason) { refund { refundNumber status } }
      }
    `, { refundId, decision, reason })
    if (!response.success) return { ok: false, message: 'The review was not recorded. Check payment permission and matter access.' }
    revalidateBilling()
    return { ok: true, message: `${refund.refundNumber} ${decision === 'approve' ? 'approved' : 'rejected'}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The review was not recorded.' }
  }
}
