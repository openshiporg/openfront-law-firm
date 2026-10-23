import Link from 'next/link'
import type { ReactNode } from 'react'

import { getPracticeReports } from '../actions/getPracticeReports'
import { formatInstant, validTimeZone } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { formatMinorUnits } from '@/features/platform/lib/money'
import { registerHref } from '@/features/platform/operations/lib/workspaceRegister'
import type { WorkQueuePageInfo } from '@/features/platform/operations/lib/workQueuePagination'
import {
  EmptyState,
  Notice,
  Pager,
  RowList,
  SectionHeader,
  Stats,
  StatusDot,
  TitleLine,
  Track,
  pillClass,
  statusLabel,
  statusTone,
} from '@/features/platform/components/ui'
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

type ArRow = { id: string; invoiceNumber: string; status: string; balanceDueMinor: number; currencyCode: string; dueAt?: string | null; matter?: { matterNumber?: string | null } | null; client?: { displayName?: string | null } | null }

export async function PracticeReportsPanel({ auditPage = 1, reportDeadlinePage = 1 }: { auditPage?: number; reportDeadlinePage?: number }) {
  const [reports, timeZone] = await Promise.all([getPracticeReports(auditPage, reportDeadlinePage), getFirmTimeZone()])
  const notices: string[] = []
  const arSourceRows = reports.ar.success ? reports.ar.data.invoices : null
  if (arSourceRows === null) notices.push('Invoices are hidden for your role.')
  const ar = arSourceRows ?? []
  const arSample = summarizeAccountsReceivableSample(arSourceRows)
  const time = reports.time.success ? reports.time.data.timeEntries : null
  if (time === null) notices.push('Time entries are hidden for your role.')
  const expenses = reports.expenses.success ? reports.expenses.data.expenses : null
  if (expenses === null) notices.push('Expenses are hidden for your role.')
  const deadlines = reports.deadlines.success ? reports.deadlines.data : (notices.push('Deadlines are hidden for your role.'), null)
  const trustSnapshotSourceRows = reports.trust.success ? reports.trust.data.trustBalanceSnapshots : null
  if (!reports.trust.success) notices.push('Trust balances are hidden for your role.')
  const snapshots = trustSnapshotSourceRows ? latestLedgerSnapshots(trustSnapshotSourceRows) : []
  const trustSample = summarizeTrustSnapshotSample(trustSnapshotSourceRows, snapshots)
  const wipSummary = summarizeReportWipAmounts(time, expenses)
  const audit = reports.audit.success ? reports.audit.data : (notices.push('The activity log is hidden for your role.'), null)

  const registers: Array<[string, string]> = [
    ['Invoices', registerHref('billing', { view: 'invoices' })],
    ['Time', registerHref('time-expenses', { view: 'time' })],
    ['Expenses', registerHref('time-expenses', { view: 'expenses' })],
    ['Client ledgers', registerHref('accounting', { view: 'ledgers' })],
  ]

  return (
    <section className="min-w-0 space-y-6" aria-labelledby="operational-reports-heading">
      <SectionHeader
        id="operational-reports-heading"
        title="Practice reports"
        actions={(
          <nav aria-label="Full lists">
            <Track>
              {registers.map(([label, href]) => <Link key={label} href={href} className={pillClass}>{label}</Link>)}
            </Track>
          </nav>
        )}
      />

      {notices.length ? <Notice>{notices.join(' ')}</Notice> : null}

      <div className="space-y-3">
        <Stats
          items={[
            ['Outstanding invoices', <Amounts key="ar" amounts={sumCurrencies(ar)} />],
            ['Unbilled work', <Amounts key="wip" amounts={wipSummary.knownAmountsByCurrency} />],
            ['Trust balances', <Amounts key="trust" amounts={sumCurrencies(snapshots)} />],
            ['Open deadlines', deadlines ? <span key="deadlines">{deadlines.openTotal.toLocaleString()}{deadlines.missedTotal ? <span className="block text-xs font-medium text-destructive">{deadlines.missedTotal.toLocaleString()} missed</span> : null}</span> : '—'],
          ]}
        />
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          <AccountsReceivableBasis sample={arSample} />
          <WipBasis summary={wipSummary} />
          <TrustBasis sample={trustSample} />
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <AccountsReceivableRegister rows={ar} unavailable={arSourceRows === null} />
        <TrustSnapshotRegister rows={snapshots} sample={trustSample} />
      </div>
      <ReportDeadlineRegister register={deadlines} auditPage={auditPage} timeZone={timeZone} />
      <AuditEventRegister register={audit} reportDeadlinePage={reportDeadlinePage} timeZone={timeZone} />
    </section>
  )
}

