import Link from 'next/link'

import { ErrorBanner, Pager, RowList, SectionHeader, StatusDot, statusLabel, statusTone } from '@/features/platform/components/ui'
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
    <section id="invoice-metadata-register" className="min-w-0 scroll-mt-20 space-y-3">
      <SectionHeader
        title="Invoices"
        count={register.success ? register.total : undefined}
        actions={register.success ? <span className="text-xs tabular-nums text-muted-foreground">Page {register.pagination.page} of {register.pagination.pageCount}</span> : undefined}
      />

      {!register.success ? (
        <ErrorBanner>{register.error}</ErrorBanner>
      ) : register.items.length ? (
        <RowList label="Invoices, newest first">
          {register.items.map((item) => {
            const createdAt = creationInstant(item.createdAt)
            const number = item.invoiceNumber ?? 'Invoice'
            const status = item.status ?? 'unknown'
            const actionHref = item.invoiceNumber && actionableStatuses.includes(item.status ?? '')
              ? registerHref('billing', { view: 'invoices', q: item.invoiceNumber })
              : null
            return (
              <li key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot tone={statusTone(status)} />
                  <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {actionHref ? <Link href={actionHref} className="font-mono underline-offset-4 hover:underline">{number}</Link> : <span className="font-mono">{number}</span>}
                    <span className="font-normal text-muted-foreground"> · </span>
                    {item.clientName ?? 'Client restricted'}
                  </p>
                  <span className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground sm:inline">{statusLabel(status)}</span>
                </div>
                <p className="row-span-2 text-right">
                  <span className="block font-mono text-sm font-semibold tabular-nums text-foreground">{formatMoneyLabel(item.balanceDueMinor, item.currencyCode)}</span>
                  <span className="block font-mono text-xs tabular-nums text-muted-foreground">of {formatMoneyLabel(item.totalMinor, item.currencyCode)}</span>
                </p>
                <p className="min-w-0 truncate pl-4 text-xs text-muted-foreground">
                  <span className="sm:hidden">{statusLabel(status)} · </span>
                  {item.matterId ? <Link href={`/dashboard/platform/matters/${encodeURIComponent(item.matterId)}#invoices`} className="underline-offset-4 hover:underline">{item.matterNumber ?? 'Matter'}</Link> : 'Matter restricted'}
                  {' · '}Due {formatInstant(item.dueAt, timeZone, { includeTime: false, missing: 'not set' })}
                  {' · '}Created <time dateTime={createdAt ?? undefined}>{formatInstant(item.createdAt, timeZone, { includeTime: false, missing: 'unavailable' })}</time>
                </p>
              </li>
            )
          })}
        </RowList>
      ) : (
        <p role="status" className="rounded-[6px] border  border-border px-4 py-8 text-center text-sm text-muted-foreground">No invoices on this page</p>
      )}

      {register.success ? (
        <Pager
          label="Invoice metadata pages"
          previous={paginationHrefs?.previous}
          next={paginationHrefs?.next}
          summary={
            <>
              {register.pagination.loadedCount
                ? `${register.pagination.firstItem.toLocaleString()}–${register.pagination.lastItem.toLocaleString()}`
                : 'None on this page'} of {register.total.toLocaleString()} · Counts may shift while invoices change
            </>
          }
        />
      ) : null}
    </section>
  )
}
