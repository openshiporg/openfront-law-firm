import Link from 'next/link'

import { ErrorBanner, FileLabel, Pager, StatusText } from '@/features/platform/components/ui'
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
  const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground first:pl-4 last:pr-4 bg-[var(--lf-manila)] first:rounded-tl-[5px] last:rounded-tr-[5px]'
  const td = 'px-3 py-2.5 align-middle first:pl-4 last:pr-4'
  return (
    <section id="invoice-metadata-register" aria-labelledby="invoice-register-heading" className="min-w-0 scroll-mt-28">
      <header className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="invoice-register-heading" className="flex min-w-0 items-baseline gap-2 text-[15px] font-semibold tracking-tight text-foreground">
          <span>Invoices</span>
          {register.success ? <span className="lf-figures text-sm font-normal text-muted-foreground">{register.total.toLocaleString()}</span> : null}
        </h2>
        {register.success ? <span className="lf-figures text-xs text-muted-foreground">Newest first · page {register.pagination.page} of {register.pagination.pageCount}</span> : null}
      </header>

      {!register.success ? (
        <ErrorBanner>{register.error}</ErrorBanner>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-[6px] border border-border bg-card">
          {register.items.length ? (
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={th}>Invoice</th>
                  <th scope="col" className={th}>Client</th>
                  <th scope="col" className={th}>Matter</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Due</th>
                  <th scope="col" className={`${th} text-right`}>Balance</th>
                  <th scope="col" className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {register.items.map((item) => {
                  const createdAt = creationInstant(item.createdAt)
                  const number = item.invoiceNumber ?? 'Invoice'
                  const status = item.status ?? 'unknown'
                  const actionHref = item.invoiceNumber && actionableStatuses.includes(item.status ?? '')
                    ? registerHref('billing', { view: 'invoices', q: item.invoiceNumber })
                    : null
                  return (
                    <tr key={item.id} className="hover:bg-muted/40">
                      <td className={`${td} whitespace-nowrap font-mono font-medium`}>
                        {actionHref ? <Link href={actionHref} className="text-[var(--lf-rust-ink)] underline-offset-4 hover:underline">{number}</Link> : number}
                        <span className="block font-sans text-xs font-normal text-muted-foreground">Created <time dateTime={createdAt ?? undefined}>{formatInstant(item.createdAt, timeZone, { includeTime: false, missing: 'unavailable' })}</time></span>
                      </td>
                      <td className={`${td} max-w-[14rem] truncate`}>{item.clientName ?? 'Client restricted'}</td>
                      <td className={td}>{item.matterId ? <Link href={`/dashboard/platform/matters/${encodeURIComponent(item.matterId)}#invoices`} className="rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lf-rust)]/40"><FileLabel>{item.matterNumber ?? 'Matter'}</FileLabel></Link> : <span className="text-xs text-muted-foreground">Restricted</span>}</td>
                      <td className={td}><StatusText status={status} /></td>
                      <td className={`${td} lf-figures whitespace-nowrap font-mono text-xs text-muted-foreground`}>{formatInstant(item.dueAt, timeZone, { includeTime: false, missing: 'Not set' })}</td>
                      <td className={`${td} lf-figures whitespace-nowrap text-right font-mono font-semibold`}>{formatMoneyLabel(item.balanceDueMinor, item.currencyCode)}</td>
                      <td className={`${td} lf-figures whitespace-nowrap text-right font-mono text-muted-foreground`}>{formatMoneyLabel(item.totalMinor, item.currencyCode)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p role="status" className="px-4 py-4 text-sm text-muted-foreground">{register.total ? 'No invoices on this page' : 'No invoices yet'}</p>
          )}
          {register.total > 0 ? (
            <div className="border-t border-border px-4 py-2.5">
              <Pager
                label="Invoice pages"
                previous={paginationHrefs?.previous}
                next={paginationHrefs?.next}
                summary={`${register.pagination.loadedCount ? `${register.pagination.firstItem.toLocaleString()}–${register.pagination.lastItem.toLocaleString()}` : 'None on this page'} of ${register.total.toLocaleString()}`}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
