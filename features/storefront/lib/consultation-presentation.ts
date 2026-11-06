/** Browser-safe appointment DTOs and display helpers. No server/client transport,
 * request headers, cookies or provider configuration may be imported here. */
export type Service = { id: string; code: string; publicSlug: string; name: string; description: string; consultationFeeMinor: number; consultationMinutes: number; currencyCode: string }
export type CustomerConsultation = { id: string; serviceTitle: string; feeMinor: number; currencyCode: string; status: string; startsAt: string | null; endsAt: string | null; timezone: string; paymentState?: string }
export type AvailabilitySlot = { startsAt: string; endsAt: string }
export type ServiceAvailability = { timezone: string; slots: AvailabilitySlot[] }

const appointmentLabels: Record<string, { label: string; tone: string }> = {
  requested: { label: 'Awaiting confirmation', tone: 'sf-dot--amber' },
  scheduled: { label: 'Scheduled', tone: 'sf-dot--green' },
  completed: { label: 'Completed', tone: 'sf-dot--slate' },
  cancelled: { label: 'Cancelled', tone: 'sf-dot--red' },
  no_show: { label: 'No show', tone: 'sf-dot--red' },
}
export function appointmentStatus(status: string) {
  return appointmentLabels[status] ?? { label: status.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase()) || 'Unknown', tone: 'sf-dot--slate' }
}
export function appointmentPaymentState(row: Pick<CustomerConsultation, 'feeMinor' | 'status' | 'paymentState'>) {
  if (row.feeMinor <= 0) return 'No consultation fee'
  if (row.paymentState === 'paid') return 'Paid by card'
  if (row.paymentState === 'refunded') return 'Refunded to your card'
  if (row.paymentState === 'due') return 'Due now — pay to hold this time'
  if (row.status === 'cancelled') return 'Cancelled — no payment collected'
  return 'Not paid'
}
/** One-line notice under the appointment facts. */
export function appointmentNotice(row: Pick<CustomerConsultation, 'feeMinor' | 'status' | 'paymentState'>) {
  if (row.paymentState === 'due') return 'Pay the consultation fee to hold this time. Unpaid requests are released after 30 minutes.'
  if (row.paymentState === 'refunded') return 'This consultation was cancelled and the fee was refunded to your card.'
  if (row.status === 'requested') return row.paymentState === 'paid' ? 'Fee received. The firm runs a conflict check before confirming.' : 'The firm runs a conflict check before confirming. No payment is collected online.'
  if (row.paymentState === 'paid') return 'Fee received. Cancel before it starts for a full refund.'
  return 'No payment is collected online.'
}
export function formatAppointmentTime(value: string | null, timezone: string) {
  if (!value) return 'Time to be confirmed'
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return 'Time unavailable'
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(instant)
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(instant)
  }
}
export const CONSULTATION_HOURS_LABEL = 'Weekdays 9:00–17:00, office time'
