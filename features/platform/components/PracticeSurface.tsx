import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CircleAlert } from 'lucide-react'

export { PracticePage } from './PracticePageFrame'
export { SectionTabs as SectionJumps } from './SectionTabs'
import { cn } from '@/lib/utils'

import type { PracticeOverviewQueueItem, PracticeWorkspaceSection } from '../operations/types'
import { formatInstant, isTimeSensitiveKind } from '../lib/datetime'
import type { WorkspaceLink } from '../workspaces/config'
import { PracticeRowAction } from './PracticeRowAction'
import { FileLabel, Pager, StatusText, actionLinkClass, splitFileNumber } from './ui'

/** Status as a mark and label, for a header's status slot. */
export function PracticeStatus({ status }: { status: string }) {
  return <StatusText status={status} />
}

const cellClass = 'align-middle sm:px-3 sm:py-2.5 sm:first:pl-4 sm:last:pr-4'

/** Ledger table of practice records: record, kind, status, date and the row's next action.
 * Below `sm` each row stacks: record line, then kind, status and date on one line. */
export function RecordTable({ items, rowHref, actionPath, timeZone, anchor, empty, showKind = true, compact = false, label }: {
  items: PracticeOverviewQueueItem[]
  rowHref?: (item: PracticeOverviewQueueItem) => string | null
  actionPath: string
  timeZone: string
  anchor?: string
  empty: string
  showKind?: boolean
  /** Half-width tables: the date moves into the record line. */
  compact?: boolean
  label?: string
}) {
  if (!items.length) return <p role="status" className="px-4 py-4 text-sm text-muted-foreground">{empty}</p>
  return (
    <table aria-label={label} className="w-full min-w-0 border-collapse text-sm">
      <thead className="max-sm:sr-only">
        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground [&>th]:bg-[var(--lf-manila)] [&>th:first-child]:rounded-tl-[5px] [&>th:last-child]:rounded-tr-[5px]">
          <th scope="col" className={cn(cellClass, 'py-2 font-medium')}>Record</th>
          {showKind ? <th scope="col" className={cn(cellClass, 'w-36 py-2 font-medium max-lg:hidden')}>Type</th> : null}
          <th scope="col" className={cn(cellClass, 'w-36 py-2 font-medium')}>Status</th>
          {compact ? null : <th scope="col" className={cn(cellClass, 'w-40 py-2 font-medium')}>Date</th>}
          <th scope="col" className={cn(cellClass, 'w-px py-2 text-right font-medium')}><span className="sr-only">Action</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map((item) => (
          <RecordRow key={`${item.kind}-${item.id}`} item={item} href={rowHref ? rowHref(item) : item.href} actionPath={actionPath} timeZone={timeZone} anchor={anchor} showKind={showKind} compact={compact} />
        ))}
      </tbody>
    </table>
  )
}

export function RecordRow({ item, href, actionPath, timeZone, anchor, showKind = true, compact = false }: { item: PracticeOverviewQueueItem; href: string | null; actionPath: string; timeZone: string; anchor?: string; showKind?: boolean; compact?: boolean }) {
  const when = item.at ? formatInstant(item.at, timeZone, { includeTime: isTimeSensitiveKind(item.kind) }) : 'No date'
  const { number, rest } = splitFileNumber(item.subtitle ?? '')
  const title = <span className="block truncate font-medium text-foreground group-hover:text-[var(--lf-rust-ink)] group-hover:underline group-hover:underline-offset-4">{item.title}</span>
  return (
    <tr id={anchor ? `${anchor}-${item.id}` : undefined} className="scroll-mt-28 transition-colors hover:bg-muted/40 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:px-4 max-sm:py-3">
      <td className={cn(cellClass, 'min-w-0 max-w-0 max-sm:col-span-2 max-sm:max-w-none')}>
        {href ? <Link href={href} className="group block min-w-0 rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lf-rust)]/40">{title}</Link> : <span className="block min-w-0">{title}</span>}
        <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {number ? <FileLabel>{number}</FileLabel> : null}
          <span className="truncate">{rest}</span>
          <span className={cn('lf-figures ml-auto shrink-0 whitespace-nowrap font-mono', compact ? '' : 'sm:hidden')}>{when}</span>
        </span>
      </td>
      {showKind ? <td className={cn(cellClass, 'whitespace-nowrap text-xs text-muted-foreground max-lg:hidden')}>{item.kind}</td> : null}
      <td className={cn(cellClass, 'max-sm:mt-2 max-sm:self-center')}><StatusText status={item.status} /></td>
      {compact ? null : <td className={cn(cellClass, 'lf-figures whitespace-nowrap font-mono text-xs text-muted-foreground max-sm:hidden')}>{when}</td>}
      <td className={cn(cellClass, 'text-right max-sm:mt-2')}>
        <PracticeRowAction id={item.id} kind={item.kind} status={item.status} path={actionPath} canAct={item.canAct} timeZone={timeZone} />
      </td>
    </tr>
  )
}

