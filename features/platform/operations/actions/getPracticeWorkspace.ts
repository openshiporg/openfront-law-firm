'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { communicationDispatchState } from '@/features/shared/dispatch-outcome'

import type { PracticeOverviewQueueItem, PracticeWorkspace, PracticeWorkspaceResponse, PracticeWorkspaceSection } from '../types'
import { WORK_QUEUE_PAGE_SIZE, workQueuePageInfo } from '../lib/workQueuePagination'

const query = `
  query PracticeWorkspace($category: String!) {
    practiceWorkspace(category: $category) {
      category
      generatedAt
      metrics { key label value href }
      sections {
        key
        title
        description
        total
        items { id kind title subtitle status at href canAct }
      }
      notices
    }
  }
`

const intakePageQuery = `
  query IntakePipelinePage($skip: Int!) {
    intakes(
      where: { status: { in: [new, screening, conflict_review, consultation, decision] } }
      orderBy: [{ receivedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id intakeNumber title status receivedAt primaryContact { displayName }
    }
  }
`

const conflictCheckPageQuery = `
  query IntakeConflictCheckPage($skip: Int!) {
    conflictChecks(
      where: { status: { in: [requested, running, review_required] } }
      orderBy: [{ createdAt: asc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      status createdAt intake { intakeNumber title primaryContact { displayName } } matter { matterNumber title }
    }
  }
`

const matterPartyPageQuery = `
  query ContactMatterRelationshipPage($skip: Int!) {
    matterParties(
      where: { status: { equals: active } }
      orderBy: [{ updatedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id partyRole side status updatedAt
    }
  }
`

const paymentPageQuery = `
  query BillingPaymentWorkQueuePage($skip: Int!) {
    payments(
      where: { status: { in: [pending, authorized, captured] } }
      orderBy: [{ createdAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id paymentNumber status createdAt
    }
  }
`

const invoiceMetadataFilter = 'status: { in: [draft, approved, issued, partially_paid, overdue] }'

const invoiceMetadataCountQuery = `
  query BillingInvoiceMetadataCount {
    invoicesCount(where: { ${invoiceMetadataFilter} })
  }
`

const invoiceMetadataPageQuery = `
  query BillingInvoiceMetadataPage($skip: Int!) {
    invoices(
      where: { ${invoiceMetadataFilter} }
      orderBy: [{ createdAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id invoiceNumber status createdAt dueAt totalMinor balanceDueMinor currencyCode client { displayName } matter { id matterNumber }
    }
  }
`

const deadlinePageQuery = `
  query DeadlineWorkQueuePage($skip: Int!) {
    deadlines(
      where: { status: { in: [draft, pending] } }
      orderBy: [{ dueAt: asc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status dueAt isVerified matter { matterNumber } assignedTo { name }
    }
  }
`

const taskPageQuery = `
  query TaskWorkQueuePage($skip: Int!) {
    legalTasks(
      where: { status: { in: [open, in_progress, blocked] } }
      orderBy: [{ dueAt: asc }, { updatedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status priority dueAt matter { matterNumber } assignedTo { name }
    }
  }
`

const documentPageQuery = `
  query DocumentWorkQueuePage($skip: Int!) {
    documents(
      where: { status: { in: [draft, active, archived] } }
      orderBy: [{ updatedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status category updatedAt
    }
  }
`

const signatureRequestPageQuery = `
  query SignatureRequestWorkQueuePage($skip: Int!) {
    signatureRequests(
      where: { status: { in: [draft, sent, partially_signed] } }
      orderBy: [{ updatedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status updatedAt
    }
  }
`

const deliveryPageQuery = `
  query CommunicationDeliveryWorkQueuePage($skip: Int!) {
    communicationDeliveries(
      where: { status: { in: [pending, failed, bounced] } }
      orderBy: [{ updatedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id status channel errorCode attemptCount lastAttemptAt message { subject }
    }
  }
`

