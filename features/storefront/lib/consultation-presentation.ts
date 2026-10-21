/** Browser-safe appointment DTOs and display helpers. No server/client transport,
 * request headers, cookies or provider configuration may be imported here. */
export type Service = { id: string; code: string; publicSlug: string; name: string; description: string; consultationFeeMinor: number; consultationMinutes: number; currencyCode: string }
export type CustomerConsultation = { id: string; serviceTitle: string; feeMinor: number; currencyCode: string; status: string; startsAt: string | null; endsAt: string | null; timezone: string }
export type AvailabilitySlot = { startsAt: string; endsAt: string }
export type ServiceAvailability = { timezone: string; slots: AvailabilitySlot[] }

const appointmentLabels: Record<string, { label: string; tone: string }> = {
  requested: { label: 'Requested — awaiting confirmation', tone: 'bg-amber-600' },
  scheduled: { label: 'Scheduled', tone: 'bg-emerald-600' },
  completed: { label: 'Completed', tone: 'bg-slate-500' },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-700' },
  no_show: { label: 'No show', tone: 'bg-rose-700' },
}
export function appointmentStatus(status: string) {
  return appointmentLabels[status] ?? { label: status.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase()) || 'Unknown', tone: 'bg-slate-500' }
}
export function appointmentPaymentState(row: Pick<CustomerConsultation, 'feeMinor' | 'status'>) {
  if (row.feeMinor <= 0) return 'No consultation fee'
  if (row.status === 'cancelled') return 'Cancelled — no payment collected'
  return 'Not collected online — the firm will confirm how any fee is paid'
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
