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
    <main style={portalThemeStyle(published)} className="storefront flex min-h-svh items-center justify-center overflow-x-clip px-4 py-12">
      <section className="sf-card sf-portal-card">
        <div className="sf-card__body grid gap-6">
          <FirmBrand brand={{ name: published.firmName, brandTagline: published.tagline, logoIcon: published.logoIcon, logoColor: published.logoColor }} />
          <header className="grid gap-2"><p className="sf-label">Client portal</p><h1 className="sf-h2">{signInToken ? 'Open your client portal' : 'Sign in'}</h1>{signInToken ? <p className="sf-muted text-sm">One-time link. Expires 15 minutes after it was sent.</p> : null}</header>
          {signInToken ? <PortalSignInConfirmForm token={signInToken} /> : <PortalSignInRequestForm />}
        </div>
        <div className="sf-card__foot text-sm">
          <Link href="/portal/accept" className="sf-link">First time? Use your invitation</Link>
          <Link href="/contact#existing-clients" className="sf-link">Lost access</Link>
        </div>
      </section>
    </main>
  )
}
