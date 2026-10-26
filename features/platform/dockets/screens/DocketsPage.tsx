import Link from 'next/link'
import { Search } from 'lucide-react'

import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { EmptyState, ErrorBanner, StatusDot, Track, fieldClass, pillClass, statusLabel, statusTone, trackItemClass } from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

import { getCourts, getDocketRegister } from '../actions/getDockets'
import { CourtsPanel, CreateDocketPanel } from '../components/DocketForms'
import { DOCKET_STATUSES } from '../lib/docketTypes'

type SearchParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

export async function DocketsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {}
  const status = (DOCKET_STATUSES as readonly string[]).includes(first(params.status)) ? first(params.status) : 'active'
  const q = first(params.q).slice(0, 120)
  const [courts, register, timeZone] = await Promise.all([getCourts(), getDocketRegister({ status, q }), getFirmTimeZone()])
  const href = (next: string) => `/dashboard/platform/dockets?${new URLSearchParams({ status: next, ...(q ? { q } : {}) }).toString()}`
  return (
    <PracticePage title="Courts & dockets" description="Courts, dockets and docket entries">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          {courts.success ? <CreateDocketPanel courts={courts.data} timeZone={timeZone} /> : null}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <Track label="Docket status">
              {DOCKET_STATUSES.map((value) => <Link key={value} href={href(value)} aria-current={value === status ? 'page' : undefined} className={trackItemClass(value === status)}>
                {statusLabel(value)}{register.success ? <span className="font-mono text-xs tabular-nums opacity-70">{(register.data.counts[value] ?? 0).toLocaleString()}</span> : null}
              </Link>)}
            </Track>
            <form action="/dashboard/platform/dockets" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs">
              <input type="hidden" name="status" value={status} />
              <label htmlFor="docket-search" className="sr-only">Search dockets</label>
              <input id="docket-search" name="q" type="search" defaultValue={q} placeholder="Number, title or court" maxLength={120} className={fieldClass} />
              <Track><button type="submit" className={pillClass} aria-label="Search"><Search className="size-4" aria-hidden="true" /></button></Track>
            </form>
          </div>
          {!register.success ? <ErrorBanner>{register.error}</ErrorBanner> : register.data.dockets.length ? (
            <ul aria-label={`${statusLabel(status)} dockets`} className="divide-y divide-border overflow-hidden rounded-[6px] border border-border bg-card">
              {register.data.dockets.map((docket) => <li key={docket.id}>
                <Link href={`/dashboard/platform/dockets/${encodeURIComponent(docket.id)}`} className="group grid min-w-0 gap-0.5 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusDot tone={statusTone(docket.status)} />
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground group-hover:underline group-hover:underline-offset-4">{docket.docketNumber}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(docket.status)}</span>
                    <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">{docket.entriesCount ?? 0} entries</span>
                  </span>
                  <span className="truncate pl-4 text-xs text-muted-foreground">{[docket.title, docket.court?.name, docket.matter?.matterNumber, docket.filedAt ? `Filed ${formatInstant(docket.filedAt, timeZone, { includeTime: false })}` : null].filter(Boolean).join(' · ')}</span>
                </Link>
              </li>)}
            </ul>
          ) : <EmptyState title={q ? 'No dockets match' : `No ${statusLabel(status).toLowerCase()} dockets`} />}
        </div>
        {courts.success ? <CourtsPanel courts={courts.data} /> : <ErrorBanner>{courts.error}</ErrorBanner>}
      </div>
    </PracticePage>
  )
}
