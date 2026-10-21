'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { formatInstant, validTimeZone } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { formatMoneyLabel } from '@/features/platform/lib/money'
import { WORK_QUEUE_PAGE_SIZE, workQueuePageInfo, type WorkQueuePageInfo } from '@/features/platform/operations/lib/workQueuePagination'

export type MatterWorkspaceData = {
  matter: {
    id: string
    matterNumber: string
    title: string
    status: string
    confidentiality: string
    openedAt?: string | null
    client?: { displayName?: string | null } | null
    responsibleAttorney?: { name?: string | null } | null
    office?: { name?: string | null; timezone?: string | null } | null
    practiceArea?: { name?: string | null } | null
  }
  sections: Array<{ key: string; title: string; total?: number; pagination?: WorkQueuePageInfo; rows: Array<{ id: string; title: string; meta: string; status: string; href?: string }> }>
  notices: string[]
}

type Result<T> = { success: true; data: T } | { success: false; error: string }
type WorkspaceRow = MatterWorkspaceData['sections'][number]['rows'][number]
// Each projection adds only identity fields whose read access equals the row's own list
// access; people identities resolve to null (shown as restricted) without people-read.
type TeamRow = { id: string; status: string; assignedAt: string | null; teamRole: string | null; user: { name: string | null } | null }
type PartyRow = { id: string; partyRole: string | null; side: string | null; status: string | null; updatedAt: string | null; contact: { displayName: string | null } | null }
type TaskRow = { id: string; title: string | null; status: string | null; priority: string | null; dueAt: string | null }
type DeadlineRow = { id: string; title: string | null; status: string | null; dueAt: string | null; timezone: string | null; isVerified: boolean | null }
type DocumentRow = { id: string; title: string | null; status: string | null; category: string | null; updatedAt: string | null }
type CommunicationRow = { id: string; subject: string | null; status: string | null; primaryChannel: string | null; lastMessageAt: string | null }
type InvoiceRow = { id: string; invoiceNumber: string | null; status: string | null; createdAt: string | null; totalMinor: number | null; balanceDueMinor: number | null; currencyCode: string | null }

const matterTeamMemberCountQuery = `
  query MatterTeamRegisterCount($id: ID!) {
    matterTeamMembersCount(where: { matter: { id: { equals: $id } }, status: { equals: active } })
  }
`

const matterTeamMemberPageQuery = `
  query MatterTeamRegisterPage($id: ID!, $skip: Int!) {
    matterTeamMembers(
      where: { matter: { id: { equals: $id } }, status: { equals: active } }
      orderBy: [{ assignedAt: asc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id status assignedAt teamRole user { name }
    }
  }
`

const matterPartyCountQuery = `
  query MatterPartyRegisterCount($id: ID!) {
    total: matterPartiesCount(where: { matter: { id: { equals: $id } }, status: { equals: active } })
  }
`

const matterPartyPageQuery = `
  query MatterPartyRegisterPage($id: ID!, $skip: Int!) {
    matterParties(
      where: { matter: { id: { equals: $id } }, status: { equals: active } }
      orderBy: [{ updatedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id partyRole side status updatedAt contact { displayName }
    }
  }
`

const matterCommunicationCountQuery = `
  query MatterCommunicationRegisterCount($id: ID!) {
    total: communicationThreadsCount(where: { matter: { id: { equals: $id } } })
  }
`

const matterCommunicationPageQuery = `
  query MatterCommunicationRegisterPage($id: ID!, $skip: Int!) {
    communicationThreads(
      where: { matter: { id: { equals: $id } } }
      orderBy: [{ lastMessageAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id subject status primaryChannel lastMessageAt
    }
  }
`

const matterInvoiceCountQuery = `
  query MatterInvoiceRegisterCount($id: ID!) {
    total: invoicesCount(where: { matter: { id: { equals: $id } } })
  }
`

const matterInvoicePageQuery = `
  query MatterInvoiceRegisterPage($id: ID!, $skip: Int!) {
    invoices(
      where: { matter: { id: { equals: $id } } }
      orderBy: [{ createdAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id invoiceNumber status createdAt totalMinor balanceDueMinor currencyCode
    }
  }
`

const matterDocumentCountQuery = `
  query MatterDocumentRegisterCount($id: ID!) {
    total: documentsCount(where: { matter: { id: { equals: $id } } })
  }
`

const matterDocumentPageQuery = `
  query MatterDocumentRegisterPage($id: ID!, $skip: Int!) {
    documents(
      where: { matter: { id: { equals: $id } } }
      orderBy: [{ updatedAt: desc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status category updatedAt
    }
  }
`

