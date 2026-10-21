import Link from 'next/link'
import { ArrowLeft, CircleAlert, Search } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'

import type { WorkspaceRegister } from '../operations/actions/getWorkspaceRegister'
import { registerHref } from '../operations/lib/workspaceRegister'
import type { PracticeOverviewQueueItem } from '../operations/types'
import { formatInstant, isTimeSensitiveKind } from '../lib/datetime'
import { PracticeRowAction } from './PracticeRowAction'
import { PracticeStatus } from './PracticeSurface'

const words = (value: string) => value.replaceAll('_', ' ')

// Full register for one workspace section: URL-backed search, status and sort that
// survive paging, reload and back navigation.
export function WorkspaceRegisterView({
  register,
  backHref,
  backLabel,
  timeZone,
  rowHref,
}: {
  register: WorkspaceRegister
  backHref: string
  backLabel: string
  timeZone: string
  rowHref?: (item: PracticeOverviewQueueItem) => string | null
}) {
  const { params, pagination } = register
  const action = `/dashboard/platform/${register.category}`
  const pageHref = (page: number) => registerHref(register.category, { ...params, page })
  const filtered = Boolean(params.q || params.status || (params.sort && params.sort !== 'default'))

  return (
    <section aria-labelledby="register-heading" className="space-y-6">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}
      </Link>
      <div className="border-b border-border pb-3">
        <h2 id="register-heading" className="text-lg font-bold tracking-tight text-foreground">{params.scope === "history" ? "History and current records" : register.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{register.description}</p>
      </div>

      <form method="get" action={action} role="search" aria-label={`Filter ${register.title.toLowerCase()}`} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="view" value={register.key} />
        {register.historyAvailable ? <label className="block min-w-0 text-xs font-semibold" htmlFor="register-scope">Inventory<FormSelect id="register-scope" name="scope" defaultValue={params.scope ?? "queue"} className="mt-2"><option value="queue">Operational queue</option><option value="history">Include completed and terminal history</option></FormSelect></label> : null}
        {register.searchable ? (
          <label className="block min-w-0 text-xs font-semibold text-foreground" htmlFor="register-q">
            Search
            <span className="relative mt-2 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="register-q" name="q" type="search" defaultValue={params.q} maxLength={100} className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </span>
          </label>
        ) : <p className="text-xs text-muted-foreground sm:self-center">This register shows status and timing only, so it has no text search.</p>}
        {register.statusOptions.length ? (
          <label className="block min-w-0 text-xs font-semibold text-foreground" htmlFor="register-status">
            Status
            <FormSelect id="register-status" name="status" defaultValue={params.status} aria-label="Status" className="mt-2">
              <option value="">All statuses</option>
              {register.statusOptions.map((status) => <option key={status} value={status}>{words(status)}</option>)}
            </FormSelect>
          </label>
        ) : null}
        <label className="block min-w-0 text-xs font-semibold text-foreground" htmlFor="register-sort">
          Sort
          <FormSelect id="register-sort" name="sort" defaultValue={params.sort || 'default'} required aria-label="Sort" className="mt-2">
            {register.sortOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </FormSelect>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Apply</button>
          {filtered ? <Link href={registerHref(register.category, { view: register.key })} className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted">Clear</Link> : null}
        </div>
      </form>

      <p role="status" className="text-sm text-muted-foreground">
        {pagination.loadedCount
          ? `Showing ${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()} of ${register.total.toLocaleString()} authorized records`
          : register.total ? 'No records on this page' : filtered ? 'No authorized records match these filters' : 'No authorized records'}
        {params.q ? ` matching “${params.q}”` : ''}.
      </p>

      {register.items.length ? (
        <div className="divide-y divide-border border-y border-border">
          {register.items.map((item) => {
            const destination = rowHref ? rowHref(item) : item.href
            // Preview anchors are not object destinations: late-page rows must
            // not navigate to an unrelated first-twelve preview without this ID.
            const href = destination?.startsWith(`/dashboard/platform/${register.category}#`) ? null : destination
            const when = item.at ? formatInstant(item.at, timeZone, { includeTime: isTimeSensitiveKind(item.kind) }) : 'No date'
            const heading = <><span className="block truncate text-sm font-semibold text-foreground">{item.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.subtitle}</span><span className="mt-0.5 block text-xs tabular-nums text-muted-foreground sm:hidden">{when}</span></>
            return (
              <article id={`${register.key}-${item.id}`} key={`${item.kind}-${item.id}`} className="grid min-w-0 scroll-mt-24 gap-3 px-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3">
                {href ? <Link href={href} className="min-w-0 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{heading}</Link> : <div className="min-w-0">{heading}</div>}
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                  <span className="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:inline">{when}</span>
                  <PracticeStatus status={item.status} />
                  <PracticeRowAction id={item.id} kind={item.kind} status={item.status} path={`/dashboard/platform/${register.category}`} canAct={item.canAct} />
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-32 items-center gap-3 border-y border-dashed border-border px-2 py-6 text-sm text-muted-foreground">
          <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{filtered ? 'Try a different search or status.' : 'Nothing in this register needs attention.'}</p>
        </div>
      )}

      <nav aria-label={`${register.title} pages`} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.pageCount}</p>
        <div className="flex items-center gap-2">
          {pagination.hasPrevious ? <Link href={pageHref(pagination.page - 1)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">Previous</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Previous</span>}
          {pagination.hasNext ? <Link href={pageHref(pagination.page + 1)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">Next</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Next</span>}
        </div>
      </nav>
    </section>
  )
}
