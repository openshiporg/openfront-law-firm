import type { Metadata } from 'next'
import { portalThemeStyle } from '../theme'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { keystoneContext } from '@/features/keystone/context'
import { PORTAL_INVOICE_LINE_LIMIT, PORTAL_THREAD_MESSAGE_LIMIT, portalFirmBrand, readPortalSharedResource } from '@/features/keystone/lib/portal-auth'
import { FirmBrand } from '@/features/portal/FirmBrand'
import { signOutPortal } from '@/features/portal/actions'
import { PORTAL_SESSION_COOKIE } from '@/features/portal/constants'
import { formatMinorUnits } from '@/features/platform/lib/money'
import { PortalReadError } from '@/features/keystone/lib/portal-read-error'
import { PortalReadProblem } from '../PortalReadProblem'

export const metadata: Metadata = { title: 'Shared item' }
export const dynamic = 'force-dynamic'

function money(minor: number, currency: string) {
  return formatMinorUnits(minor, currency)
}

type ThreadMessageRow = { id: string; direction: string; subject: string; body: string; sentAt: Date | null; receivedAt: Date | null; createdAt: Date }

type InvoiceLineRow = { id: string; description: string; serviceDate: Date | null; quantity: number | null; lineTotalMinor: number; currencyCode: string }

function dayFormatter(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone })
  } catch {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
  }
}

