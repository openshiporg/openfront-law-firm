import { redirect } from 'next/navigation'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

// Ported from the pre-parity dashboard middleware: a signed-in viewer without an active firm finishes firm
// onboarding before using practice pages, and a viewer who already has one leaves onboarding. The shared
// proxy only checks sign-in and role access, so the platform slice enforces this on its own routes.
async function viewerNeedsFirmOnboarding(): Promise<boolean | null> {
  const response = await keystoneClient<{ viewerNeedsFirmOnboarding: boolean }>(`
    query ViewerNeedsFirmOnboarding { viewerNeedsFirmOnboarding }
  `)
  return response.success ? response.data.viewerNeedsFirmOnboarding : null
}

export async function requireFirmWorkspace() {
  if (await viewerNeedsFirmOnboarding()) redirect('/dashboard/onboarding')
}

// The continuation route sanitises `from` and sends viewers without dashboard access to no-access.
export async function leaveFinishedFirmOnboarding(from?: string) {
  if ((await viewerNeedsFirmOnboarding()) === false) {
    redirect(`/api/auth/continue?from=${encodeURIComponent(from || '/dashboard')}`)
  }
}
