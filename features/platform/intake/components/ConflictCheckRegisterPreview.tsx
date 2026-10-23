import { Pager, RowList, StatusDot, statusLabel, statusTone } from '@/features/platform/components/ui'
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
    <section className="min-w-0 space-y-3" aria-labelledby="conflict-status-preview-heading">
      <h2 id="conflict-status-preview-heading" className="flex min-w-0 items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
        <span className="truncate">Conflict queue</span>
        <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{total.toLocaleString()}</span>
      </h2>

      {rows.length ? (
        <RowList label="Pending conflict checks, oldest first">
          {rows.map((row, index) => (
            <li key={`${pagination?.page ?? 1}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <StatusDot tone={statusTone(row.status)} />
                <span className="truncate">{statusLabel(row.status)}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {row.createdAt ? <time dateTime={row.createdAt}>{formatUtcTimestamp(row.createdAt)}</time> : 'Time unavailable'}
              </span>
            </li>
          ))}
        </RowList>
      ) : (
        <p role="status" className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No pending conflict checks</p>
      )}

      {pagination ? (
        <Pager
          label="Conflict check status pages"
          previous={paginationHrefs.previous}
          next={paginationHrefs.next}
          summary={
            <>
              {pagination.loadedCount
                ? `${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}`
                : 'None on this page'} of {total.toLocaleString()} · Page {pagination.page} of {pagination.pageCount}
            </>
          }
        />
      ) : null}
    </section>
  )
}

function formatUtcTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Time unavailable' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}
