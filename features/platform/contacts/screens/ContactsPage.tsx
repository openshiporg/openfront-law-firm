import Link from 'next/link'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { EmptyState, ErrorBanner, Pager, RowList, StatusDot, Track, fieldClass, pillClass, trackItemClass } from '@/features/platform/components/ui'

import { NewContactSheet } from '../components/ContactForms'
import { getContactList } from '../lib/contactQueries'
import {
  CONTACT_PAGE_SIZE,
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  CONTACT_STATUS_TONES,
  isContactStatus,
  isContactType,
  type ContactListRow,
  type ContactStatus,
  type ContactType,
} from '../lib/contactTypes'

type ContactsSearchParams = Record<string, string | string[] | undefined>

const BASE = '/dashboard/platform/contacts'

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

function href(params: { q: string; status: ContactStatus | 'all'; type: ContactType | 'all'; page?: number }) {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.status !== 'all') search.set('status', params.status)
  if (params.type !== 'all') search.set('type', params.type)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  const query = search.toString()
  return query ? `${BASE}?${query}` : BASE
}

function ContactRow({ row }: { row: ContactListRow }) {
  const secondary = [row.contactType === 'organization' ? 'Organization' : row.organizationName, row.preferredName ? `“${row.preferredName}”` : null, row.primaryEmail, row.primaryPhone].filter(Boolean).join(' · ')
  return (
    <li>
      <Link href={`${BASE}/${row.id}`} className="group block min-w-0 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:bg-muted/40">
        <span className="flex min-w-0 items-center gap-2">
          <StatusDot tone={CONTACT_STATUS_TONES[row.status]} />
          <span className="min-w-0 truncate text-sm font-semibold text-foreground group-hover:underline group-hover:underline-offset-4">{row.displayName}</span>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{CONTACT_STATUS_LABELS[row.status]}</span>
        </span>
        <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{secondary || (row.contactType === 'organization' ? 'Organization' : 'Person')}</span>
      </Link>
    </li>
  )
}

export async function ContactsPage({ searchParams }: { searchParams: Promise<ContactsSearchParams> }) {
  const params = await searchParams
  const q = first(params.q).trim().slice(0, 100)
  const rawStatus = first(params.status)
  const status: ContactStatus | 'all' = isContactStatus(rawStatus) ? rawStatus : 'all'
  const rawType = first(params.type)
  const type: ContactType | 'all' = isContactType(rawType) ? rawType : 'all'
  const pageNumber = Number(first(params.page))
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1

  const result = await getContactList({ query: q, status, type, page })

  return (
    <PracticePage
      title="Contacts"
      description="People and organizations"
      meta={result.status === 'loaded' ? <span className="tabular-nums">{result.counts.all.toLocaleString()} {result.counts.all === 1 ? 'contact' : 'contacts'}{q || type !== 'all' ? ' matching' : ''}</span> : undefined}
      actions={<NewContactSheet />}
    >
      {result.status !== 'loaded' ? <ErrorBanner title="Contacts unavailable">{result.message}</ErrorBanner> : (
        <div className="grid min-w-0 gap-4">
          <form method="get" action={BASE} role="search" className="flex min-w-0 flex-wrap items-center gap-2">
            {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
            {type !== 'all' ? <input type="hidden" name="type" value={type} /> : null}
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">Search contacts</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input type="search" name="q" defaultValue={q} maxLength={100} placeholder="Name, organization or email" className={cn(fieldClass, 'pl-9')} />
            </label>
            <Track>
              <button type="submit" className={pillClass}>Search</button>
              {q ? <Link href={href({ q: '', status, type })} className={trackItemClass(false)}>Clear</Link> : null}
            </Track>
          </form>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <nav aria-label="Status" className="min-w-0 max-w-full">
              <Track>
                <Link href={href({ q, status: 'all', type })} aria-current={status === 'all' ? 'page' : undefined} className={trackItemClass(status === 'all')}>
                  All<span className="font-mono text-xs tabular-nums opacity-70">{result.counts.all.toLocaleString()}</span>
                </Link>
                {CONTACT_STATUSES.map((value) => (
                  <Link key={value} href={href({ q, status: value, type })} aria-current={status === value ? 'page' : undefined} className={trackItemClass(status === value)}>
                    <StatusDot tone={CONTACT_STATUS_TONES[value]} />{CONTACT_STATUS_LABELS[value]}<span className="font-mono text-xs tabular-nums opacity-70">{result.counts[value].toLocaleString()}</span>
                  </Link>
                ))}
              </Track>
            </nav>
            <nav aria-label="Type">
              <Track>
                {([['all', 'All types'], ['person', 'People'], ['organization', 'Organizations']] as const).map(([value, label]) => (
                  <Link key={value} href={href({ q, status, type: value })} aria-current={type === value ? 'page' : undefined} className={trackItemClass(type === value)}>{label}</Link>
                ))}
              </Track>
            </nav>
          </div>

          {result.rows.length ? (
            <RowList label="Contacts">
              {result.rows.map((row) => <ContactRow key={row.id} row={row} />)}
            </RowList>
          ) : (
            <EmptyState title={q || status !== 'all' || type !== 'all' ? 'No matching contacts' : 'No contacts yet'} />
          )}

          <Pager
            label="Contact pages"
            previous={result.page > 1 ? href({ q, status, type, page: result.page - 1 }) : null}
            next={result.page < result.pageCount ? href({ q, status, type, page: result.page + 1 }) : null}
            summary={result.total ? `${((result.page - 1) * CONTACT_PAGE_SIZE + 1).toLocaleString()}–${Math.min(result.page * CONTACT_PAGE_SIZE, result.total).toLocaleString()} of ${result.total.toLocaleString()}` : undefined}
          />
        </div>
      )}
    </PracticePage>
  )
}
