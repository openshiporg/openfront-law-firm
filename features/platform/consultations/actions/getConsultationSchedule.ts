import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import type { ConsultationSchedule } from '../lib/scheduleTypes'

export async function getConsultationSchedule(consultationId: string): Promise<ConsultationSchedule | null> {
  const response = await keystoneClient<{ consultation: ConsultationSchedule | null }>(`
    query ConsultationSchedule($id: ID!) {
      consultation(where: { id: $id }) { id status startsAt endsAt timezone location host { id name } office { id name code } }
    }
  `, { id: consultationId })
  return response.success ? response.data.consultation : null
}
