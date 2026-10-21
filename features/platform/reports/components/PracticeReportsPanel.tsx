/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · audience: firm operators · use: review access-scoped financial and control registers · tone: technical/austere · genre: modern-minimal · macrostructure: Control ledger · theme: Quiet */
import Link from 'next/link'
import { BarChart3, CircleAlert } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { getPracticeReports } from '../actions/getPracticeReports'
import { formatInstant, validTimeZone } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { formatMinorUnits } from '@/features/platform/lib/money'
import { registerHref } from '@/features/platform/operations/lib/workspaceRegister'
import type { WorkQueuePageInfo } from '@/features/platform/operations/lib/workQueuePagination'
import {
  ACCOUNTS_RECEIVABLE_DISPLAY_CAP,
  ACCOUNTS_RECEIVABLE_SOURCE_CAP,
  summarizeAccountsReceivableSample,
} from '../lib/accountsReceivableSample'
import {
  latestLedgerSnapshots,
  sumCurrencies,
  summarizeTrustSnapshotSample,
  type TrustSnapshotSampleSummary,
} from '../lib/trustSnapshotSample'
import {
  REPORT_WIP_SOURCE_CAP,
  summarizeReportWipAmounts,
  type ReportWipAmountSummary,
} from '../lib/wipAmountSummary'

