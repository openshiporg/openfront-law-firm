import { cache } from 'react'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import { validTimeZone } from './datetime'

const firmTimeZoneQuery = `
  query FirmDisplayTimeZone {
    offices(where: { status: { equals: active } }, orderBy: [{ createdAt: asc }, { id: asc }], take: 1) {
      timezone
    }
  }
`

// The firm's first active office supplies the display zone for records that carry no
// zone of their own. Falls back to UTC (and says so) when no office zone is readable.
export const getFirmTimeZone = cache(async (): Promise<string> => {
  const response = await keystoneClient<{ offices: Array<{ timezone: string | null }> | null }>(firmTimeZoneQuery)
  if (!response.success) return 'UTC'
  return validTimeZone(response.data.offices?.[0]?.timezone) ?? 'UTC'
})