export default async function PortalSharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value
  if (!token) redirect('/portal/signin')
  const { shareId } = await params

  let resource: Awaited<ReturnType<typeof readPortalSharedResource>>
  let brand: NonNullable<Awaited<ReturnType<typeof portalFirmBrand>>>
  try {
    resource = await readPortalSharedResource(token, shareId, keystoneContext.prisma)
    const loadedBrand = await portalFirmBrand(token, keystoneContext.prisma)
    if (!loadedBrand) throw new Error('Firm brand is unavailable.')
    brand = loadedBrand
  } catch (error) {
    if (error instanceof PortalReadError && error.code === 'invalid_session') redirect('/portal/signin')
    return <PortalReadProblem kind={error instanceof PortalReadError && error.code === 'unavailable_resource' ? 'unavailable_resource' : 'unavailable'} retryHref={`/portal/share/${encodeURIComponent(shareId)}`} />
  }

  const document = resource.document
  const version = resource.documentVersion
  const invoice = resource.invoice
  const thread = resource.communicationThread
  // Billing dates are shown in the firm's configured timezone, as on the issued bill.
  const formatter = dayFormatter(brand.defaultTimezone)
  const day = (value: Date | string | null | undefined) => value ? formatter.format(new Date(value)) : 'Not set'
  const title = document?.title ?? version?.fileName ?? (invoice ? `Invoice ${invoice.invoiceNumber}` : thread?.subject) ?? 'Shared item'

  return (
    <main style={portalThemeStyle(brand)} className="min-h-svh overflow-x-clip bg-background text-foreground">
      <a
        href="#portal-share-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Skip to main content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <FirmBrand brand={brand} />
          <form action={signOutPortal}><button className="min-h-11 min-w-11 whitespace-nowrap px-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Sign out</button></form>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/portal" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to shared items
        </Link>
        <p className="mt-10 text-sm font-semibold capitalize text-muted-foreground">{resource.resourceType.replaceAll('_', ' ')}</p>
        <h1 id="portal-share-content" tabIndex={-1} className="mt-3 text-3xl font-bold tracking-[-0.035em] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-4xl [overflow-wrap:anywhere]">{title}</h1>

        <dl className="mt-10 divide-y divide-border border-y border-border text-sm">
          {document ? <><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Category</dt><dd className="sm:col-span-2">{document.category}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Status</dt><dd className="capitalize sm:col-span-2">{document.status}</dd></div></> : null}
          {version ? <><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Version</dt><dd className="sm:col-span-2">{version.versionNumber}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">File type</dt><dd className="sm:col-span-2">{version.mediaType}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Size</dt><dd className="sm:col-span-2">{version.byteSize.toLocaleString()} bytes</dd></div></> : null}
          {invoice ? <><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Status</dt><dd className="capitalize sm:col-span-2">{invoice.status.replaceAll('_', ' ')}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Issued</dt><dd className="sm:col-span-2">{day(invoice.issuedAt)}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Due</dt><dd className="sm:col-span-2">{day(invoice.dueAt)}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Total</dt><dd className="sm:col-span-2">{money(invoice.totalMinor, invoice.currencyCode)}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Paid</dt><dd className="sm:col-span-2">{money(invoice.paidMinor, invoice.currencyCode)}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Balance due</dt><dd className="font-semibold sm:col-span-2">{money(invoice.balanceDueMinor, invoice.currencyCode)}</dd></div></> : null}
          {thread ? <><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Channel</dt><dd className="capitalize sm:col-span-2">{thread.primaryChannel}</dd></div><div className="grid gap-1 py-4 sm:grid-cols-3"><dt className="text-muted-foreground">Status</dt><dd className="capitalize sm:col-span-2">{thread.status}</dd></div></> : null}
        </dl>

        {document || version ? <p role="note" className="mt-6 text-sm text-muted-foreground">Downloading files from the portal is not available yet. To get a copy of this document, <Link href="/contact#existing-clients" className="font-semibold text-foreground underline-offset-4 hover:underline">contact the firm</Link>.</p> : null}

        {thread ? <section aria-labelledby="portal-thread-messages" className="mt-10">
          <h2 id="portal-thread-messages" className="text-lg font-bold">Messages</h2>
          {thread.hasOlderMessages ? <p className="mt-2 text-sm text-muted-foreground">Showing the latest {PORTAL_THREAD_MESSAGE_LIMIT} messages.</p> : null}
          {thread.messages.length ? <ol className="mt-4 space-y-4">{thread.messages.map((message: ThreadMessageRow) => <li key={message.id} className="rounded-md border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground">{message.direction === 'inbound' ? 'You' : 'Your firm'} · {day(message.sentAt ?? message.receivedAt ?? message.createdAt)}</p>
            {message.subject ? <p className="mt-2 text-sm font-semibold [overflow-wrap:anywhere]">{message.subject}</p> : null}
            <p className="mt-2 whitespace-pre-line text-sm leading-6 [overflow-wrap:anywhere]">{message.body}</p>
          </li>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">No messages have been exchanged with you in this conversation yet.</p>}
          <p className="mt-6 text-sm text-muted-foreground">Replying from the portal is not available yet. To respond, use the contact details your firm gave you, or <Link href="/contact#existing-clients" className="font-semibold text-foreground underline-offset-4 hover:underline">contact the firm</Link>.</p>
        </section> : null}

        {invoice ? <section aria-labelledby="portal-invoice-lines" className="mt-10">
          <h2 id="portal-invoice-lines" className="text-lg font-bold">Invoice lines</h2>
          {invoice.lines.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground"><tr><th scope="col" className="py-2 pr-4 font-medium">Date</th><th scope="col" className="py-2 pr-4 font-medium">Description</th><th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th><th scope="col" className="py-2 text-right font-medium">Amount</th></tr></thead>
            <tbody className="divide-y divide-border">{invoice.lines.map((line: InvoiceLineRow) => <tr key={line.id}><td className="py-3 pr-4 align-top whitespace-nowrap">{day(line.serviceDate)}</td><td className="py-3 pr-4 align-top [overflow-wrap:anywhere]">{line.description || 'Line item'}</td><td className="py-3 pr-4 text-right align-top">{line.quantity ?? 1}</td><td className="py-3 text-right align-top whitespace-nowrap">{money(line.lineTotalMinor, line.currencyCode || invoice.currencyCode)}</td></tr>)}</tbody>
            <tfoot className="border-t border-border">
              {invoice.discountMinor ? <tr><th scope="row" colSpan={3} className="py-2 pr-4 text-right font-medium">Discount</th><td className="py-2 text-right">−{money(invoice.discountMinor, invoice.currencyCode)}</td></tr> : null}
              {invoice.taxMinor ? <tr><th scope="row" colSpan={3} className="py-2 pr-4 text-right font-medium">Tax</th><td className="py-2 text-right">{money(invoice.taxMinor, invoice.currencyCode)}</td></tr> : null}
              <tr><th scope="row" colSpan={3} className="py-2 pr-4 text-right font-semibold">Total</th><td className="py-2 text-right font-semibold">{money(invoice.totalMinor, invoice.currencyCode)}</td></tr>
            </tfoot>
          </table></div> : <p className="mt-4 text-sm text-muted-foreground">This invoice has no itemized lines.</p>}
          {invoice.hasMoreLines ? <p className="mt-3 text-sm text-muted-foreground">Showing the first {PORTAL_INVOICE_LINE_LIMIT} lines. Ask your firm for the complete itemized invoice.</p> : null}
          <p className="mt-6 text-sm text-muted-foreground">Online payment is not available in this portal. Follow the payment instructions your firm sent with this invoice, or <Link href="/contact#existing-clients" className="font-semibold text-foreground underline-offset-4 hover:underline">contact the firm</Link>.</p>
        </section> : null}
      </article>
    </main>
  )
}
