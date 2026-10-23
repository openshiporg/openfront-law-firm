import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'

import type { WorkspaceRegister } from '../operations/actions/getWorkspaceRegister'
import { registerHref } from '../operations/lib/workspaceRegister'
import type { PracticeOverviewQueueItem } from '../operations/types'
import { QueueRow } from './PracticeSurface'
import { EmptyState, Pager, Track, fieldClass, labelClass, pillPrimaryClass, trackClass, trackItemClass } from './ui'

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
    <section aria-labelledby="register-heading" className="space-y-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 id="register-heading" className="flex min-w-0 items-baseline gap-2 text-lg font-semibold tracking-tight text-foreground">
          <span className="truncate">{params.scope === "history" ? "History and current records" : register.title}</span>
          <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{register.total.toLocaleString()}</span>
        </h2>
        <Track><Link href={backHref} className={trackItemClass(true)}><ArrowLeft className="size-4" aria-hidden="true" />{backLabel}</Link></Track>
      </div>

      <form method="get" action={action} role="search" aria-label={`Filter ${register.title.toLowerCase()}`} className="grid min-w-0 gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <input type="hidden" name="view" value={register.key} />
        {register.searchable ? (
          <label className={labelClass} htmlFor="register-q">
            Search
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="register-q" name="q" type="search" defaultValue={params.q} maxLength={100} className={`${fieldClass} rounded-full pl-9`} />
            </span>
          </label>
        ) : <p className="text-xs text-muted-foreground lg:self-center">No text search for this register</p>}
        {register.historyAvailable ? <label className={labelClass} htmlFor="register-scope">Inventory<FormSelect id="register-scope" name="scope" defaultValue={params.scope ?? "queue"} className={fieldClass}><option value="queue">Operational queue</option><option value="history">Include completed history</option></FormSelect></label> : null}
        {register.statusOptions.length ? (
          <label className={labelClass} htmlFor="register-status">
            Status
            <FormSelect id="register-status" name="status" defaultValue={params.status} aria-label="Status" className={fieldClass}>
              <option value="">All statuses</option>
              {register.statusOptions.map((status) => <option key={status} value={status}>{words(status)}</option>)}
            </FormSelect>
          </label>
        ) : null}
        <label className={labelClass} htmlFor="register-sort">
          Sort
          <FormSelect id="register-sort" name="sort" defaultValue={params.sort || 'default'} required aria-label="Sort" className={fieldClass}>
            {register.sortOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </FormSelect>
        </label>
        <div className={`${trackClass} justify-self-start`}>
          <button type="submit" className={pillPrimaryClass}>Apply</button>
          {filtered ? <Link href={registerHref(register.category, { view: register.key })} className={trackItemClass(false)}>Clear</Link> : null}
        </div>
      </form>

      <p role="status" className="text-xs tabular-nums text-muted-foreground">
        {pagination.loadedCount
          ? `${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()} of ${register.total.toLocaleString()}`
          : register.total ? 'No records on this page' : filtered ? 'No records match these filters' : 'No records'}
        {params.q ? ` matching “${params.q}”` : ''}
      </p>

      {register.items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {register.items.map((item) => {
            const destination = rowHref ? rowHref(item) : item.href
            // Preview anchors are not object destinations: late-page rows must
            // not navigate to an unrelated first-twelve preview without this ID.
            const href = destination?.startsWith(`/dashboard/platform/${register.category}#`) ? null : destination
            return <QueueRow key={`${item.kind}-${item.id}`} item={item} href={href} actionPath={`/dashboard/platform/${register.category}`} timeZone={timeZone} anchor={register.key} />
          })}
        </ul>
      ) : (
        <EmptyState title={filtered ? 'No matches' : 'Nothing needs attention'} />
      )}

      <Pager
        label={`${register.title} pages`}
        previous={pagination.hasPrevious ? pageHref(pagination.page - 1) : null}
        next={pagination.hasNext ? pageHref(pagination.page + 1) : null}
        summary={`Page ${pagination.page} of ${pagination.pageCount}`}
      />
    </section>
  )
}
