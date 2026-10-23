import type { Metadata } from 'next'
import { portalThemeStyle } from '../theme'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, FileText, MessageSquareText, ReceiptText } from 'lucide-react'

import { keystoneContext } from '@/features/keystone/context'
import { listPortalSharedResourcesPage, portalFirmBrand } from '@/features/keystone/lib/portal-auth'
import { PortalHeader } from '../PortalHeader'
import { PORTAL_SESSION_COOKIE } from '@/features/portal/constants'
import { PortalReadError } from '@/features/keystone/lib/portal-read-error'
import { PortalReadProblem } from '../PortalReadProblem'

export const metadata: Metadata = { title: 'Shared with you' }
export const dynamic = 'force-dynamic'

const labels: Record<string, string> = {
  document: 'Document',
  document_version: 'Document version',
  invoice: 'Invoice',
  communication_thread: 'Conversation',
}

const icons = {
  document: FileText,
  document_version: FileText,
  invoice: ReceiptText,
  communication_thread: MessageSquareText,
} as const

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ after?: string | string[] }> }) {
  const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value
  if (!token) redirect('/portal/signin')
  const { after } = await searchParams
  const cursor = typeof after === 'string' ? after : null

  let shares: Awaited<ReturnType<typeof listPortalSharedResourcesPage>>['items']
  let nextCursor: string | null
  let brand: NonNullable<Awaited<ReturnType<typeof portalFirmBrand>>>
  try {
    const page = await listPortalSharedResourcesPage(token, keystoneContext.prisma, { cursor })
    shares = page.items
    nextCursor = page.nextCursor
    const loadedBrand = await portalFirmBrand(token, keystoneContext.prisma)
    if (!loadedBrand) throw new Error('Firm brand is unavailable.')
    brand = loadedBrand
  } catch (error) {
    if (error instanceof PortalReadError && error.code === 'invalid_session') redirect('/portal/signin')
    return <PortalReadProblem kind={error instanceof PortalReadError && error.code === 'invalid_cursor' ? 'invalid_cursor' : 'unavailable'} retryHref={cursor ? `/portal?after=${encodeURIComponent(cursor)}` : '/portal'} />
  }

  return (
    <main style={portalThemeStyle(brand)} className="storefront min-h-svh overflow-x-clip">
      <a href="#portal-home-content" className="sf-skip-link">Skip to main content</a>
      <PortalHeader brand={brand} />
      <div className="sf-shell sf-page" style={{ maxWidth: '56rem' }}>
        <header className="sf-page__head">
          <p className="sf-label">{cursor ? 'Older items' : 'Most recent first'}</p>
          <h1 id="portal-home-content" tabIndex={-1} className="sf-title outline-none">Shared with you</h1>
        </header>

        {shares.length ? (
          <ul className="sf-rows">
            {shares.map((share) => {
              const Icon = icons[share.resourceType as keyof typeof icons] ?? FileText
              return (
                <li key={share.id}>
                  <Link href={`/portal/share/${share.id}`} className="sf-row grid-cols-[2.75rem_minmax(0,1fr)_auto]">
                    <span className="row-span-2 grid size-10 place-items-center rounded-full bg-[var(--sf-tint)] text-[var(--color-accent)]"><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="sf-row__title col-start-2"><span>{labels[share.resourceType] ?? 'Shared item'}</span></span>
                    <span className="sf-row__meta col-start-2 truncate" style={{ paddingLeft: 0 }}>{share.matterNumber} · {share.matterTitle}</span>
                    <ArrowRight className="col-start-3 row-span-2 row-start-1 size-4 text-[var(--color-muted)]" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="sf-empty">
            <p role="status" className="sf-h3">{cursor ? 'No older shared items' : 'Nothing shared yet'}</p>
            <Link href="/contact#existing-clients" className="sf-link text-sm">Contact your firm</Link>
          </div>
        )}
        {cursor || nextCursor ? <nav aria-label="Shared items pages" className="sf-track mt-6">
          {cursor ? <Link href="/portal" className="sf-pill">Most recent</Link> : null}
          {nextCursor ? <Link href={`/portal?after=${encodeURIComponent(nextCursor)}`} className="sf-pill sf-pill--raised">Older shared items</Link> : null}
        </nav> : null}
      </div>
    </main>
  )
}
