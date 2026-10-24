import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import type { FirmDefaults, FirmSetup, OfficeRow } from './firmTypes'

export async function getFirmSetup(): Promise<FirmSetup> {
  const response = await keystoneClient<{ firms: FirmDefaults[]; offices: OfficeRow[]; officesCount: number }>(`
    query FirmSetup {
      firms(take: 1) { id name slug status defaultTimezone defaultCurrency }
      offices(orderBy: [{ name: asc }, { id: asc }], take: 100) { id name code status timezone email phone }
      officesCount
    }
  `)
  if (!response.success) return { status: 'error', message: 'Firm settings could not be loaded. Viewing offices requires people access.' }
  const firm = response.data.firms?.[0]
  if (!firm) return { status: 'error', message: 'No active firm.' }
  return { status: 'loaded', firm, offices: response.data.offices ?? [], officesTotal: response.data.officesCount ?? 0 }
}
