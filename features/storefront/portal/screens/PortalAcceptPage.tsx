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
    <main style={portalThemeStyle(published)} className="flex min-h-svh items-center justify-center overflow-x-clip bg-muted/25 px-4 py-12">
      <section className="w-full max-w-md border border-border bg-background p-6 shadow-sm sm:p-8">
        <FirmBrand brand={{ name: published.firmName, brandTagline: published.tagline, logoIcon: published.logoIcon, logoColor: published.logoColor }} />
        <h1 className="mt-10 text-3xl font-bold tracking-[-0.035em]">Client portal</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Use the one-time invitation sent by your law firm to see the documents, invoices, and conversations it has shared with you.
        </p>
        <PortalAcceptForm token={typeof token === 'string' ? token : ''} />
        <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
          Already accepted an invitation? <Link href="/portal/signin" className="font-semibold text-foreground underline-offset-4 hover:underline">Sign in with your email</Link>. Need a new invitation? <Link href="/contact#existing-clients" className="font-semibold text-foreground underline-offset-4 hover:underline">Ask the firm for a new invitation</Link>. For staff access,{' '}
          <Link href="/dashboard" className="font-semibold text-foreground underline-offset-4 hover:underline">sign in here</Link>.
        </p>
      </section>
    </main>
  )
}