export async function PracticeReportsPanel({ auditPage = 1, reportDeadlinePage = 1 }: { auditPage?: number; reportDeadlinePage?: number }) {
  const [reports, timeZone] = await Promise.all([getPracticeReports(auditPage, reportDeadlinePage), getFirmTimeZone()])
  const notices: string[] = []
  const arSourceRows = reports.ar.success ? reports.ar.data.invoices : null
  if (arSourceRows === null) notices.push('Accounts receivable is unavailable to this role.')
  const ar = arSourceRows ?? []
  const arSample = summarizeAccountsReceivableSample(arSourceRows)
  const time = reports.time.success ? reports.time.data.timeEntries : null
  if (time === null) notices.push('Time WIP is unavailable to this role.')
  const expenses = reports.expenses.success ? reports.expenses.data.expenses : null
  if (expenses === null) notices.push('Expense WIP is unavailable to this role.')
  const deadlines = reports.deadlines.success ? reports.deadlines.data : (notices.push('Deadline control is unavailable to this role.'), null)
  const trustSnapshotSourceRows = reports.trust.success ? reports.trust.data.trustBalanceSnapshots : null
  if (!reports.trust.success) notices.push('Client trust balances are unavailable to this role.')
  const snapshots = trustSnapshotSourceRows ? latestLedgerSnapshots(trustSnapshotSourceRows) : []
  const trustSample = summarizeTrustSnapshotSample(trustSnapshotSourceRows, snapshots)
  const wipSummary = summarizeReportWipAmounts(time, expenses)
  const audit = reports.audit.success ? reports.audit.data : (notices.push('Audit events are unavailable to this role.'), null)

  return (
    <section className="space-y-8 border-y border-border py-5" aria-labelledby="operational-reports-heading">
      <div className="flex items-start gap-3 px-1">
        <BarChart3 className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div><h2 id="operational-reports-heading" className="text-base font-bold text-foreground">Operational reports</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Access-scoped source registers with amount totals grouped by currency. Bounded results disclose their row caps and do not claim a general ledger or certified financial statement.</p></div>
      </div>

      {notices.length ? <div role="note" className="flex items-start gap-3 border-y border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{notices.join(' ')}</p></div> : null}

      <div className="grid border-y border-border sm:grid-cols-2 xl:grid-cols-4">
        <AccountsReceivableMetric amounts={sumCurrencies(ar)} sample={arSample} />
        <WipAmountMetric summary={wipSummary} />
        <TrustSnapshotMetric amounts={sumCurrencies(snapshots)} sample={trustSample} />
        <div className="min-w-0 border-b border-r border-border px-4 py-4 xl:border-b-0"><p className="text-2xl font-bold tabular-nums text-foreground">{deadlines?.total.toLocaleString() ?? '—'}</p><p className="mt-2 text-sm text-muted-foreground">authorized pending/missed deadline records · bounded register below</p></div>
      </div>

      <nav aria-label="Complete registers" className="flex flex-wrap gap-2 px-1">
        <span className="self-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Complete registers</span>
        <Link href={registerHref('billing', { view: 'invoices' })} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">Receivables</Link>
        <Link href={registerHref('time-expenses', { view: 'time' })} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">Time WIP</Link>
        <Link href={registerHref('time-expenses', { view: 'expenses' })} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">Expense WIP</Link>
        <Link href={registerHref('accounting', { view: 'ledgers' })} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">Client ledgers</Link>
      </nav>

      <div className="grid min-w-0 gap-8 xl:grid-cols-2">
        <ReportRows title="Accounts receivable aging source sample" rows={ar.map((item) => ({ id: item.id, title: item.invoiceNumber, meta: `${item.matter?.matterNumber ?? 'no matter'} · ${item.client?.displayName ?? 'no client'} · ${money(item.balanceDueMinor, item.currencyCode)} due · ${date(item.dueAt)}`, status: item.status }))} emptyMessage={arSourceRows === null ? 'Invoice source unavailable to this role.' : 'No invoice rows were returned in this sample.'} />
        <TrustSnapshotRegister rows={snapshots} sample={trustSample} />
      </div>
      <ReportDeadlineRegister register={deadlines} auditPage={auditPage} timeZone={timeZone} />
      <AuditEventRegister register={audit} reportDeadlinePage={reportDeadlinePage} timeZone={timeZone} />
    </section>
  )
}

function AccountsReceivableMetric({
  amounts,
  sample,
}: {
  amounts: Map<string, number>
  sample: ReturnType<typeof summarizeAccountsReceivableSample>
}) {
  const sourceLabel = sample.rawSourceRows === null
    ? 'source unavailable'
    : `${sample.rawSourceRows.toLocaleString()} raw rows returned / ${sample.sourceCap}-row source cap · ${sample.displayedRows?.toLocaleString() ?? 0} shown / ${sample.displayCap}-row register display cap`
  return (
    <div className="min-w-0 border-b border-r border-border px-4 py-4 xl:border-b-0">
      <div className="space-y-1">
        {amounts.size ? [...amounts].map(([currency, value]) => <p key={currency} className="text-xl font-bold tabular-nums text-foreground">{money(value, currency)}</p>) : <p className="text-xl font-bold text-foreground">—</p>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Accounts receivable · returned-sample invoice balances due · grouped by currency</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{sourceLabel}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Amounts sum every returned invoice row, including rows beyond the register display cap; the register shows only its first {sample.displayCap} rows.</p>
      {sample.sourceCapReached ? (
        <p role="note" className="mt-1 text-xs leading-5 text-muted-foreground">The {sample.sourceCap}-row source cap was reached; additional matching invoices may be omitted.</p>
      ) : sample.rawSourceRows === null ? (
        <p role="note" className="mt-1 text-xs leading-5 text-muted-foreground">Invoice balance data is unavailable to this role.</p>
      ) : sample.rawSourceRows === 0 ? (
        <p role="note" className="mt-1 text-xs leading-5 text-muted-foreground">No invoice rows were returned; this is not a certified zero receivable.</p>
      ) : null}
      <p className="mt-1 text-xs leading-5 text-muted-foreground">The query requests no total count. These returned balances are not a certified or as-of receivable balance.</p>
    </div>
  )
}

function WipAmountMetric({ summary }: { summary: ReportWipAmountSummary }) {
  const unknownTimeAmountCount = [...summary.unknownTimeAmountsByCurrency.values()].reduce((total, count) => total + count, 0)
  const sourceRows = (count: number | null, atCap: boolean) => count === null
    ? 'unavailable'
    : `${count.toLocaleString()} returned${atCap ? ' · source cap reached' : ''}`
  return (
    <div className="min-w-0 border-b border-r border-border px-4 py-4 xl:border-b-0">
      <div className="space-y-1">
        {summary.knownAmountsByCurrency.size
          ? [...summary.knownAmountsByCurrency].map(([currency, value]) => <p key={currency} className="text-xl font-bold tabular-nums text-foreground">{money(value, currency)}</p>)
          : <p className="text-xl font-bold text-foreground">—</p>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Unbilled WIP · known amounts in returned samples · grouped by currency</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Time entries: {sourceRows(summary.timeEntryRows, summary.timeEntriesAtCap)} · expenses: {sourceRows(summary.expenseRows, summary.expensesAtCap)}.</p>
      {unknownTimeAmountCount ? (
        <p role="note" className="mt-1 text-xs leading-5 text-muted-foreground">
          {unknownTimeAmountCount.toLocaleString()} returned time {unknownTimeAmountCount === 1 ? 'entry has' : 'entries have'} no recorded amount and {unknownTimeAmountCount === 1 ? 'is' : 'are'} excluded from the known subtotal; the WIP amount is partial/unknown.
          {' '}Unknown amount counts by currency: {[...summary.unknownTimeAmountsByCurrency].map(([currency, count]) => `${count} ${currency}`).join(', ')}.
        </p>
      ) : null}
      {summary.timeEntriesUnavailable || summary.expensesUnavailable ? (
        <p role="note" className="mt-1 text-xs leading-5 text-muted-foreground">At least one source is unavailable, so the displayed known subtotal is incomplete.</p>
      ) : null}
      {summary.timeEntriesAtCap ? <p role="note" className="mt-1 text-xs leading-5 text-muted-foreground">The time-entry query returned its {REPORT_WIP_SOURCE_CAP} row cap; additional matching records may be omitted.</p> : null}
      {summary.expensesAtCap ? <p role="note" className="mt-1 text-xs leading-5 text-muted-foreground">The expense query returned its {REPORT_WIP_SOURCE_CAP} row cap; additional matching records may be omitted.</p> : null}
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Each submitted/approved source query independently returns up to {REPORT_WIP_SOURCE_CAP} rows and requests no total count; results below the cap do not establish complete coverage.</p>
    </div>
  )
}

function TrustSnapshotMetric({ amounts, sample }: { amounts: Map<string, number>; sample: TrustSnapshotSampleSummary }) {
  const sourceLabel = sample.rawSourceRows === null
    ? 'source unavailable'
    : `${sample.rawSourceRows.toLocaleString()} raw rows / ${sample.sourceCap} global source cap`
  return (
    <div className="min-w-0 border-b border-r border-border px-4 py-4 xl:border-b-0">
      <div className="space-y-1">
        {amounts.size ? [...amounts].map(([currency, value]) => <p key={currency} className="text-xl font-bold tabular-nums text-foreground">{money(value, currency)}</p>) : <p className="text-xl font-bold text-foreground">—</p>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Sampled trust snapshot amounts · {sourceLabel} · {sample.representedLedgers.toLocaleString()} ledgers represented</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Sum of one returned row per represented ledger within this bounded sample, grouped by currency—not complete per-ledger/as-of or reconciled client balances.</p>
      {sample.sourceCapReached ? <p className="mt-1 text-xs leading-5 text-muted-foreground">The 100-row cap was reached on raw query rows before dedup; additional global rows or ledgers may be omitted.</p> : null}
    </div>
  )
}

function TrustSnapshotRegister({
  rows,
  sample,
}: {
  rows: Array<{ id: string; balanceMinor: number; currencyCode: string; asOf: string; ledgerAccount?: { id: string; ledgerNumber: string; client: { displayName: string } } | null }>
  sample: TrustSnapshotSampleSummary
}) {
  const visibleRows = rows.slice(0, 50)
  return (
    <section className="min-w-0 border-t border-border pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">Client trust snapshot sample</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {sample.rawSourceRows === null
            ? 'Unavailable'
            : `${sample.rawSourceRows.toLocaleString()} raw rows · ${sample.representedLedgers.toLocaleString()} ledgers represented`}
        </span>
      </div>
      <p className="mt-2 max-w-4xl text-xs leading-5 text-muted-foreground">
        The session-aware query samples up to {sample.sourceCap} global client-balance snapshot rows ordered by as-of time descending, then ID ascending, and keeps the first returned row for each ledger. The ID tie-break makes equal-time selection repeatable but does not determine which tied balance is correct as of that timestamp. This is not complete per-ledger coverage, an authoritative as-of report, or a reconciled client balance.
      </p>
      {sample.sourceCapReached ? (
        <p role="note" className="mt-2 border-y border-border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {sample.sourceCap} raw source rows were returned, reaching the global query cap before per-ledger deduplication. Additional rows—including an otherwise-unseen ledger after the sample boundary—may be omitted.
        </p>
      ) : sample.rawSourceRows !== null ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">The query returned fewer than {sample.sourceCap} raw rows; it has no total count, so this does not establish complete ledger coverage.</p>
      ) : null}
      <div className="mt-3 divide-y divide-border border-y border-border">
        {visibleRows.map((item) => (
          <article key={item.id} className="grid min-w-0 gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.ledgerAccount?.client.displayName ?? 'Client ledger'}</p><p className="mt-1 truncate text-sm text-muted-foreground">{item.ledgerAccount?.ledgerNumber ?? 'ledger unavailable'} · {money(item.balanceMinor, item.currencyCode)} · {date(item.asOf)}</p></div>
            <PracticeStatus status={item.balanceMinor < 0 ? 'exception' : 'recorded'} />
          </article>
        ))}
        {!sample.rawSourceRows ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">
            {sample.rawSourceRows === null
              ? 'Client trust snapshot data is unavailable to this role.'
              : 'No client-balance snapshot rows were returned; this does not certify zero or reconciled client balances.'}
          </p>
        ) : !rows.length ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">No ledger-linked client trust snapshot rows were represented in this sample.</p>
        ) : null}
      </div>
      {sample.rawSourceRows !== null ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {visibleRows.length.toLocaleString()} shown of {rows.length.toLocaleString()} ledger rows represented after within-sample deduplication{rows.length > visibleRows.length ? ' · 50-row display cap' : ''}.
        </p>
      ) : null}
    </section>
  )
}