const matterTaskCountQuery = `
  query MatterTaskRegisterCount($id: ID!) {
    total: legalTasksCount(where: { matter: { id: { equals: $id } } })
  }
`

const matterTaskPageQuery = `
  query MatterTaskRegisterPage($id: ID!, $skip: Int!) {
    legalTasks(
      where: { matter: { id: { equals: $id } } }
      orderBy: [{ dueAt: asc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status priority dueAt
    }
  }
`

const matterDeadlineCountQuery = `
  query MatterDeadlineRegisterCount($id: ID!) {
    total: deadlinesCount(where: { matter: { id: { equals: $id } } })
  }
`

const matterDeadlinePageQuery = `
  query MatterDeadlineRegisterPage($id: ID!, $skip: Int!) {
    deadlines(
      where: { matter: { id: { equals: $id } } }
      orderBy: [{ dueAt: asc }, { id: asc }]
      take: ${WORK_QUEUE_PAGE_SIZE}
      skip: $skip
    ) {
      id title status dueAt timezone isVerified
    }
  }
`

async function query<T>(document: string, variables: Record<string, unknown>): Promise<Result<T>> {
  const response = await keystoneClient<T>(document, variables)
  return response.success ? response : { success: false, error: response.error }
}

async function loadRegisterPage<T>(
  countResult: Result<number | null>,
  requestedPage: number,
  loadPage: (skip: number) => Promise<Result<T[]>>,
  countFailure: string,
  pageFailure: string,
): Promise<{ result: Result<T[]>; total?: number; pagination?: WorkQueuePageInfo }> {
  if (!countResult.success) return { result: { success: false, error: countFailure } }
  const total = countResult.data
  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
    return { result: { success: false, error: countFailure } }
  }
  const requested = workQueuePageInfo(total, requestedPage, 0)
  const result = await loadPage((requested.page - 1) * requested.pageSize)
  if (!result.success) return { result: { success: false, error: pageFailure } }
  return { result, total, pagination: workQueuePageInfo(total, requested.page, result.data.length) }
}

