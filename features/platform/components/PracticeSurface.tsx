import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CircleAlert } from 'lucide-react'

export { PracticePage } from './PracticePageFrame'
import { cn } from '@/lib/utils'

import type { PracticeOverviewQueueItem, PracticeWorkspaceSection } from '../operations/types'
import { formatInstant, isTimeSensitiveKind } from '../lib/datetime'
import type { WorkspaceLink } from '../workspaces/config'
import { PracticeRowAction } from './PracticeRowAction'
import { EmptyState, Pager, StatusDot, StatusText, pillClass, statusLabel, statusTone } from './ui'

/** Status as a dot and label; place it on the record's title line. */
export function PracticeStatus({ status }: { status: string }) {
  return <StatusText status={status} />
}

/** One queue row: kind and date on the left rail, title line with its status dot, row action. */
export function QueueRow({ item, href, actionPath, timeZone, anchor }: { item: PracticeOverviewQueueItem; href: string | null; actionPath: string; timeZone: string; anchor?: string }) {
  const when = item.at ? formatInstant(item.at, timeZone, { includeTime: isTimeSensitiveKind(item.kind) }) : 'No date'
  const title = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot tone={statusTone(item.status)} />
        <span className="min-w-0 truncate text-sm font-semibold text-foreground group-hover:underline group-hover:underline-offset-4">{item.title}</span>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(item.status)}</span>
      </span>
      <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{item.subtitle}</span>
    </>
  )
  return (
    <li id={anchor ? `${anchor}-${item.id}` : undefined} className="grid min-w-0 scroll-mt-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]">
      <span className="col-span-2 flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:col-span-1 sm:flex-col sm:items-start sm:gap-0.5">
        <span className="truncate">{item.kind}</span>
        <span className="truncate font-mono normal-case tracking-normal tabular-nums">{when}</span>
      </span>
      {href ? <Link href={href} className="group min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{title}</Link> : <div className="min-w-0">{title}</div>}
      <div className="justify-self-end">
        <PracticeRowAction id={item.id} kind={item.kind} status={item.status} path={actionPath} canAct={item.canAct} />
      </div>
    </li>
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
}) {
  const rowAnchor = anchor ?? viewAllHref.split('#')[1] ?? 'item'
  const rowActionPath = actionPath ?? viewAllHref.split('#')[0].split('?')[0]
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-foreground">
          <span className="truncate">{title}</span>
          {typeof count === 'number' ? <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{count.toLocaleString()}</span> : null}
        </h2>
        {pagination && paginationHrefs ? (
          <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">{pagination.page} / {pagination.pageCount}</span>
        ) : showViewAll ? (
          <Link href={viewAllHref} className={cn(pillClass, 'h-7 px-3 text-xs')}>View all <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
        ) : null}
      </header>

      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <QueueRow key={`${item.kind}-${item.id}`} item={item} href={item.href} actionPath={rowActionPath} timeZone={timeZone} anchor={rowAnchor} />
          ))}
        </ul>
      ) : (
        <div className="p-4"><EmptyState title={empty} /></div>
      )}
      {pagination && paginationHrefs ? (
        <div className="border-t border-border px-4 py-3">
          <Pager
            label={`${title} pages`}
            previous={paginationHrefs.previous}
            next={paginationHrefs.next}
            summary={pagination.loadedCount
              ? `${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()} of ${(authorizedTotal ?? 0).toLocaleString()}`
              : `0 of ${(authorizedTotal ?? 0).toLocaleString()}`}
          />
        </div>
      ) : null}
    </section>
  )
}

export function WorkspaceIndex({ links }: { links: WorkspaceLink[] }) {
  return (
    <nav aria-label="Workspace tools" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs outline-none transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)]">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{link.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{link.action}</span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        )
      })}
    </nav>
  )
}

export function PracticeLoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-destructive">Workspace unavailable</p>
        <p className="mt-0.5 text-muted-foreground [overflow-wrap:anywhere]">{message}</p>
      </div>
    </div>
  )
}

/** In-page section jumps for long workspaces, as a recessed track. */
export function SectionJumps({ sections }: { sections: Array<{ key: string; title: string; total?: number }> }): ReactNode {
  if (sections.length < 2) return null
  return (
    <nav aria-label="Sections" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] [scrollbar-width:none] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]">
      {sections.map((section) => (
        <a key={section.key} href={`#${section.key}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50">
          {section.title}
          {typeof section.total === 'number' ? <span className="font-mono text-xs tabular-nums opacity-70">{section.total.toLocaleString()}</span> : null}
        </a>
      ))}
    </nav>
  )
}