function Amounts({ amounts }: { amounts: Map<string, number> }) {
  if (!amounts.size) return <>—</>
  return <span className="block space-y-0.5">{[...amounts].map(([currency, value]) => <span key={currency} className="block truncate">{money(value, currency)}</span>)}</span>
}

/** Figure basis: the caveats that qualify a headline figure, one line each. */
function Basis({ title, lines }: { title: string; lines: Array<ReactNode | null | false> }) {
  const shown = lines.filter(Boolean)
  return (
    <div role="note" className="min-w-0 rounded-lg bg-muted/60 px-3 py-2">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
        {shown.map((line, index) => <li key={index}>{line}</li>)}
      </ul>
    </div>
  )
}

function AccountsReceivableBasis({ sample }: { sample: ReturnType<typeof summarizeAccountsReceivableSample> }) {
  return (
    <Basis
      title="Outstanding invoices"
      lines={[
        sample.rawSourceRows === null
          ? 'Hidden for your role.'
          : sample.rawSourceRows === 0
            ? 'No unpaid invoices.'
            : `${sample.rawSourceRows.toLocaleString()} unpaid ${sample.rawSourceRows === 1 ? 'invoice' : 'invoices'}.`,
        sample.sourceCapReached ? `Counts the first ${sample.sourceCap} unpaid invoices; the full total may be higher.` : null,
      ]}
    />
  )
}

function WipBasis({ summary }: { summary: ReportWipAmountSummary }) {
  const unknownTimeAmountCount = [...summary.unknownTimeAmountsByCurrency.values()].reduce((total, count) => total + count, 0)
  return (
    <Basis
      title="Unbilled work"
      lines={[
        summary.timeEntriesUnavailable && summary.expensesUnavailable
          ? 'Hidden for your role.'
          : `${(summary.timeEntryRows ?? 0).toLocaleString()} time ${summary.timeEntryRows === 1 ? 'entry' : 'entries'} · ${(summary.expenseRows ?? 0).toLocaleString()} ${summary.expenseRows === 1 ? 'expense' : 'expenses'} submitted or approved.`,
        unknownTimeAmountCount
          ? `${unknownTimeAmountCount.toLocaleString()} time ${unknownTimeAmountCount === 1 ? 'entry has' : 'entries have'} no amount yet and ${unknownTimeAmountCount === 1 ? 'is' : 'are'} not included.`
          : null,
        !(summary.timeEntriesUnavailable && summary.expensesUnavailable) && (summary.timeEntriesUnavailable || summary.expensesUnavailable) ? 'Some entries are hidden for your role.' : null,
        summary.timeEntriesAtCap || summary.expensesAtCap ? `Counts the first ${REPORT_WIP_SOURCE_CAP} of each; the full total may be higher.` : null,
      ]}
    />
  )
}

function TrustBasis({ sample }: { sample: TrustSnapshotSampleSummary }) {
  return (
    <Basis
      title="Trust balances"
      lines={[
        sample.rawSourceRows === null
          ? 'Hidden for your role.'
          : sample.representedLedgers === 0
            ? 'No trust balances recorded.'
            : `Latest recorded balance for ${sample.representedLedgers.toLocaleString()} client ${sample.representedLedgers === 1 ? 'ledger' : 'ledgers'}. Reconcile in Accounting.`,
        sample.sourceCapReached ? `Checks the latest ${sample.sourceCap} balance records; some ledgers may be missing.` : null,
      ]}
    />
  )
}

function RegisterHeading({ id, title, meta }: { id?: string; title: string; meta: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 id={id} className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h3>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{meta}</span>
    </div>
  )
}

const th = 'whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground'
const td = 'px-3 py-2.5 align-top'