type WorkQueuePages = { intake?: number; conflicts?: number; relationships?: number; payments?: number; invoices?: number; deadlines?: number; tasks?: number; documents?: number; signatures?: number; delivery?: number }
type ConflictCheckRecord = {
  status: string | null
  createdAt: string | null
  intake?: { intakeNumber: string; title: string | null; primaryContact?: { displayName: string | null } | null } | null
  matter?: { matterNumber: string; title: string | null } | null
}
type IntakeRecord = { id: string; intakeNumber: string; title?: string | null; status: string; receivedAt: string | null; primaryContact?: { displayName: string | null } | null }
type MatterPartyRecord = { id: string; partyRole: string; side: string; status: string; updatedAt: string | null }
type PaymentRecord = { id: string; paymentNumber: string; status: string; createdAt: string | null }
type InvoiceMetadataRecord = {
  id: string
  invoiceNumber: string | null
  status: string | null
  createdAt: string | null
  dueAt: string | null
  totalMinor: number | null
  balanceDueMinor: number | null
  currencyCode: string | null
  client: { displayName: string | null } | null
  matter: { id: string; matterNumber: string | null } | null
}
type DeadlineRecord = {
  id: string
  title: string
  status: string
  dueAt: string | null
  isVerified: boolean
  matter?: { matterNumber: string } | null
  assignedTo?: { name: string } | null
}
type TaskRecord = {
  id: string
  title: string
  status: string
  priority: string
  dueAt: string | null
  matter?: { matterNumber: string } | null
  assignedTo?: { name: string } | null
}
type DocumentRecord = {
  id: string
  title: string
  status: string
  category: string
  updatedAt: string | null
}
type SignatureRequestRecord = {
  id: string
  title: string | null
  status: string
  updatedAt: string | null
}
type DeliveryRecord = {
  id: string
  errorCode?: string | null
  message: { subject: string | null } | null
  status: string
  channel: string
  attemptCount: number | null
  lastAttemptAt: string | null
}

function toIso(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function mapIntake(record: IntakeRecord, canAct: boolean): PracticeOverviewQueueItem {
  return {
    id: record.id,
    kind: 'Intake',
    title: record.title || record.intakeNumber,
    subtitle: [record.primaryContact?.displayName ?? 'Client unavailable', record.intakeNumber].join(' · '),
    status: record.status,
    at: toIso(record.receivedAt),
    href: `/dashboard/platform/intake#pipeline-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function mapConflictCheck(record: ConflictCheckRecord, ordinal: number): PracticeOverviewQueueItem {
  return {
    id: `conflict-preview-${ordinal}`,
    kind: 'Conflict check',
    title: record.intake?.title ?? (record.matter ? `${record.matter.matterNumber} · ${record.matter.title ?? ''}` : 'Conflict check'),
    subtitle: record.intake
      ? [record.intake.primaryContact?.displayName ?? 'Client unavailable', record.intake.intakeNumber].join(' · ')
      : record.matter ? 'Matter conflict check' : 'Awaiting conflict review',
    status: record.status ?? 'unknown',
    at: toIso(record.createdAt),
    href: '/dashboard/platform/intake#conflicts',
    canAct: false,
  }
}

function mapMatterParty(record: MatterPartyRecord, canAct: boolean): PracticeOverviewQueueItem {
  const role = record.partyRole.replaceAll('_', ' ')
  const side = record.side.replaceAll('_', ' ')
  return {
    id: record.id,
    kind: 'Matter party',
    title: `${role} relationship`,
    subtitle: `${side} side`,
    status: record.status,
    at: toIso(record.updatedAt),
    href: `/dashboard/platform/contacts#relationships-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function mapPayment(record: PaymentRecord, canAct: boolean): PracticeOverviewQueueItem {
  return {
    id: record.id,
    kind: 'Payment',
    title: record.paymentNumber,
    subtitle: 'Payment awaiting capture, settlement or allocation',
    status: record.status,
    at: toIso(record.createdAt),
    href: `/dashboard/platform/billing#payments-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function mapDeadline(record: DeadlineRecord, canAct: boolean): PracticeOverviewQueueItem {
  return {
    id: record.id,
    kind: 'Deadline',
    title: record.title,
    subtitle: `${record.matter?.matterNumber ?? 'Firm-level'} · ${record.isVerified ? 'verified' : 'requires verification'} · ${record.assignedTo?.name ?? 'unassigned'}`,
    status: record.status,
    at: toIso(record.dueAt),
    href: `/dashboard/platform/work#deadlines-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function mapTask(record: TaskRecord, canAct: boolean): PracticeOverviewQueueItem {
  return {
    id: record.id,
    kind: 'Task',
    title: record.title,
    subtitle: `${record.matter?.matterNumber ?? 'Firm-level'} · ${record.priority} · ${record.assignedTo?.name ?? 'unassigned'}`,
    status: record.status,
    at: toIso(record.dueAt),
    href: `/dashboard/platform/work#tasks-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function mapDocument(record: DocumentRecord, canAct: boolean): PracticeOverviewQueueItem {
  return {
    id: record.id,
    kind: 'Document',
    title: record.title,
    subtitle: `${record.category} · document metadata`,
    status: record.status,
    at: toIso(record.updatedAt),
    href: `/dashboard/platform/documents#documents-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function mapSignatureRequest(record: SignatureRequestRecord, canAct: boolean): PracticeOverviewQueueItem {
  return {
    id: record.id,
    kind: 'Signature request',
    title: record.title || 'Signature request',
    subtitle: 'Signature request · open for document version and signers',
    status: record.status,
    at: toIso(record.updatedAt),
    href: `/dashboard/platform/documents#signatures-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function mapDelivery(record: DeliveryRecord, canAct: boolean): PracticeOverviewQueueItem {
  return {
    id: record.id,
    kind: 'Delivery',
    title: record.message?.subject ? `Delivery · ${record.message.subject}` : 'Message delivery',
    subtitle: `${record.channel} · ${record.attemptCount ?? 0} attempts · ${communicationDispatchState(record.status, record.errorCode).guidance}`,
    status: communicationDispatchState(record.status, record.errorCode).status,
    at: toIso(record.lastAttemptAt),
    href: `/dashboard/platform/communications#delivery-${encodeURIComponent(record.id)}`,
    canAct,
  }
}

function withPageInfo(section: PracticeWorkspaceSection, page: number, loadedCount: number): PracticeWorkspaceSection {
  return {
    ...section,
    pagination: workQueuePageInfo(section.total, page, loadedCount),
  }
}

async function pageIntakeSection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ intakes: IntakeRecord[] | null }>(intakePageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.intakes)) return { error: 'The authorized intake page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.intakes.map((record) => mapIntake(record, canAct)) }, page.page, response.data.intakes.length) }
}

async function pageConflictCheckSection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ conflictChecks: ConflictCheckRecord[] | null }>(conflictCheckPageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.conflictChecks)) return { error: 'The authorized conflict-check page could not be loaded.' }
  const items = response.data.conflictChecks.map((record, index) => mapConflictCheck(record, page.firstItem + index))
  return { section: withPageInfo({ ...section, items }, page.page, items.length) }
}

