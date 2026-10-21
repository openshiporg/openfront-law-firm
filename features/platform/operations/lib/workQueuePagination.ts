export const WORK_QUEUE_PAGE_SIZE = 12

export type WorkQueuePageInfo = {
  page: number
  pageSize: number
  pageCount: number
  loadedCount: number
  firstItem: number
  lastItem: number
  hasPrevious: boolean
  hasNext: boolean
}

// Each request is bounded to one page; there is no ceiling on the number of pages, so
// every authorized record stays reachable. Untrusted page input is validated and
// clamped to the last available page.
export function workQueuePageInfo(
  total: number,
  requestedPage: number,
  loadedCount: number,
  pageSize = WORK_QUEUE_PAGE_SIZE,
): WorkQueuePageInfo {
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : WORK_QUEUE_PAGE_SIZE
  const authorizedTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0
  const pageCount = Math.max(1, Math.ceil(authorizedTotal / size))
  const candidate = Number.isSafeInteger(requestedPage) ? requestedPage : 1
  const page = Math.min(Math.max(candidate, 1), pageCount)
  const offset = (page - 1) * size
  const visibleCount = Math.min(Math.max(0, Math.trunc(loadedCount)), size)

  return {
    page,
    pageSize: size,
    pageCount,
    loadedCount: visibleCount,
    firstItem: visibleCount ? offset + 1 : 0,
    lastItem: visibleCount ? offset + visibleCount : 0,
    hasPrevious: page > 1,
    hasNext: page < pageCount,
  }
}