/** A heading row and the range in view above a framed ledger table. */
export function RecordSection({ id, title, count, range, actions, children, footer, className }: { id?: string; title: ReactNode; count?: number; range?: ReactNode; actions?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className={cn('min-w-0 scroll-mt-28', className)}>
      <header className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id ? `${id}-heading` : undefined} className="flex min-w-0 items-baseline gap-2 text-[15px] font-semibold tracking-tight text-foreground">
          <span className="truncate">{title}</span>
          {typeof count === 'number' ? <span className="lf-figures text-sm font-normal text-muted-foreground">{count.toLocaleString()}</span> : null}
        </h2>
        <div className="flex min-w-0 items-baseline gap-4">
          {range ? <span className="lf-figures text-xs text-muted-foreground">{range}</span> : null}
          {actions}
        </div>
      </header>
      <div className="min-w-0 rounded-[6px] border border-border bg-card">
        {children}
        {footer ? <div className="border-t border-border px-4 py-2.5">{footer}</div> : null}
      </div>
    </section>
  )
}

export function QueuePanel({
  title,
  items,
  empty,
  viewAllHref,
  showViewAll = true,
  pagination,
  authorizedTotal,
  paginationHrefs,
  anchor,
  actionPath,
  timeZone = 'UTC',
  count,
  showKind,
  compact,
  className,
}: {
  title: string
  description: string
  items: PracticeOverviewQueueItem[]
  empty: string
  viewAllHref: string
  showViewAll?: boolean
  pagination?: PracticeWorkspaceSection['pagination']
  authorizedTotal?: number
  paginationHrefs?: { previous: string | null; next: string | null }
  anchor?: string
  actionPath?: string
  timeZone?: string
  count?: number
  showKind?: boolean
  compact?: boolean
  className?: string
}) {
  const rowAnchor = anchor ?? viewAllHref.split('#')[1] ?? 'item'
  const rowActionPath = actionPath ?? viewAllHref.split('#')[0].split('?')[0]
  const paged = Boolean(pagination && paginationHrefs)
  return (
    <RecordSection
      title={title}
      count={count}
      className={className}
      range={paged && pagination ? `Page ${pagination.page} of ${pagination.pageCount}` : undefined}
      actions={!paged && showViewAll ? <Link href={viewAllHref} className={actionLinkClass}>View all<ArrowRight className="size-3.5" aria-hidden="true" /></Link> : undefined}
      footer={pagination && paginationHrefs ? (
        <Pager
          label={`${title} pages`}
          previous={paginationHrefs.previous}
          next={paginationHrefs.next}
          summary={pagination.loadedCount
            ? `${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()} of ${(authorizedTotal ?? 0).toLocaleString()}`
            : `0 of ${(authorizedTotal ?? 0).toLocaleString()}`}
        />
      ) : undefined}
    >
      <RecordTable items={items} actionPath={rowActionPath} timeZone={timeZone} anchor={rowAnchor} empty={empty} showKind={showKind} compact={compact} label={title} />
    </RecordSection>
  )
}

export function WorkspaceIndex({ links }: { links: WorkspaceLink[] }) {
  return (
    <nav aria-label="Workspace tools" className="grid overflow-hidden rounded-[6px] border border-border bg-card sm:grid-cols-2 xl:grid-cols-3">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className="group -mb-px -mr-px flex min-w-0 items-center gap-3 border-b border-r border-border p-4 outline-none transition-colors hover:bg-[var(--lf-manila)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lf-rust)]/40"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground group-hover:text-[var(--lf-rust-ink)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{link.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{link.action}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        )
      })}
    </nav>
  )
}

export function PracticeLoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[4px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-destructive">Workspace unavailable</p>
        <p className="mt-0.5 text-muted-foreground [overflow-wrap:anywhere]">{message}</p>
      </div>
    </div>
  )
}
