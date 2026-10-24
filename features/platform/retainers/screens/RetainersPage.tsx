import Link from 'next/link'

import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { EmptyState, ErrorBanner, RowList, TitleLine, Track, fieldClass, pillClass, pillPrimaryClass, statusLabel, trackItemClass } from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { formatMoneyLabel } from '@/features/platform/lib/money'
import { cn } from '@/lib/utils'

import { getRetainerFormSetup, getRetainerList } from '../actions/retainers'
import { RETAINER_STATUSES, feeStructureLabel } from '../lib/retainerOptions'
import { RetainerCreateForm } from '../components/RetainerCreateForm'

type Params = Record<string, string | string[] | undefined>

const BASE = '/dashboard/platform/retainers'

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function href({ status, q, extra }: { status?: string | null; q?: string; extra?: Record<string, string> }) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value)
  const text = params.toString()
  return text ? `${BASE}?${text}` : BASE
}

export async function RetainersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const rawStatus = one(params.status)
  const status = (RETAINER_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : null
  const q = one(params.q).slice(0, 100)
  const creating = one(params.new) === '1'
  const preselectedMatterId = one(params.matterId)
  const [list, setup] = await Promise.all([
    getRetainerList({ status, q }),
    creating ? getRetainerFormSetup() : Promise.resolve(null),
  ])

  return (
    <PracticePage
      title="Retainers"
      description="Fee agreements, retainer terms and their lifecycle"
      actions={
        <Track>
          <Link href="/dashboard/platform/billing" className={pillClass}>Billing</Link>
          {creating ? null : <Link href={href({ status, q, extra: { new: '1' } })} className={pillPrimaryClass}>New retainer agreement</Link>}
        </Track>
      }
    >
      <div className="grid min-w-0 gap-6 pb-24">
        {creating ? (
          setup && setup.success
            ? <RetainerCreateForm setup={setup.data} preselectedMatterId={preselectedMatterId} cancelHref={href({ status, q })} />
            : <ErrorBanner title="New agreement unavailable">{setup && !setup.success ? setup.error : 'Reload the page.'}</ErrorBanner>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Track label="Agreement status" className="max-w-full">
            <Link href={href({ q })} className={trackItemClass(!status)} aria-current={!status ? 'page' : undefined}>
              All{list.success ? <span className="font-mono text-xs tabular-nums opacity-70">{list.data.total}</span> : null}
            </Link>
            {RETAINER_STATUSES.map((value) => (
              <Link key={value} href={href({ status: value, q })} className={trackItemClass(status === value)} aria-current={status === value ? 'page' : undefined}>
                {statusLabel(value)}
                {list.success ? <span className="font-mono text-xs tabular-nums opacity-70">{list.data.counts[value] ?? 0}</span> : null}
              </Link>
            ))}
          </Track>
          <form action={BASE} method="get" role="search" className="flex min-w-0 items-center gap-2 lg:w-80">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <input name="q" defaultValue={q} maxLength={100} placeholder="Agreement number or client" aria-label="Search agreements" className={cn(fieldClass, 'rounded-full')} />
            <Track><button type="submit" className={trackItemClass(true)}>Search</button></Track>
          </form>
        </div>

        {!list.success ? <ErrorBanner title="Retainers unavailable">{list.error}</ErrorBanner> : list.data.rows.length === 0 ? (
          <EmptyState title={q || status ? 'No agreements match' : 'No retainer agreements yet'}>
            {q || status ? <Link href={BASE} className="text-sm text-muted-foreground underline underline-offset-4">Clear filters</Link> : null}
          </EmptyState>
        ) : (
          <RowList label="Retainer agreements">
            {list.data.rows.map((row) => (
              <li key={row.id}>
                <Link href={`${BASE}/${row.id}`} className="flex min-w-0 flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <TitleLine as="h3" status={row.status} headingClassName="text-sm">{row.agreementNumber}</TitleLine>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.client?.displayName ?? 'Client'} · {row.matter ? `${row.matter.matterNumber}${row.matter.title ? ` · ${row.matter.title}` : ''}` : 'Matter'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 text-xs text-muted-foreground sm:justify-end">
                    <span>{feeStructureLabel(row.feeStructure)}</span>
                    <span className="font-mono tabular-nums">{row.initialRetainerMinor ? formatMoneyLabel(row.initialRetainerMinor, row.currencyCode) : 'No deposit'}</span>
                    <span>{formatInstant(row.effectiveAt ?? row.createdAt, list.data.timeZone, { includeTime: false })}</span>
                  </div>
                </Link>
              </li>
            ))}
          </RowList>
        )}
        {list.success && list.data.rows.length === 100 ? <p className="text-xs text-muted-foreground">Showing the 100 most recent. Narrow with search or status.</p> : null}
      </div>
    </PracticePage>
  )
}
