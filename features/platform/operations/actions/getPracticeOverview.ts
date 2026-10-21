'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import type { PracticeOverview, PracticeOverviewResponse } from '../types'

const query = `
  query PracticeOverview {
    practiceOverview {
      firmId
      firmName
      generatedAt
      metrics { key label value href }
      intakeQueue { id kind title subtitle status at href canAct }
      matterQueue { id kind title subtitle status at href canAct }
      workQueue { id kind title subtitle status at href canAct }
      billingQueue { id kind title subtitle status at href canAct }
      governanceQueue { id kind title subtitle status at href canAct }
    }
  }
`

export async function getPracticeOverview(): Promise<PracticeOverviewResponse> {
  const response = await keystoneClient<{ practiceOverview: PracticeOverview }>(query)
  if (!response.success) return { success: false, error: response.error }
  return { success: true, data: response.data.practiceOverview }
}
