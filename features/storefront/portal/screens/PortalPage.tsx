import type { Metadata } from 'next'
import { portalThemeStyle } from '../theme'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, FileText, MessageSquareText, ReceiptText } from 'lucide-react'

import { keystoneContext } from '@/features/keystone/context'
import { listPortalSharedResourcesPage, portalFirmBrand } from '@/features/keystone/lib/portal-auth'
import { FirmBrand } from '@/features/portal/FirmBrand'
import { signOutPortal } from '@/features/portal/actions'
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
    <main style={portalThemeStyle(brand)} className="min-h-svh overflow-x-clip bg-background text-foreground">
      <a
        href="#portal-home-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Skip to main content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <FirmBrand brand={brand} />
          <form action={signOutPortal}>
            <button className="min-h-11 min-w-11 whitespace-nowrap px-2 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Sign out</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 id="portal-home-content" tabIndex={-1} className="text-3xl font-bold tracking-[-0.035em] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-4xl">Shared with you</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {cursor ? 'Older shared items' : 'Most recent first'}
        </p>

        {shares.length ? (
          <div className="mt-10 divide-y divide-border border-y border-border">
            {shares.map((share) => {
              const Icon = icons[share.resourceType as keyof typeof icons] ?? FileText
              return (
                <Link
                  key={share.id}
                  href={`/portal/share/${share.id}`}
                  className="group grid min-h-24 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-5 sm:px-3"
                >
                  <span className="flex size-10 items-center justify-center rounded-md border border-border bg-muted/35 text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{labels[share.resourceType] ?? 'Shared item'}</span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">{share.matterNumber} · {share.matterTitle}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="mt-10 border-y border-dashed border-border py-12 text-sm text-muted-foreground">
            <p>{cursor ? 'No older shared items.' : 'Nothing has been shared with you yet.'}</p>
            <p className="mt-3">Expecting something? <Link href="/contact#existing-clients" className="font-semibold text-foreground underline-offset-4 hover:underline">Contact your firm</Link>.</p>
          </div>
        )}
        <nav aria-label="Shared items pages" className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
          {cursor ? <Link href="/portal" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Most recent</Link> : null}
          {nextCursor ? <Link href={`/portal?after=${encodeURIComponent(nextCursor)}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Older shared items</Link> : null}
        </nav>
      </div>
    </main>
  )
}
