'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { commandResult, formText, type CommandState } from '@/features/platform/components/commandState'
import { zonedWallTimeToInstant } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

import { SCHEDULABLE_STATUSES } from '../lib/scheduleTypes'

/** Schedules or reschedules a consultation at a firm-time wall clock with a host. */
export async function scheduleConsultationCommand(previous: CommandState, formData: FormData): Promise<CommandState> {
  try {
    const consultationId = formText(formData, 'consultationId', { label: 'Consultation', min: 1, max: 200 })
    const hostId = formText(formData, 'hostId', { label: 'Host', min: 1, max: 200 })
    const officeId = formText(formData, 'officeId', { label: 'Office', max: 200 })
    const location = formText(formData, 'location', { label: 'Location', max: 300 })
    const reason = formText(formData, 'reason', { label: 'Reason', max: 2000 })
    const minutes = Number(formData.get('durationMinutes'))
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) throw new Error('Duration must be between 5 minutes and 8 hours.')
    const zone = await getFirmTimeZone()
    const date = formText(formData, 'date', { label: 'Date', min: 1, max: 10 })
    const time = formText(formData, 'time', { label: 'Time', min: 1, max: 5 })
    const startsAt = zonedWallTimeToInstant(`${date}T${time}`, zone)
    if (!startsAt) throw new Error(`That date and time does not exist in ${zone}.`)
    const endsAt = new Date(startsAt.getTime() + minutes * 60_000)

    const check = await keystoneClient<{ consultation: { id: string; status: string } | null; overlapping: number }>(`
      query ScheduleCheck($id: ID!, $overlap: ConsultationWhereInput!) {
        consultation(where: { id: $id }) { id status }
        overlapping: consultationsCount(where: $overlap)
      }
    `, {
      id: consultationId,
      overlap: { id: { not: { equals: consultationId } }, host: { id: { equals: hostId } }, status: { in: ['requested', 'scheduled'] }, startsAt: { lt: endsAt.toISOString() }, endsAt: { gt: startsAt.toISOString() } },
    })
    if (!check.success || !check.data.consultation) throw new Error('This consultation is unavailable in your current access.')
    if (!SCHEDULABLE_STATUSES.includes(check.data.consultation.status)) throw new Error(`A ${check.data.consultation.status.replaceAll('_', ' ')} consultation cannot be scheduled.`)
    if (check.data.overlapping > 0) throw new Error('The host already has a consultation at that time.')
    const host = await keystoneClient<{ firmMembershipsCount: number }>(`
      query ScheduleHost($where: FirmMembershipWhereInput!) { firmMembershipsCount(where: $where) }
    `, { where: { user: { id: { equals: hostId } }, status: { equals: 'active' }, role: { canManageIntake: { equals: true } } } })
    if (host.success && host.data.firmMembershipsCount === 0) throw new Error('The host must be an active firm member who can take consultations.')

    const response = await keystoneClient<{ scheduleConsultation: { id: string; status: string } }>(`
      mutation ScheduleConsultation($consultationId: ID!, $startsAt: DateTime!, $endsAt: DateTime!, $hostId: ID!, $officeId: ID, $location: String, $reason: String) {
        scheduleConsultation(consultationId: $consultationId, startsAt: $startsAt, endsAt: $endsAt, hostId: $hostId, officeId: $officeId, location: $location, reason: $reason) { id status }
      }
    `, { consultationId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), hostId, officeId: officeId || null, location: location || null, reason: reason || null })
    if (!response.success) throw new Error('The consultation was not scheduled. Intake management permission is required, and the office must be active.')
    revalidatePath(`/dashboard/platform/work/consultation/${encodeURIComponent(consultationId)}`)
    revalidatePath('/dashboard/platform/work')
    revalidatePath('/dashboard/platform/intake')
    return commandResult(previous, true, check.data.consultation.status === 'scheduled' ? 'Consultation rescheduled.' : 'Consultation scheduled.')
  } catch (error) {
    return commandResult(previous, false, error instanceof Error ? error.message : 'The consultation was not scheduled.')
  }
}
