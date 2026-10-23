import type { Metadata } from 'next'
import { portalThemeStyle } from '../theme'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { keystoneContext } from '@/features/keystone/context'
import { PORTAL_INVOICE_LINE_LIMIT, PORTAL_THREAD_MESSAGE_LIMIT, portalFirmBrand, readPortalSharedResource } from '@/features/keystone/lib/portal-auth'
import { PortalHeader } from '../PortalHeader'
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

  const status = invoice?.status ?? document?.status ?? thread?.status ?? null
  return (
    <main style={portalThemeStyle(brand)} className="storefront min-h-svh overflow-x-clip">
      <a href="#portal-share-content" className="sf-skip-link">Skip to main content</a>
      <PortalHeader brand={brand} />
      <article className="sf-shell sf-page" style={{ maxWidth: '52rem' }}>
        <nav aria-label="Breadcrumb" className="mb-8"><Link href="/portal" className="sf-link inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft className="size-4" aria-hidden="true" /> Shared with you</Link></nav>
        <header className="grid gap-3">
          <p className="sf-status capitalize">{status ? <span className={`sf-dot ${statusDot(status)}`} aria-hidden="true" /> : null}{resource.resourceType.replaceAll('_', ' ')}{status ? ` · ${status.replaceAll('_', ' ')}` : ''}</p>
          <h1 id="portal-share-content" tabIndex={-1} className="sf-title outline-none">{title}</h1>
        </header>

        {invoice ? <div className="sf-card mt-8"><div className="sf-card__body grid gap-1"><p className="sf-label">Balance due</p><p className="sf-display sf-num" style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)' }}>{money(invoice.balanceDueMinor, invoice.currencyCode)}</p><p className="sf-muted sf-num text-sm">Due {day(invoice.dueAt)} · Issued {day(invoice.issuedAt)}</p></div></div> : null}

        <dl className="sf-facts mt-8">
          {document ? <><div><dt>Category</dt><dd>{document.category}</dd></div><div><dt>Status</dt><dd className="capitalize">{document.status}</dd></div></> : null}
          {version ? <><div><dt>Version</dt><dd>{version.versionNumber}</dd></div><div><dt>File type</dt><dd>{version.mediaType}</dd></div><div><dt>Size</dt><dd className="sf-num">{version.byteSize.toLocaleString()} bytes</dd></div></> : null}
          {invoice ? <><div><dt>Status</dt><dd className="capitalize">{invoice.status.replaceAll('_', ' ')}</dd></div><div><dt>Total</dt><dd className="sf-num">{money(invoice.totalMinor, invoice.currencyCode)}</dd></div><div><dt>Paid</dt><dd className="sf-num">{money(invoice.paidMinor, invoice.currencyCode)}</dd></div><div><dt>Balance due</dt><dd className="sf-num font-semibold">{money(invoice.balanceDueMinor, invoice.currencyCode)}</dd></div></> : null}
          {thread ? <><div><dt>Channel</dt><dd className="capitalize">{thread.primaryChannel}</dd></div><div><dt>Status</dt><dd className="capitalize">{thread.status}</dd></div></> : null}
        </dl>

        {document || version ? <p role="note" className="sf-notice mt-6">Portal downloads are not available. <Link href="/contact#existing-clients" className="sf-link">Contact the firm</Link> for a copy.</p> : null}

        {thread ? <section aria-labelledby="portal-thread-messages" className="sf-section">
          <div className="sf-section__head"><h2 id="portal-thread-messages" className="sf-h2">Messages</h2>{thread.hasOlderMessages ? <p className="sf-fine">Latest {PORTAL_THREAD_MESSAGE_LIMIT}</p> : null}</div>
          {thread.messages.length ? <ol className="grid gap-3">{thread.messages.map((message: ThreadMessageRow) => <li key={message.id} className={`sf-card max-w-[42rem] ${message.direction === 'inbound' ? 'justify-self-end' : ''}`}><div className="sf-card__body grid gap-2" style={{ padding: '1rem 1.25rem' }}>
            <p className="sf-label">{message.direction === 'inbound' ? 'You' : 'Your firm'} · {day(message.sentAt ?? message.receivedAt ?? message.createdAt)}</p>
            {message.subject ? <p className="font-semibold [overflow-wrap:anywhere]">{message.subject}</p> : null}
            <p className="whitespace-pre-line text-sm leading-6 [overflow-wrap:anywhere]">{message.body}</p>
          </div></li>)}</ol> : <p className="sf-muted text-sm">No messages yet.</p>}
          <p role="note" className="sf-notice mt-6">Portal replies are not available. Use the contact details your firm gave you, or <Link href="/contact#existing-clients" className="sf-link">contact the firm</Link>.</p>
        </section> : null}

        {invoice ? <section aria-labelledby="portal-invoice-lines" className="sf-section">
          <div className="sf-section__head"><h2 id="portal-invoice-lines" className="sf-h2">Invoice lines</h2></div>
          {invoice.lines.length ? <div className="overflow-x-auto"><table className="sf-num w-full min-w-[32rem] text-left text-sm">
            <thead className="text-[var(--color-muted)]"><tr className="border-b border-[var(--color-rule)]"><th scope="col" className="py-2 pr-4 font-medium">Date</th><th scope="col" className="py-2 pr-4 font-medium">Description</th><th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th><th scope="col" className="py-2 text-right font-medium">Amount</th></tr></thead>
            <tbody className="divide-y divide-[var(--color-rule)]">{invoice.lines.map((line: InvoiceLineRow) => <tr key={line.id}><td className="py-3 pr-4 align-top whitespace-nowrap">{day(line.serviceDate)}</td><td className="py-3 pr-4 align-top [overflow-wrap:anywhere]">{line.description || 'Line item'}</td><td className="py-3 pr-4 text-right align-top">{line.quantity ?? 1}</td><td className="py-3 text-right align-top whitespace-nowrap">{money(line.lineTotalMinor, line.currencyCode || invoice.currencyCode)}</td></tr>)}</tbody>
            <tfoot className="border-t border-[var(--color-ink)]">
              {invoice.discountMinor ? <tr><th scope="row" colSpan={3} className="py-2 pr-4 text-right font-medium">Discount</th><td className="py-2 text-right">−{money(invoice.discountMinor, invoice.currencyCode)}</td></tr> : null}
              {invoice.taxMinor ? <tr><th scope="row" colSpan={3} className="py-2 pr-4 text-right font-medium">Tax</th><td className="py-2 text-right">{money(invoice.taxMinor, invoice.currencyCode)}</td></tr> : null}
              <tr><th scope="row" colSpan={3} className="py-2 pr-4 text-right font-semibold">Total</th><td className="py-2 text-right font-semibold">{money(invoice.totalMinor, invoice.currencyCode)}</td></tr>
            </tfoot>
          </table></div> : <p className="sf-muted text-sm">No itemized lines.</p>}
          {invoice.hasMoreLines ? <p className="sf-fine mt-3">First {PORTAL_INVOICE_LINE_LIMIT} lines shown. Ask your firm for the complete invoice.</p> : null}
          <p role="note" className="sf-notice mt-6">Online payment is not available. Follow the payment instructions sent with this invoice, or <Link href="/contact#existing-clients" className="sf-link">contact the firm</Link>.</p>
        </section> : null}
      </article>
    </main>
  )
}

function statusDot(status: string) {
  if (['paid', 'active', 'open', 'issued', 'approved'].includes(status)) return 'sf-dot--green'
  if (status === 'overdue') return 'sf-dot--red'
  if (['void', 'voided', 'cancelled', 'closed', 'archived'].includes(status)) return 'sf-dot--slate'
  return 'sf-dot--amber'
}
