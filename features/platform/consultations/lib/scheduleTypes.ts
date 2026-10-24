export type ConsultationSchedule = {
  id: string
  status: string
  startsAt: string | null
  endsAt: string | null
  timezone: string | null
  location: string | null
  host: { id: string; name: string | null } | null
  office: { id: string; name: string | null; code: string | null } | null
}

/** Statuses from which scheduleConsultation can place or move the consultation. */
export const SCHEDULABLE_STATUSES = ['requested', 'scheduled']