async function pageMatterPartySection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ matterParties: MatterPartyRecord[] | null }>(matterPartyPageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.matterParties)) return { error: 'The authorized matter-relationship page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.matterParties.map((record) => mapMatterParty(record, canAct)) }, page.page, response.data.matterParties.length) }
}

async function pagePaymentSection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ payments: PaymentRecord[] | null }>(paymentPageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.payments)) return { error: 'The authorized payment page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.payments.map((record) => mapPayment(record, canAct)) }, page.page, response.data.payments.length) }
}

// Billing queue rows are dated by due date; drafts and approved invoices have none yet,
// so they show their creation date instead of "No date", matching the Invoices list.
async function datedInvoiceSection(section: PracticeWorkspaceSection) {
  const items = section.items.map((item) => ({ ...item, subtitle: item.subtitle.replace(/ · 1 lines$/, ' · 1 line') }))
  const undated = items.filter((item) => !item.at).map((item) => item.id)
  if (!undated.length) return { section: { ...section, items } }
  const response = await keystoneClient<{ invoices: Array<{ id: string; createdAt: string | null }> | null }>(`
    query BillingQueueInvoiceCreated($ids: [ID!]!, $take: Int!) { invoices(where: { id: { in: $ids } }, take: $take) { id createdAt } }
  `, { ids: undated, take: undated.length })
  if (!response.success || !Array.isArray(response.data.invoices)) return { section: { ...section, items } }
  const created = new Map(response.data.invoices.map((invoice) => [invoice.id, toIso(invoice.createdAt)]))
  return { section: { ...section, items: items.map((item) => (item.at ? item : { ...item, at: created.get(item.id) ?? null })) } }
}

async function loadInvoiceMetadataRegister(requestedPage: number) {
  const countResponse = await keystoneClient<{ invoicesCount: number | null }>(invoiceMetadataCountQuery)
  if (!countResponse.success || typeof countResponse.data.invoicesCount !== 'number') {
    return { success: false as const, error: 'The authorized invoice metadata count could not be loaded.' }
  }

  const total = countResponse.data.invoicesCount
  const requested = workQueuePageInfo(total, requestedPage, 0)
  const pageResponse = await keystoneClient<{ invoices: InvoiceMetadataRecord[] | null }>(invoiceMetadataPageQuery, {
    skip: (requested.page - 1) * requested.pageSize,
  })
  if (!pageResponse.success || !Array.isArray(pageResponse.data.invoices)) {
    return { success: false as const, error: 'The authorized invoice metadata page could not be loaded.' }
  }

  // Invoice number and amounts carry no field restriction beyond invoice read; client and
  // matter resolve to null when the viewer cannot read them and are shown as restricted.
  const items = pageResponse.data.invoices.map((record) => ({
    id: record.id,
    invoiceNumber: record.invoiceNumber,
    status: record.status,
    createdAt: toIso(record.createdAt),
    dueAt: toIso(record.dueAt),
    totalMinor: record.totalMinor,
    balanceDueMinor: record.balanceDueMinor,
    currencyCode: record.currencyCode,
    clientName: record.client?.displayName ?? null,
    matterId: record.matter?.id ?? null,
    matterNumber: record.matter?.matterNumber ?? null,
  }))
  return {
    success: true as const,
    total,
    items,
    pagination: workQueuePageInfo(total, requested.page, items.length),
  }
}

