'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { WORK_QUEUE_PAGE_SIZE, workQueuePageInfo, type WorkQueuePageInfo } from '@/features/platform/operations/lib/workQueuePagination'

type Result<T> = { success: true; data: T } | { success: false; error: string }
// Identity fields read at the same audit-view level as the event row; actor and matter
// resolve to null when the viewer cannot read them. Metadata, IPs and agents stay out.
type AuditEventRow = { id: string; eventId: string | null; eventType: string; category: string; outcome: string; occurredAt: string | null; actorType: string | null; actorUser: { name: string | null } | null; matter: { id: string; matterNumber: string | null } | null }
type AuditRegister = { auditEvents: AuditEventRow[]; total: number; pagination: WorkQueuePageInfo }
type ReportDeadlineRow = { id: string; title: string | null; status: string | null; dueAt: string | null; timezone: string | null; isVerified: boolean | null; matter: { id: string; matterNumber: string | null } | null; assignedTo: { name: string | null } | null }
type ReportDeadlineRegister = { deadlines: ReportDeadlineRow[]; total: number; openTotal: number; missedTotal: number; pagination: WorkQueuePageInfo }
type DeadlineCounts = { open: number | null; missed: number | null }

async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<Result<T>> {
  const response = await keystoneClient<T>(document, variables)
  return response.success ? response : { success: false, error: response.error }
}

const reportDeadlineCountQuery = `
  query ReportsDeadlineCount {
    open: deadlinesCount(where: { status: { in: [draft, pending] } })
    missed: deadlinesCount(where: { status: { equals: missed } })
  }
`

const reportDeadlinePageQuery = `
  query ReportsDeadlinePage($skip: Int!) {
    deadlines(
      where: { status: { in: [draft, pending, missed] } }
      orderBy: [{ dueAt: asc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status dueAt timezone isVerified matter { id matterNumber } assignedTo { name }
    }
  }
`

const auditEventCountQuery = `
  query ReportsAuditEventCount {
    total: auditEventsCount
  }
`

const auditEventPageQuery = `
  query ReportsAuditEventPage($skip: Int!) {
    auditEvents(
      orderBy: [{ occurredAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id eventId eventType category outcome occurredAt actorType actorUser { name } matter { id matterNumber }
    }
  }
`

async function loadAuditRegister(countResult: Result<{ total: number | null }>, requestedPage: number): Promise<Result<AuditRegister>> {
  if (!countResult.success || typeof countResult.data.total !== 'number' || !Number.isSafeInteger(countResult.data.total) || countResult.data.total < 0) {
    return { success: false, error: 'Activity log could not be loaded.' }
  }
  const total = countResult.data.total
  const requested = workQueuePageInfo(total, requestedPage, 0)
  const page = await query<{ auditEvents: AuditEventRow[] | null }>(auditEventPageQuery, {
    skip: (requested.page - 1) * requested.pageSize,
  })
  if (!page.success || !Array.isArray(page.data.auditEvents)) {
    return { success: false, error: 'Activity log could not be loaded.' }
  }
  return {
    success: true,
    data: {
      auditEvents: page.data.auditEvents,
      total,
      pagination: workQueuePageInfo(total, requested.page, page.data.auditEvents.length),
    },
  }
}

// "Open" matches Today's overview (draft + pending); missed deadlines are listed too.
async function loadReportDeadlineRegister(countResult: Result<DeadlineCounts>, requestedPage: number): Promise<Result<ReportDeadlineRegister>> {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  if (!countResult.success || !valid(countResult.data.open) || !valid(countResult.data.missed)) {
    return { success: false, error: 'Deadlines could not be loaded.' }
  }
  const openTotal = countResult.data.open
  const missedTotal = countResult.data.missed
  const total = openTotal + missedTotal
  const requested = workQueuePageInfo(total, requestedPage, 0)
  const page = await query<{ deadlines: ReportDeadlineRow[] | null }>(reportDeadlinePageQuery, {
    skip: (requested.page - 1) * requested.pageSize,
  })
  if (!page.success || !Array.isArray(page.data.deadlines)) {
    return { success: false, error: 'Deadlines could not be loaded.' }
  }
  return {
    success: true,
    data: {
      deadlines: page.data.deadlines,
      total,
      openTotal,
      missedTotal,
      pagination: workQueuePageInfo(total, requested.page, page.data.deadlines.length),
    },
  }
}

export async function getPracticeReports(auditPage = 1, reportDeadlinePage = 1) {
  const [ar, time, expenses, deadlineCount, trust, auditCount] = await Promise.all([
    query<{ invoices: Array<{ id: string; invoiceNumber: string; status: string; balanceDueMinor: number; currencyCode: string; dueAt?: string | null; matter?: { matterNumber?: string | null } | null; client?: { displayName?: string | null } | null }> }>(`
      query { invoices(where: { status: { in: [issued, partially_paid, overdue] } }, orderBy: [{ dueAt: asc }, { id: asc }], take: 100) { id invoiceNumber status balanceDueMinor currencyCode dueAt matter { matterNumber } client { displayName } } }
    `),
    query<{ timeEntries: Array<{ id: string; status: string; amountMinor?: number | null; currencyCode: string; matter: { matterNumber: string } }> }>(`
      query { timeEntries(where: { status: { in: [submitted, approved] } }, orderBy: [{ workDate: asc }, { id: asc }], take: 100) { id status amountMinor currencyCode matter { matterNumber } } }
    `),
    query<{ expenses: Array<{ id: string; status: string; amountMinor: number; currencyCode: string; matter: { matterNumber: string } }> }>(`
      query { expenses(where: { status: { in: [submitted, approved] } }, orderBy: [{ incurredAt: asc }, { id: asc }], take: 100) { id status amountMinor currencyCode matter { matterNumber } } }
    `),
    query<DeadlineCounts>(reportDeadlineCountQuery),
    query<{ trustBalanceSnapshots: Array<{ id: string; snapshotType: string; balanceMinor: number; currencyCode: string; asOf: string; ledgerAccount?: { id: string; ledgerNumber: string; client: { displayName: string } } | null }> }>(`
      query { trustBalanceSnapshots(where: { snapshotType: { equals: client_balance } }, orderBy: [{ asOf: desc }, { id: asc }], take: 100) { id snapshotType balanceMinor currencyCode asOf ledgerAccount { id ledgerNumber client { displayName } } } }
    `),
    query<{ total: number | null }>(auditEventCountQuery),
  ])
  const [audit, deadlines] = await Promise.all([
    loadAuditRegister(auditCount, auditPage),
    loadReportDeadlineRegister(deadlineCount, reportDeadlinePage),
  ])
  return { ar, time, expenses, deadlines, trust, audit }
}