function ReportRows({ title, rows, emptyMessage }: { title: string; rows: Array<{ id: string; title: string; meta: string; status: string }>; emptyMessage: string }) {
  const visibleRows = rows.slice(0, ACCOUNTS_RECEIVABLE_DISPLAY_CAP)
  return <section className="min-w-0 border-t border-border pt-4"><div className="flex items-end justify-between gap-3"><h3 className="text-sm font-bold text-foreground">{title}</h3><span className="font-mono text-xs text-muted-foreground">{visibleRows.length} shown of {rows.length} loaded · {ACCOUNTS_RECEIVABLE_DISPLAY_CAP}-row display cap{rows.length === ACCOUNTS_RECEIVABLE_SOURCE_CAP ? ' · 100-row source cap' : ''}</span></div><div className="mt-3 divide-y divide-border border-y border-border">{visibleRows.map((row) => <article key={row.id} className="grid min-w-0 gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{row.title}</p><p className="mt-1 truncate text-sm text-muted-foreground">{row.meta}</p></div><PracticeStatus status={row.status} /></article>)}{!rows.length ? <p className="px-2 py-6 text-sm text-muted-foreground">{emptyMessage}</p> : null}</div></section>
}

type AuditRow = { id: string; eventId: string | null; eventType: string; category: string; outcome: string; occurredAt: string | null; actorType: string | null; actorUser: { name: string | null } | null; matter: { id: string; matterNumber: string | null } | null }

function AuditEventRegister({ register, reportDeadlinePage, timeZone }: { register: { auditEvents: AuditRow[]; total: number; pagination: WorkQueuePageInfo } | null; reportDeadlinePage: number; timeZone: string }) {
  return (
    <section id="audit-evidence" className="min-w-0 border-t border-border pt-4" aria-labelledby="audit-evidence-heading">
      <div className="flex items-end justify-between gap-3">
        <h3 id="audit-evidence-heading" className="text-sm font-bold text-foreground">Recent audit evidence</h3>
        <span className="font-mono text-xs text-muted-foreground">{register ? `${register.total.toLocaleString()} authorized` : 'Unavailable'}</span>
      </div>
      <div className="mt-3 divide-y divide-border border-y border-border">
        {register?.auditEvents.map((item) => (
          <article key={item.id} className="grid min-w-0 gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{item.eventType}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{item.category} · {formatInstant(item.occurredAt, timeZone)} · {item.actorUser?.name ?? (item.actorType ? `${item.actorType.replaceAll('_', ' ')} actor` : 'actor restricted')}{item.matter ? <> · <Link href={`/dashboard/platform/matters/${encodeURIComponent(item.matter.id)}`} className="underline-offset-4 hover:underline">{item.matter.matterNumber ?? 'Matter'}</Link></> : null}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">Ref {item.eventId ?? item.id}</p>
            </div>
            <PracticeStatus status={item.outcome} />
          </article>
        ))}
        {!register ? <p className="px-2 py-6 text-sm text-muted-foreground">Audit events are unavailable to this role.</p> : !register.auditEvents.length ? <p className="px-2 py-6 text-sm text-muted-foreground">No audit events were returned on this page.</p> : null}
      </div>
      {register ? <AuditEventPagination total={register.total} pagination={register.pagination} reportDeadlinePage={reportDeadlinePage} /> : null}
    </section>
  )
}

function AuditEventPagination({ total, pagination, reportDeadlinePage }: { total: number; pagination: WorkQueuePageInfo; reportDeadlinePage: number }) {
  const href = (page: number) => `/dashboard/platform/reports?auditPage=${page}&reportDeadlinePage=${reportDeadlinePage}#audit-evidence`
  return (
    <nav aria-label="Audit event pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <div className="space-y-1 text-xs leading-5 text-muted-foreground">
        <p>{pagination.loadedCount ? `Showing ${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}` : 'No records returned on this page'} of {total.toLocaleString()} authorized audit events · page {pagination.page} of {pagination.pageCount}.</p>
      </div>
      <div className="flex items-center gap-2">
        {pagination.hasPrevious ? <Link href={href(pagination.page - 1)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Previous</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Previous</span>}
        {pagination.hasNext ? <Link href={href(pagination.page + 1)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Next</span>}
      </div>
    </nav>
  )
}

type ReportDeadline = { id: string; title: string | null; status: string | null; dueAt: string | null; timezone: string | null; isVerified: boolean | null; matter: { id: string; matterNumber: string | null } | null; assignedTo: { name: string | null } | null }

function ReportDeadlineRegister({ register, auditPage, timeZone }: {
  register: { deadlines: ReportDeadline[]; total: number; pagination: WorkQueuePageInfo } | null
  auditPage: number
  timeZone: string
}) {
  return (
    <section id="deadline-control" className="min-w-0 border-t border-border pt-4" aria-labelledby="deadline-control-heading">
      <div className="flex items-end justify-between gap-3">
        <div><h3 id="deadline-control-heading" className="text-sm font-bold text-foreground">Deadline control</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Due times are shown in each deadline’s own time zone. Verification state is shown as recorded; deadlines are not calculated from court rules here.</p></div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{register ? `${register.total.toLocaleString()} authorized` : 'Unavailable'}</span>
      </div>
      <div className="mt-3 divide-y divide-border border-y border-border">
        {register?.deadlines.map((item) => (
          <article key={item.id} className="grid min-w-0 gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground"><Link href={`/dashboard/platform/work/deadline/${encodeURIComponent(item.id)}`} className="underline-offset-4 hover:underline">{item.title || 'Untitled deadline'}</Link></p><p className="mt-1 truncate text-sm text-muted-foreground">Due {formatInstant(item.dueAt, validTimeZone(item.timezone) ?? timeZone, { missing: 'time unavailable' })} · {item.matter?.matterNumber ?? 'Firm-level'} · {item.assignedTo?.name ?? 'owner restricted or unassigned'} · {item.isVerified ? 'verified' : 'requires verification'}</p></div>
            <PracticeStatus status={item.status ?? 'unknown'} />
          </article>
        ))}
        {!register ? <p className="px-2 py-6 text-sm text-muted-foreground">Deadline control is unavailable to this role.</p> : !register.deadlines.length ? <p className="px-2 py-6 text-sm text-muted-foreground">No deadlines were returned on this page.</p> : null}
      </div>
      {register ? <ReportDeadlinePagination total={register.total} pagination={register.pagination} auditPage={auditPage} /> : null}
    </section>
  )
}

function ReportDeadlinePagination({ total, pagination, auditPage }: { total: number; pagination: WorkQueuePageInfo; auditPage: number }) {
  const href = (page: number) => `/dashboard/platform/reports?auditPage=${auditPage}&reportDeadlinePage=${page}#deadline-control`
  return (
    <nav aria-label="Report deadline pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <div className="space-y-1 text-xs leading-5 text-muted-foreground">
        <p>{pagination.loadedCount ? `Showing ${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}` : 'No records returned on this page'} of {total.toLocaleString()} authorized pending/missed deadline records · page {pagination.page} of {pagination.pageCount}.</p>
      </div>
      <div className="flex items-center gap-2">
        {pagination.hasPrevious ? <Link href={href(pagination.page - 1)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Previous</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Previous</span>}
        {pagination.hasNext ? <Link href={href(pagination.page + 1)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Next</span>}
      </div>
    </nav>
  )
}

function money(value: number, currency: string) { return formatMinorUnits(value, currency) }
function date(value: unknown) { const parsed = value ? new Date(String(value)) : null; return parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(parsed) : 'no date' }
