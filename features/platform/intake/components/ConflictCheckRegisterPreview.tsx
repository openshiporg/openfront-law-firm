import Link from 'next/link'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import type { PracticeWorkspaceSection } from '@/features/platform/operations/types'

export type ConflictCheckRegisterRow = {
  status: string
  createdAt: string | null
}

export function ConflictCheckRegisterPreview({
  rows,
  total,
  pagination,
  paginationHrefs,
}: {
  rows: ConflictCheckRegisterRow[]
  total: number
  pagination: PracticeWorkspaceSection['pagination']
  paginationHrefs: { previous: string | null; next: string | null }
}) {
  return (
    <section className="min-w-0 border-t border-border pt-4" aria-labelledby="conflict-status-preview-heading">
      <div className="min-w-0">
        <h2 id="conflict-status-preview-heading" className="text-base font-bold tracking-[-0.015em] text-foreground">
          Conflict review status · {total.toLocaleString()}
        </h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Conflict checks awaiting review, oldest first. Record each review in the conflict review panel above.
        </p>
      </div>

      {rows.length ? (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {rows.map((row, index) => (
            <li key={`${pagination?.page ?? 1}-${index}`} className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-3 py-3 sm:px-2">
              <PracticeStatus status={row.status} />
              <p className="text-xs tabular-nums text-muted-foreground">
                Created · {row.createdAt ? <time dateTime={row.createdAt}>{formatUtcTimestamp(row.createdAt)}</time> : 'time unavailable'}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-y border-dashed border-border px-2 py-6 text-sm text-muted-foreground">
          No pending conflict checks are visible in this bounded preview.
        </p>
      )}

      {pagination ? (
        <nav aria-label="Conflict check status pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="space-y-1 text-xs leading-5 text-muted-foreground">
            <p>
              {pagination.loadedCount
                ? `Showing ${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}`
                : 'No records returned on this page'} of {total.toLocaleString()} authorized conflict checks.
            </p>
            <p>Page {pagination.page} of {pagination.pageCount} · {pagination.pageSize} checks per page.</p>
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

function formatUtcTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'time unavailable' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}