function AccountsReceivableRegister({ rows, unavailable }: { rows: ArRow[]; unavailable: boolean }) {
  const visibleRows = rows.slice(0, ACCOUNTS_RECEIVABLE_DISPLAY_CAP)
  return (
    <section className="min-w-0 space-y-3">
      <RegisterHeading
        title="Outstanding invoices"
        meta={visibleRows.length < rows.length ? `${visibleRows.length} of ${rows.length}${rows.length === ACCOUNTS_RECEIVABLE_SOURCE_CAP ? '+' : ''}` : rows.length.toLocaleString()}
      />
      {!rows.length ? (
        <EmptyState title={unavailable ? 'Invoices are hidden for your role.' : 'No unpaid invoices.'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[34rem] text-sm tabular-nums">
            <thead className="border-b border-border bg-muted/40">
              <tr><th className={th}>Invoice</th><th className={th}>Matter</th><th className={th}>Client</th><th className={th}>Due</th><th className={`${th} text-right`}>Balance due</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.map((item) => (
                <tr key={item.id}>
                  <td className={td}>
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusDot tone={statusTone(item.status)} />
                      <span className="truncate font-medium text-foreground">{item.invoiceNumber}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{statusLabel(item.status)}</span>
                    </span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted-foreground`}>{item.matter?.matterNumber ?? '—'}</td>
                  <td className={`${td} max-w-[12rem] truncate text-muted-foreground`}>{item.client?.displayName ?? '—'}</td>
                  <td className={`${td} whitespace-nowrap text-muted-foreground`}>{date(item.dueAt)}</td>
                  <td className={`${td} whitespace-nowrap text-right font-medium text-foreground`}>{money(item.balanceDueMinor, item.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
    <section className="min-w-0 space-y-3">
      <RegisterHeading
        title="Trust balances"
        meta={sample.rawSourceRows === null ? 'Hidden' : visibleRows.length < rows.length ? `${visibleRows.length} of ${rows.length}` : rows.length.toLocaleString()}
      />
      {!sample.rawSourceRows ? (
        <EmptyState title={sample.rawSourceRows === null ? 'Trust balances are hidden for your role.' : 'No trust balances recorded.'} />
      ) : !rows.length ? (
        <EmptyState title="No client ledger balances recorded." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[30rem] text-sm tabular-nums">
            <thead className="border-b border-border bg-muted/40">
              <tr><th className={th}>Client</th><th className={th}>Ledger</th><th className={th}>As of</th><th className={`${th} text-right`}>Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.map((item) => {
                return (
                  <tr key={item.id}>
                    <td className={td}>
                      <span className="flex min-w-0 items-center gap-2">
                        <StatusDot tone={item.balanceMinor < 0 ? 'rose' : 'emerald'} />
                        <span className="max-w-[12rem] truncate font-medium text-foreground">{item.ledgerAccount?.client.displayName ?? 'Client ledger'}</span>
                        {item.balanceMinor < 0 ? <span className="shrink-0 text-xs font-medium text-destructive">Overdrawn</span> : null}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-muted-foreground`}>{item.ledgerAccount?.ledgerNumber ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-muted-foreground`}>{date(item.asOf)}</td>
                    <td className={`${td} whitespace-nowrap text-right font-medium ${item.balanceMinor < 0 ? 'text-destructive' : 'text-foreground'}`}>{money(item.balanceMinor, item.currencyCode)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

type AuditRow = { id: string; eventId: string | null; eventType: string; category: string; outcome: string; occurredAt: string | null; actorType: string | null; actorUser: { name: string | null } | null; matter: { id: string; matterNumber: string | null } | null }

function AuditEventRegister({ register, reportDeadlinePage, timeZone }: { register: { auditEvents: AuditRow[]; total: number; pagination: WorkQueuePageInfo } | null; reportDeadlinePage: number; timeZone: string }) {
  return (
    <section id="audit-evidence" className="min-w-0 scroll-mt-20 space-y-3" aria-labelledby="audit-evidence-heading">
      <RegisterHeading id="audit-evidence-heading" title="Activity log" meta={register ? register.total.toLocaleString() : 'Hidden'} />
      {!register ? (
        <EmptyState title="The activity log is hidden for your role." />
      ) : !register.auditEvents.length ? (
        <EmptyState title="No activity on this page." />
      ) : (
        <RowList label="Activity log">
          {register.auditEvents.map((item) => (
            <li key={item.id} className="min-w-0 px-4 py-3">
              <TitleLine as="p" status={item.outcome} headingClassName="text-sm"><span title={`Ref ${item.eventId ?? item.id}`}>{humanEvent(item.eventType)}</span></TitleLine>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {item.category.replaceAll('_', ' ')} · {formatInstant(item.occurredAt, timeZone)} · {item.actorUser?.name ?? (item.actorType === 'user' ? 'Staff member' : item.actorType ? item.actorType.replaceAll('_', ' ') : 'Hidden')}
                {item.matter ? <> · <Link href={`/dashboard/platform/matters/${encodeURIComponent(item.matter.id)}`} className="underline-offset-4 hover:underline">{item.matter.matterNumber ?? 'Matter'}</Link></> : null}
              </p>
            </li>
          ))}
        </RowList>
      )}
      {register ? <AuditEventPagination total={register.total} pagination={register.pagination} reportDeadlinePage={reportDeadlinePage} /> : null}
    </section>
  )
}

function pageSummary(pagination: WorkQueuePageInfo, total: number) {
  return `${pagination.loadedCount ? `${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}` : 'None'} of ${total.toLocaleString()} · page ${pagination.page} of ${pagination.pageCount}`
}

function AuditEventPagination({ total, pagination, reportDeadlinePage }: { total: number; pagination: WorkQueuePageInfo; reportDeadlinePage: number }) {
  const href = (page: number) => `/dashboard/platform/reports?auditPage=${page}&reportDeadlinePage=${reportDeadlinePage}#audit-evidence`
  return (
    <Pager
      label="Activity log pages"
      summary={pageSummary(pagination, total)}
      previous={pagination.hasPrevious ? href(pagination.page - 1) : null}
      next={pagination.hasNext ? href(pagination.page + 1) : null}
    />
  )
}

type ReportDeadline = { id: string; title: string | null; status: string | null; dueAt: string | null; timezone: string | null; isVerified: boolean | null; matter: { id: string; matterNumber: string | null } | null; assignedTo: { name: string | null } | null }

function ReportDeadlineRegister({ register, auditPage, timeZone }: {
  register: { deadlines: ReportDeadline[]; total: number; openTotal: number; missedTotal: number; pagination: WorkQueuePageInfo } | null
  auditPage: number
  timeZone: string
}) {
  return (
    <section id="deadline-control" className="min-w-0 scroll-mt-20 space-y-3" aria-labelledby="deadline-control-heading">
      <RegisterHeading id="deadline-control-heading" title="Open and missed deadlines" meta={register ? `${register.openTotal.toLocaleString()} open · ${register.missedTotal.toLocaleString()} missed` : 'Hidden'} />
      <Notice>Times are in each deadline’s own time zone.</Notice>
      {!register ? (
        <EmptyState title="Deadlines are hidden for your role." />
      ) : !register.deadlines.length ? (
        <EmptyState title="No deadlines on this page." />
      ) : (
        <RowList label="Deadlines">
          {register.deadlines.map((item) => (
            <li key={item.id} className="min-w-0 px-4 py-3">
              <TitleLine as="p" status={item.status ?? 'unknown'} headingClassName="text-sm">
                <Link href={`/dashboard/platform/work/deadline/${encodeURIComponent(item.id)}`} className="underline-offset-4 hover:underline">{item.title || 'Untitled deadline'}</Link>
              </TitleLine>
              <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="tabular-nums">Due {formatInstant(item.dueAt, validTimeZone(item.timezone) ?? timeZone, { missing: 'time unavailable' })}</span>
                <span>{item.matter?.matterNumber ?? 'Firm-level'}</span>
                <span className="truncate">{item.assignedTo?.name ?? 'Unassigned'}</span>
                <span className={item.isVerified ? undefined : 'font-medium text-amber-700 dark:text-amber-400'}>{item.isVerified ? 'Verified' : 'Unverified'}</span>
              </div>
            </li>
          ))}
        </RowList>
      )}
      {register ? <ReportDeadlinePagination total={register.total} pagination={register.pagination} auditPage={auditPage} /> : null}
    </section>
  )
}

function ReportDeadlinePagination({ total, pagination, auditPage }: { total: number; pagination: WorkQueuePageInfo; auditPage: number }) {
  const href = (page: number) => `/dashboard/platform/reports?auditPage=${auditPage}&reportDeadlinePage=${page}#deadline-control`
  return (
    <Pager
      label="Deadline pages"
      summary={pageSummary(pagination, total)}
      previous={pagination.hasPrevious ? href(pagination.page - 1) : null}
      next={pagination.hasNext ? href(pagination.page + 1) : null}
    />
  )
}

function humanEvent(eventType: string) {
  const text = eventType.replaceAll('.', ' ').replaceAll('_', ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Activity'
}
function money(value: number, currency: string) { return formatMinorUnits(value, currency) }
function date(value: unknown) { const parsed = value ? new Date(String(value)) : null; return parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(parsed) : '—' }