export async function getMatterWorkspace(
  matterId: string,
  pages: { teamPage?: number; partyPage?: number; communicationPage?: number; deadlinePage?: number; taskPage?: number; documentPage?: number; invoicePage?: number } = {},
): Promise<Result<MatterWorkspaceData>> {
  const id = matterId.trim()
  if (!id || id.length > 200) return { success: false, error: 'Matter reference is invalid.' }
  const matter = await query<{ matter: MatterWorkspaceData['matter'] | null }>(`
    query MatterWorkspaceIdentity($id: ID!) {
      matter(where: { id: $id }) {
        id matterNumber title status confidentiality openedAt
        client { displayName }
        responsibleAttorney { name }
        office { name timezone }
        practiceArea { name }
      }
    }
  `, { id })
  if (!matter.success) return matter
  if (!matter.data.matter) return { success: false, error: 'Matter is unavailable in the current authorization scope.' }
  const zone = validTimeZone(matter.data.matter.office?.timezone) ?? await getFirmTimeZone()

  const [teamCount, partyCount, communicationCount, deadlineCount, taskCount, documentCount, invoiceCount] = await Promise.all([
    query<{ matterTeamMembersCount: number | null }>(matterTeamMemberCountQuery, { id }),
    query<{ total: number | null }>(matterPartyCountQuery, { id }),
    query<{ total: number | null }>(matterCommunicationCountQuery, { id }),
    query<{ total: number | null }>(matterDeadlineCountQuery, { id }),
    query<{ total: number | null }>(matterTaskCountQuery, { id }),
    query<{ total: number | null }>(matterDocumentCountQuery, { id }),
    query<{ total: number | null }>(matterInvoiceCountQuery, { id }),
  ])

  const teamTotalResult: Result<number | null> = teamCount.success
    ? { success: true, data: teamCount.data.matterTeamMembersCount }
    : { success: false, error: teamCount.error }
  const partyTotalResult: Result<number | null> = partyCount.success
    ? { success: true, data: partyCount.data.total }
    : { success: false, error: partyCount.error }
  const communicationTotalResult: Result<number | null> = communicationCount.success
    ? { success: true, data: communicationCount.data.total }
    : { success: false, error: communicationCount.error }
  const deadlineTotalResult: Result<number | null> = deadlineCount.success
    ? { success: true, data: deadlineCount.data.total }
    : { success: false, error: deadlineCount.error }
  const taskTotalResult: Result<number | null> = taskCount.success
    ? { success: true, data: taskCount.data.total }
    : { success: false, error: taskCount.error }
  const documentTotalResult: Result<number | null> = documentCount.success
    ? { success: true, data: documentCount.data.total }
    : { success: false, error: documentCount.error }
  const invoiceTotalResult: Result<number | null> = invoiceCount.success
    ? { success: true, data: invoiceCount.data.total }
    : { success: false, error: invoiceCount.error }
  const [teamRegister, partyRegister, communicationRegister, deadlineRegister, taskRegister, documentRegister, invoiceRegister] = await Promise.all([
    loadRegisterPage(teamTotalResult, pages.teamPage ?? 1, async (skip) => {
      const response = await query<{ matterTeamMembers: TeamRow[] | null }>(matterTeamMemberPageQuery, { id, skip })
      if (!response.success) return { success: false, error: response.error }
      if (!Array.isArray(response.data.matterTeamMembers)) return { success: false, error: 'Matter-team rows are unavailable.' }
      return { success: true, data: response.data.matterTeamMembers }
    }, 'The authorized matter-team count could not be loaded.', 'The authorized matter-team page could not be loaded.'),
    loadRegisterPage(partyTotalResult, pages.partyPage ?? 1, async (skip) => {
      const response = await query<{ matterParties: PartyRow[] | null }>(matterPartyPageQuery, { id, skip })
      if (!response.success) return { success: false, error: response.error }
      if (!Array.isArray(response.data.matterParties)) return { success: false, error: 'Matter-party rows are unavailable.' }
      return { success: true, data: response.data.matterParties }
    }, 'The authorized matter-party count could not be loaded.', 'The authorized matter-party page could not be loaded.'),
    loadRegisterPage(communicationTotalResult, pages.communicationPage ?? 1, async (skip) => {
      const response = await query<{ communicationThreads: CommunicationRow[] | null }>(matterCommunicationPageQuery, { id, skip })
      if (!response.success) return { success: false, error: response.error }
      if (!Array.isArray(response.data.communicationThreads)) return { success: false, error: 'Matter communication rows are unavailable.' }
      return { success: true, data: response.data.communicationThreads }
    }, 'The authorized matter-communication count could not be loaded.', 'The authorized matter-communication page could not be loaded.'),
    loadRegisterPage(deadlineTotalResult, pages.deadlinePage ?? 1, async (skip) => {
      const response = await query<{ deadlines: DeadlineRow[] | null }>(matterDeadlinePageQuery, { id, skip })
      if (!response.success) return { success: false, error: response.error }
      if (!Array.isArray(response.data.deadlines)) return { success: false, error: 'Matter deadline rows are unavailable.' }
      return { success: true, data: response.data.deadlines }
    }, 'The authorized matter-deadline count could not be loaded.', 'The authorized matter-deadline page could not be loaded.'),
    loadRegisterPage(taskTotalResult, pages.taskPage ?? 1, async (skip) => {
      const response = await query<{ legalTasks: TaskRow[] | null }>(matterTaskPageQuery, { id, skip })
      if (!response.success) return { success: false, error: response.error }
      if (!Array.isArray(response.data.legalTasks)) return { success: false, error: 'Matter task rows are unavailable.' }
      return { success: true, data: response.data.legalTasks }
    }, 'The authorized matter-task count could not be loaded.', 'The authorized matter-task page could not be loaded.'),
    loadRegisterPage(documentTotalResult, pages.documentPage ?? 1, async (skip) => {
      const response = await query<{ documents: DocumentRow[] | null }>(matterDocumentPageQuery, { id, skip })
      if (!response.success) return { success: false, error: response.error }
      if (!Array.isArray(response.data.documents)) return { success: false, error: 'Matter document rows are unavailable.' }
      return { success: true, data: response.data.documents }
    }, 'The authorized matter-document count could not be loaded.', 'The authorized matter-document page could not be loaded.'),
    loadRegisterPage(invoiceTotalResult, pages.invoicePage ?? 1, async (skip) => {
      const response = await query<{ invoices: InvoiceRow[] | null }>(matterInvoicePageQuery, { id, skip })
      if (!response.success) return { success: false, error: response.error }
      if (!Array.isArray(response.data.invoices)) return { success: false, error: 'Matter invoice rows are unavailable.' }
      return { success: true, data: response.data.invoices }
    }, 'The authorized matter-invoice count could not be loaded.', 'The authorized matter-invoice page could not be loaded.'),
  ])

  const sections: MatterWorkspaceData['sections'] = []
  const notices = ['Every section is independently filtered through the current Keystone session; denied sections are omitted rather than loaded through sudo or Prisma.']
  const add = <T,>(key: string, title: string, result: Result<T[]>, map: (item: T) => WorkspaceRow, options: { total?: number; pagination?: WorkQueuePageInfo } = {}) => {
    if (!result.success) { notices.push(`${title} is unavailable to the current role.`); return }
    sections.push({ key, title, ...options, rows: result.data.map(map) })
  }
  const restricted = (value: string | null | undefined, fallback: string) => value?.trim() ? value : fallback
  const words = (value: string | null | undefined, fallback = 'unknown') => (value ?? fallback).replaceAll('_', ' ')
  add('team', 'Matter team', teamRegister.result, (item) => ({ id: item.id, title: restricted(item.user?.name, 'Team member · identity restricted'), meta: `${words(item.teamRole, 'role unavailable')} · Assigned ${date(item.assignedAt)}`, status: item.status }), { total: teamRegister.total, pagination: teamRegister.pagination })
  add('parties', 'Parties', partyRegister.result, (item) => ({ id: item.id, title: restricted(item.contact?.displayName, 'Party · identity restricted'), meta: `${words(item.partyRole)} · ${words(item.side)} side · Updated ${date(item.updatedAt)}`, status: item.status ?? 'unknown' }), { total: partyRegister.total, pagination: partyRegister.pagination })
  add('tasks', 'Tasks', taskRegister.result, (item) => ({ id: item.id, title: restricted(item.title, 'Untitled task'), meta: `${item.priority ?? 'Priority unavailable'} · Due ${formatInstant(item.dueAt, zone, { missing: 'no due date' })}`, status: item.status ?? 'unknown', href: `/dashboard/platform/work/task/${encodeURIComponent(item.id)}` }), { total: taskRegister.total, pagination: taskRegister.pagination })
  add('deadlines', 'Deadlines', deadlineRegister.result, (item) => ({ id: item.id, title: restricted(item.title, 'Untitled deadline'), meta: `Due ${formatInstant(item.dueAt, validTimeZone(item.timezone) ?? zone, { missing: 'time unavailable' })} · ${item.isVerified === true ? 'Verified' : item.isVerified === false ? 'Not verified' : 'Verification unavailable'}`, status: item.status ?? 'unknown', href: `/dashboard/platform/work/deadline/${encodeURIComponent(item.id)}` }), { total: deadlineRegister.total, pagination: deadlineRegister.pagination })
  add('documents', 'Documents', documentRegister.result, (item) => ({ id: item.id, title: restricted(item.title, 'Untitled document'), meta: `${item.category ?? 'Category unavailable'} · Updated ${formatInstant(item.updatedAt, zone, { includeTime: false, missing: 'no date' })}`, status: item.status ?? 'unknown', href: `/dashboard/platform/documents/document/${encodeURIComponent(item.id)}` }), { total: documentRegister.total, pagination: documentRegister.pagination })
  add('communications', 'Communications', communicationRegister.result, (item) => ({ id: item.id, title: restricted(item.subject, 'Untitled conversation'), meta: `Channel ${words(item.primaryChannel)} · Activity ${date(item.lastMessageAt)}`, status: item.status ?? 'unknown', href: `/dashboard/platform/communications/thread/${encodeURIComponent(item.id)}` }), { total: communicationRegister.total, pagination: communicationRegister.pagination })
  add('invoices', 'Invoices', invoiceRegister.result, (item) => ({ id: item.id, title: restricted(item.invoiceNumber, 'Invoice'), meta: `${formatMoneyLabel(item.balanceDueMinor, item.currencyCode)} due of ${formatMoneyLabel(item.totalMinor, item.currencyCode)} · Created ${formatInstant(item.createdAt, zone, { includeTime: false, missing: 'no date' })}`, status: item.status ?? 'unknown', ...(item.invoiceNumber && ['draft', 'approved', 'issued', 'partially_paid', 'overdue'].includes(item.status ?? '') ? { href: `/dashboard/platform/billing?view=invoices&q=${encodeURIComponent(item.invoiceNumber)}` } : {}) }), { total: invoiceRegister.total, pagination: invoiceRegister.pagination })

  return { success: true, data: { matter: matter.data.matter, sections, notices } }
}

function date(value: unknown) {
  const parsed = value ? new Date(String(value)) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(parsed) : 'no date'
}


