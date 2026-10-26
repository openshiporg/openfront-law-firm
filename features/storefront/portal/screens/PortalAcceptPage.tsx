import type { Metadata } from 'next'
import { portalThemeStyle } from '../theme'
import Link from 'next/link'

import { FirmBrand } from '@/features/portal/FirmBrand'
import { PortalAcceptForm } from '@/features/portal/PortalAcceptForm'
import { getStorefrontSettings } from '@/features/storefront/lib/storefront-settings'

export const metadata: Metadata = { title: 'Client portal' }

export default async function PortalAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  // Only the already-public storefront identity (or the neutral fallback) is shown:
  // an unverified invitation token never selects or reveals a tenant.
  const published = await getStorefrontSettings()
  return (
    <main style={portalThemeStyle(published)} className="storefront flex min-h-svh items-center justify-center overflow-x-clip px-4 py-12">
      <section className="sf-card sf-portal-card">
        <div className="sf-card__body grid gap-6">
          <FirmBrand brand={{ name: published.firmName, brandTagline: published.tagline, logoIcon: published.logoIcon, logoColor: published.logoColor }} />
          <header className="grid gap-2"><h1 className="sf-h2">Accept your invitation</h1><p className="sf-label">Client portal</p></header>
          <PortalAcceptForm token={typeof token === 'string' ? token : ''} />
        </div>
        <div className="sf-card__foot text-sm">
          <Link href="/portal/signin" className="sf-link">Already accepted? Sign in</Link>
          <Link href="/contact#existing-clients" className="sf-link">Request a new invitation</Link>
          <Link href="/dashboard" className="sf-link sf-muted">Staff sign in</Link>
        </div>
      </section>
    </main>
  )
}
