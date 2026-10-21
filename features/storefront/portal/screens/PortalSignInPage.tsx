import type { Metadata } from 'next'
import { portalThemeStyle } from '../theme'
import Link from 'next/link'

import { FirmBrand } from '@/features/portal/FirmBrand'
import { getStorefrontSettings } from '@/features/storefront/lib/storefront-settings'
import { PortalSignInConfirmForm, PortalSignInRequestForm } from '../PortalSignInForm'

export const metadata: Metadata = { title: 'Client portal sign-in' }

export default async function PortalSignInPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  const signInToken = typeof token === 'string' ? token.slice(0, 512) : ''
  // Only the already-public storefront identity (or the neutral fallback) is shown.
  const published = await getStorefrontSettings()
  return (
    <main style={portalThemeStyle(published)} className="flex min-h-svh items-center justify-center overflow-x-clip bg-muted/25 px-4 py-12">
      <section className="w-full max-w-md border border-border bg-background p-6 shadow-sm sm:p-8">
        <FirmBrand brand={{ name: published.firmName, brandTagline: published.tagline, logoIcon: published.logoIcon, logoColor: published.logoColor }} />
        <h1 className="mt-10 text-3xl font-bold tracking-[-0.035em]">{signInToken ? 'Open your client portal' : 'Client portal sign-in'}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {signInToken ? 'This one-time link works once and expires 15 minutes after it was sent.' : 'Already accepted an invitation? Enter the email address your firm invited and we will send a one-time sign-in link.'}
        </p>
        {signInToken ? <PortalSignInConfirmForm token={signInToken} /> : <PortalSignInRequestForm />}
        <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
          First time here? <Link href="/portal/accept" className="font-semibold text-foreground underline-offset-4 hover:underline">Use your invitation</Link>. Lost access? <Link href="/contact#existing-clients" className="font-semibold text-foreground underline-offset-4 hover:underline">Ask the firm for a new invitation</Link>.
        </p>
      </section>
    </main>
  )
}
