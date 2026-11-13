import { getAuthenticatedUser } from '@/features/dashboard/actions/auth'
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout'
import { FirmSetupForm } from '../components/FirmSetupForm'
import { leaveFinishedFirmOnboarding } from '../lib/firmOnboarding'
export async function OnboardingPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams
  await leaveFinishedFirmOnboarding(Array.isArray(from) ? from[0] : from)
  const result = await getAuthenticatedUser()
  const user = result.success ? result.data.authenticatedItem : null
  return <DashboardLayout adminMeta={null} authenticatedItem={user}><FirmSetupForm /></DashboardLayout>
}
