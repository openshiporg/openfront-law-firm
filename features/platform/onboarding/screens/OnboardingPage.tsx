import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout'
import { getSyntheticSeedAvailability } from '../actions/onboarding'
import { FirmSetupForm } from '../components/FirmSetupForm'
import { leaveFinishedFirmOnboarding } from '../lib/firmOnboarding'
export async function OnboardingPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams
  await leaveFinishedFirmOnboarding(Array.isArray(from) ? from[0] : from)
  const result = await getAuthenticatedUser()
  const user = result.success ? result.data.authenticatedItem : null
  // Preflight only: the onboarding command still enforces fixture admission itself.
  const offlineSampleAvailable = await getSyntheticSeedAvailability()
  return <DashboardLayout adminMeta={null} authenticatedItem={user}><FirmSetupForm offlineSampleAvailable={offlineSampleAvailable} /></DashboardLayout>
}
