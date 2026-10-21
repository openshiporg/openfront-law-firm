/* Hallmark · genre: modern-minimal · macrostructure: Workbench · theme: Quiet · enrichment: none */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CircleAlert, Clock3 } from 'lucide-react'

export { PracticePage } from './PracticePageFrame'
import { cn } from '@/lib/utils'

import type { PracticeOverviewQueueItem, PracticeWorkspaceSection } from '../operations/types'
import { formatInstant, isTimeSensitiveKind } from '../lib/datetime'
import type { WorkspaceLink } from '../workspaces/config'
import { PracticeRowAction } from './PracticeRowAction'

function words(value: string) {
  return value.replaceAll('_', ' ')
}

function statusTone(status: string) {
  if (['overdue', 'missed', 'failed', 'blocked', 'conflict_found', 'suspended'].includes(status)) {
    return 'border-destructive/25 bg-destructive/8 text-destructive'
  }
  if (['open', 'active', 'approved', 'issued', 'delivered', 'completed', 'cleared'].includes(status)) {
    return 'border-foreground/15 bg-foreground/[0.04] text-foreground'
  }
  return 'border-border bg-muted/55 text-muted-foreground'
}

export function PracticeStatus({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex min-h-6 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
      statusTone(status),
    )}>
      {words(status)}
    </span>
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
}) {
  const rowAnchor = anchor ?? viewAllHref.split('#')[1] ?? 'item'
  const rowActionPath = actionPath ?? viewAllHref.split('#')[0].split('?')[0]
  return (
    <section className="min-w-0 border-t border-border pt-4">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-[-0.015em] text-foreground">{title}</h2>
        </div>
        {pagination && paginationHrefs ? (
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">Page {pagination.page} of {pagination.pageCount}</span>
        ) : showViewAll ? (
          <Link href={viewAllHref} className="shrink-0 whitespace-nowrap text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            View all
          </Link>
        ) : null}
      </div>

      {items.length ? (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {items.map((item) => {
            const when = item.at ? formatInstant(item.at, timeZone, { includeTime: isTimeSensitiveKind(item.kind) }) : 'No date'
            return (
            <div
              id={`${rowAnchor}-${item.id}`}
              key={`${item.kind}-${item.id}`}
              className="grid min-h-16 min-w-0 scroll-mt-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto_auto] sm:px-2 lg:grid-cols-[8.5rem_minmax(0,1fr)_auto_auto_auto]"
            >
              <span className="hidden min-w-0 text-sm text-muted-foreground sm:block">{item.kind}</span>
              <Link
                href={item.href}
                className="group min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block truncate text-sm font-semibold text-foreground group-hover:underline group-hover:underline-offset-4">
                  {item.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground md:hidden">{when}</span>
              </Link>
              <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground md:flex">
                {item.at ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {when}
              </span>
              <PracticeStatus status={item.status} />
              <div className="col-span-2 justify-self-end sm:col-span-4 lg:col-span-1">
                <PracticeRowAction
                  id={item.id}
                  kind={item.kind}
                  status={item.status}
                  path={rowActionPath}
                  canAct={item.canAct}
                />
              </div>
            </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 flex min-h-32 items-center gap-3 border-y border-dashed border-border px-2 py-6 text-sm text-muted-foreground">
          <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{empty}</p>
        </div>
      )}
      {pagination && paginationHrefs ? (
        <nav aria-label={`${title} pages`} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="space-y-1 text-xs leading-5 text-muted-foreground">
            <p>
              {pagination.loadedCount
                ? `Showing ${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}`
                : 'No records returned on this page'} of {(authorizedTotal ?? 0).toLocaleString()} authorized records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {paginationHrefs.previous ? (
              <Link href={paginationHrefs.previous} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Previous</Link>
            ) : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Previous</span>}
            {paginationHrefs.next ? (
              <Link href={paginationHrefs.next} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next</Link>
            ) : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Next</span>}
          </div>
        </nav>
      ) : null}
    </section>
  )
}

export function WorkspaceIndex({ links }: { links: WorkspaceLink[] }) {
  return (
    <section aria-label="Workspace tools" className="border-y border-border">
      <div className="divide-y divide-border">
        {links.map((link, index) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'group grid min-h-20 min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-1 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-4 sm:px-3',
                index === 0 && 'bg-muted/25',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold tracking-[-0.01em] text-foreground">{link.title}</span>
                <span className="mt-1 block max-w-3xl text-sm leading-5 text-muted-foreground">{link.description}</span>
              </span>
              <span className="hidden items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground sm:flex">
                {link.action}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function PracticeLoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex min-h-36 items-start gap-3 border-y border-destructive/25 bg-destructive/5 px-4 py-6 text-sm text-foreground">
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <div>
        <p className="font-semibold">The practice workspace could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
