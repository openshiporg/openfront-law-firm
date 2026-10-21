import Link from 'next/link'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { formatInstant } from '@/features/platform/lib/datetime'
import { formatMoneyLabel } from '@/features/platform/lib/money'
import { registerHref } from '@/features/platform/operations/lib/workspaceRegister'
import type { BillingInvoiceMetadataRegister } from '@/features/platform/operations/types'

const actionableStatuses = ['draft', 'approved', 'issued', 'partially_paid', 'overdue']

type PaginationHrefs = { previous: string | null; next: string | null }

function creationInstant(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

export function InvoiceMetadataRegister({
  register,
  paginationHrefs,
  timeZone = 'UTC',
}: {
  register: BillingInvoiceMetadataRegister
  paginationHrefs?: PaginationHrefs
  timeZone?: string
}) {
  return (
    <section id="invoice-metadata-register" className="min-w-0 border-t border-border pt-4">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-[-0.015em] text-foreground">
            Invoice register{register.success ? ` · ${register.total.toLocaleString()}` : ''}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Every authorized open invoice, newest first. Open one in its action register to approve, issue or void it.
          </p>
        </div>
        {register.success ? (
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
            Page {register.pagination.page} of {register.pagination.pageCount}
          </span>
        ) : null}
      </header>

      {!register.success ? (
        <p role="alert" className="mt-4 border-y border-destructive/25 bg-destructive/5 px-3 py-3 text-sm text-foreground">
          {register.error}
        </p>
      ) : register.items.length ? (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {register.items.map((item) => {
            const createdAt = creationInstant(item.createdAt)
            const number = item.invoiceNumber ?? 'Invoice'
            const actionHref = item.invoiceNumber && actionableStatuses.includes(item.status ?? '')
              ? registerHref('billing', { view: 'invoices', q: item.invoiceNumber })
              : null
            return (
              <article key={item.id} className="grid min-h-16 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {actionHref ? <Link href={actionHref} className="underline-offset-4 hover:underline">{number}</Link> : number}
                    {' · '}{item.clientName ?? 'Client restricted'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.matterId ? <Link href={`/dashboard/platform/matters/${encodeURIComponent(item.matterId)}#invoices`} className="underline-offset-4 hover:underline">{item.matterNumber ?? 'Matter'}</Link> : 'Matter restricted'}
                    {' · '}{formatMoneyLabel(item.balanceDueMinor, item.currencyCode)} due of {formatMoneyLabel(item.totalMinor, item.currencyCode)}
                    {' · '}Due {formatInstant(item.dueAt, timeZone, { includeTime: false, missing: 'not set' })}
                  </p>
                </div>
                <PracticeStatus status={item.status ?? 'unknown'} />
                <p className="col-span-2 min-w-0 text-xs leading-5 text-muted-foreground sm:col-span-1 sm:text-right">
                  <span>Created: </span>
                  <time dateTime={createdAt ?? undefined}>{formatInstant(item.createdAt, timeZone, { includeTime: false, missing: 'Unavailable' })}</time>
                </p>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 border-y border-dashed border-border px-2 py-6 text-sm text-muted-foreground">
          No invoice metadata rows were returned for this page.
        </p>
      )}

      {register.success ? (
        <nav aria-label="Invoice metadata pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="space-y-1 text-xs leading-5 text-muted-foreground">
            <p>
              {register.pagination.loadedCount
                ? `Showing ${register.pagination.firstItem.toLocaleString()}–${register.pagination.lastItem.toLocaleString()}`
                : 'No records returned on this page'} of {register.total.toLocaleString()} authorized invoices.
            </p>
            <p>Offset pages and counts are not snapshot-consistent: rows can shift while invoices change.</p>
          </div>
          <div className="flex items-center gap-2">
            {paginationHrefs?.previous ? (
              <Link href={paginationHrefs.previous} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Previous</Link>
            ) : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Previous</span>}
            {paginationHrefs?.next ? (
              <Link href={paginationHrefs.next} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next</Link>
            ) : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Next</span>}
          </div>
        </nav>
      ) : null}
    </section>
  )
}