async function pageDeadlineSection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ deadlines: DeadlineRecord[] | null }>(deadlinePageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.deadlines)) return { error: 'The authorized deadline page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.deadlines.map((record) => mapDeadline(record, canAct)) }, page.page, response.data.deadlines.length) }
}

async function pageTaskSection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ legalTasks: TaskRecord[] | null }>(taskPageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.legalTasks)) return { error: 'The authorized task page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.legalTasks.map((record) => mapTask(record, canAct)) }, page.page, response.data.legalTasks.length) }
}

async function pageDocumentSection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ documents: DocumentRecord[] | null }>(documentPageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.documents)) return { error: 'The authorized document page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.documents.map((record) => mapDocument(record, canAct)) }, page.page, response.data.documents.length) }
}

async function pageSignatureRequestSection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ signatureRequests: SignatureRequestRecord[] | null }>(signatureRequestPageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.signatureRequests)) return { error: 'The authorized signature page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.signatureRequests.map((record) => mapSignatureRequest(record, canAct)) }, page.page, response.data.signatureRequests.length) }
}

async function pageDeliverySection(section: PracticeWorkspaceSection, requestedPage: number) {
  const page = workQueuePageInfo(section.total, requestedPage, section.items.length)
  const canAct = section.items[0]?.canAct ?? false
  if (page.page === 1) return { section: withPageInfo(section, page.page, section.items.length) }

  const response = await keystoneClient<{ communicationDeliveries: DeliveryRecord[] | null }>(deliveryPageQuery, {
    skip: (page.page - 1) * page.pageSize,
  })
  if (!response.success) return { error: response.error }
  if (!Array.isArray(response.data.communicationDeliveries)) return { error: 'The authorized delivery page could not be loaded.' }
  return { section: withPageInfo({ ...section, items: response.data.communicationDeliveries.map((record) => mapDelivery(record, canAct)) }, page.page, response.data.communicationDeliveries.length) }
}

export async function getPracticeWorkspace(
  category: string,
  workPages: WorkQueuePages = {},
): Promise<PracticeWorkspaceResponse> {
  const response = await keystoneClient<{ practiceWorkspace: PracticeWorkspace }>(query, { category })
  if (!response.success) return { success: false, error: response.error }

  const workspace = response.data.practiceWorkspace
  if (category !== 'work' && category !== 'communications' && category !== 'documents' && category !== 'intake' && category !== 'billing' && category !== 'contacts') return { success: true, data: workspace }

  const hasInvoiceReadScope = category === 'billing' && workspace.sections.some((section) => section.key === 'invoices')
  const [sections, invoiceMetadataRegister] = await Promise.all([
    Promise.all(workspace.sections.map((section) => {
      if (category === 'intake' && section.key === 'pipeline') return pageIntakeSection(section, workPages.intake ?? 1)
      if (category === 'intake' && section.key === 'conflicts') return pageConflictCheckSection(section, workPages.conflicts ?? 1)
      if (category === 'contacts' && section.key === 'relationships') return pageMatterPartySection(section, workPages.relationships ?? 1)
      if (category === 'billing' && section.key === 'payments') return pagePaymentSection(section, workPages.payments ?? 1)
      if (category === 'billing' && section.key === 'invoices') return datedInvoiceSection(section)
      if (category === 'work' && section.key === 'deadlines') return pageDeadlineSection(section, workPages.deadlines ?? 1)
      if (category === 'work' && section.key === 'tasks') return pageTaskSection(section, workPages.tasks ?? 1)
      if (category === 'communications' && section.key === 'delivery') return pageDeliverySection(section, workPages.delivery ?? 1)
      if (category === 'documents' && section.key === 'documents') return pageDocumentSection(section, workPages.documents ?? 1)
      if (category === 'documents' && section.key === 'signatures') return pageSignatureRequestSection(section, workPages.signatures ?? 1)
      return Promise.resolve({ section })
    })),
    hasInvoiceReadScope
      ? loadInvoiceMetadataRegister(workPages.invoices ?? 1)
      : Promise.resolve(undefined),
  ])
  const failure = sections.find((result) => 'error' in result)
  if (failure && 'error' in failure) return { success: false, error: failure.error || 'Workspace could not be loaded.' }

  return {
    success: true,
    data: {
      ...workspace,
      sections: sections.map((result) => ('section' in result ? result.section : undefined)).filter((section): section is PracticeWorkspaceSection => Boolean(section)),
      ...(invoiceMetadataRegister ? { invoiceMetadataRegister } : {}),
    },
  }
}
