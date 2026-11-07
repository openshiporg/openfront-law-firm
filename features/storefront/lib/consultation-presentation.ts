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

/** A visitor-facing time zone name, e.g. "Eastern Time (ET)"; the IANA id only as a last resort. */
export function timezoneLabel(timezone: string) {
  const part = (style: 'longGeneric' | 'shortGeneric') => {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: style }).formatToParts(new Date()).find((item) => item.type === 'timeZoneName')?.value ?? '' } catch { return '' }
  }
  const long = part('longGeneric'), short = part('shortGeneric')
  if (long && short && long !== short && !/^GMT[+-]/.test(short)) return `${long} (${short})`
  return long || timezone.replaceAll('_', ' ')
}

function zonedParts(value: string, timezone: string) {
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return null
  const format = (options: Intl.DateTimeFormatOptions) => {
    try { return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).formatToParts(instant) } catch { return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).formatToParts(instant) }
  }
  const parts = format({ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })
  const get = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return { weekday: get('weekday'), day: get('day'), month: get('month'), time: `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`.trim() }
}
/** "Thu 14 Nov" in the firm's time zone. */
export function slotDayLabel(value: string, timezone: string) {
  const parts = zonedParts(value, timezone)
  return parts ? `${parts.weekday} ${parts.day} ${parts.month}` : ''
}
/** "10:00 AM" in the firm's time zone. */
export function slotTimeLabel(value: string, timezone: string) {
  return zonedParts(value, timezone)?.time ?? ''
}
/** "Thu 14 Nov, 10:00 AM" in the firm's time zone. */
export function slotLabel(value: string, timezone: string) {
  const parts = zonedParts(value, timezone)
  return parts ? `${parts.weekday} ${parts.day} ${parts.month}, ${parts.time}` : 'Time unavailable'
}
/** Open times grouped by the firm's calendar day, in order. */
export function slotsByDay(slots: AvailabilitySlot[], timezone: string) {
  const days = new Map<string, AvailabilitySlot[]>()
  for (const slot of slots) {
    const day = slotDayLabel(slot.startsAt, timezone)
    if (day) days.set(day, [...(days.get(day) ?? []), slot])
  }
  return [...days.entries()].map(([day, list]) => ({ day, slots: list }))
}
/** A short, evenly spread choice from one day's open times, preferring on-the-hour starts. */
export function spreadTimes(slots: AvailabilitySlot[], timezone: string, count: number) {
  const onHour = slots.filter((slot) => slotTimeLabel(slot.startsAt, timezone).includes(':00'))
  const pool = onHour.length >= count ? onHour : slots
  if (pool.length <= count) return pool
  return Array.from({ length: count }, (_, index) => pool[Math.round(index * (pool.length - 1) / (count - 1))])
}
