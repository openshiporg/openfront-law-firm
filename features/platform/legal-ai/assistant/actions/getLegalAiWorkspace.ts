'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type LegalAiMatterSummary = {
  id: string
  matterNumber: string
  title: string
  status: string
  confidentiality: string
  updatedAt: string | null
  office?: { timezone?: string | null } | null
  firm?: { defaultTimezone?: string | null } | null
  client?: { displayName?: string | null } | null
  responsibleAttorney?: { name?: string | null } | null
}

export type LegalAiEvidenceDocument = {
  id: string
  title: string
  status: string
  category: string
  confidentiality: string
  description?: string | null
  updatedAt?: string | null
  matter?: { id: string; matterNumber: string; title: string } | null
  currentVersion?: {
    id: string
    versionNumber: number
    fileName: string
    mediaType: string
    checksumSha256: string
    createdAt?: string | null
  } | null
}

export type EvidencePage = { page: number; pageCount: number | null; total: number | null; canContinue?: boolean }

export type LegalAiMatterWorkspace = {
  matter: LegalAiMatterSummary
  pages: { documents: EvidencePage; tasks: EvidencePage; deadlines: EvidencePage; auditEvents: EvidencePage }
  documents: LegalAiEvidenceDocument[]
  tasks: Array<{ id: string; title: string; status: string; priority: string; dueAt?: string | null }>
  deadlines: Array<{ id: string; title: string; status: string; dueAt?: string | null; timezone?: string | null; isVerified: boolean }>
  auditEvents: Array<{ id: string; eventType: string; category: string; outcome: string; occurredAt: string }>
  notices: string[]
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

const matterFields = `
  id
  matterNumber
  title
  status
  confidentiality
  updatedAt
  office { timezone }
  firm { defaultTimezone }
  client { displayName }
  responsibleAttorney { name }
`

async function boundedQuery<T>(query: string, variables?: Record<string, unknown>): Promise<Result<T>> {
  const response = await keystoneClient<T>(query, variables)
  return response.success
    ? { success: true, data: response.data }
    : { success: false, error: response.error }
}

// Retrieval stays bounded per request, but every authorized record remains reachable:
// each list carries its full count and pages oldest-to-newest or by due date.
function evidencePage(total: number | null | undefined, requested: number | undefined, size: number): EvidencePage & { skip: number } {
  const count = typeof total === 'number' && Number.isSafeInteger(total) && total >= 0 ? total : null
  const pageCount = count === null ? null : Math.max(1, Math.ceil(count / size))
  const requestedPage = Math.max(Number.isSafeInteger(requested) ? Number(requested) : 1, 1)
  const page = Math.min(requestedPage, pageCount ?? Math.floor(2_147_483_647 / size) + 1)
  return { page, pageCount, total: count, skip: (page - 1) * size }
}

const searchWhere = (q: string) => (q ? { OR: [{ matterNumber: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }] } : {})

export async function getLegalAiOverview(requestedPage = 1, query = ''): Promise<Result<{ matters: LegalAiMatterSummary[]; page: EvidencePage; query: string }>> {
  const q = String(query ?? '').trim().slice(0, 100)
  const where = { AND: [{ status: { in: ['proposed', 'pending_conflict', 'open', 'on_hold', 'closing'] } }, searchWhere(q)] }
  const count = await boundedQuery<{ total: number }>(`query LegalAiOverviewCount($where: MatterWhereInput!) { total: mattersCount(where: $where) }`, { where })
  if (!count.success) return count
  const page = evidencePage(count.data.total, requestedPage, 24)
  const result = await boundedQuery<{ matters: LegalAiMatterSummary[] }>(`
    query LegalAiOverview($where: MatterWhereInput!, $skip: Int!) {
      matters(
        where: $where
        orderBy: [{ updatedAt: desc }, { id: asc }]
        take: 24
        skip: $skip
      ) { ${matterFields} }
    }
  `, { where, skip: page.skip })
  if (!result.success) return result
  return { success: true, data: { matters: result.data.matters, page: { page: page.page, pageCount: page.pageCount, total: page.total }, query: q } }
}

export type LegalAiEvidencePages = { documentPage?: number; taskPage?: number; deadlinePage?: number; auditPage?: number }

export async function getLegalAiMatterWorkspace(matterId: string, pages: LegalAiEvidencePages = {}): Promise<Result<LegalAiMatterWorkspace>> {
  const id = matterId.trim()
  if (!id || id.length > 200) return { success: false, error: 'Matter reference is invalid.' }

  const matterResult = await boundedQuery<{ matter: LegalAiMatterSummary | null }>(`
    query LegalAiMatter($id: ID!) {
      matter(where: { id: $id }) { ${matterFields} }
    }
  `, { id })
  if (!matterResult.success) return matterResult
  if (!matterResult.data.matter) return { success: false, error: 'Matter is unavailable in the current authorization scope.' }

  // Each collection has independent availability. A denied/failed count is
  // UNKNOWN, never zero, and cannot remove another collection's continuation.
  const names = ['documents', 'tasks', 'deadlines', 'auditEvents'] as const
  const countFields = ['documentsCount', 'legalTasksCount', 'deadlinesCount', 'auditEventsCount'] as const
  const counts = await Promise.all(countFields.map((field, index) => boundedQuery<{ total: number }>(`
    query LegalAiCollectionCount($id: ID!) {
      total: ${field}(where: { matter: { id: { equals: $id } } ${index === 0 ? ', status: { in: [draft, active, archived] }' : ''} })
    }
  `, { id })))
  const total = (key: typeof names[number]) => {
    const count = counts[names.indexOf(key)]
    return count.success ? count.data.total : null
  }
  const documentPage = evidencePage(total('documents'), pages.documentPage, 40)
  const taskPage = evidencePage(total('tasks'), pages.taskPage, 30)
  const deadlinePage = evidencePage(total('deadlines'), pages.deadlinePage, 30)
  const auditPage = evidencePage(total('auditEvents'), pages.auditPage, 30)

  const [documents, tasks, deadlines, audit] = await Promise.all([
    boundedQuery<{ documents: LegalAiEvidenceDocument[] }>(`
      query LegalAiMatterDocuments($id: ID!, $skip: Int!) {
        documents(
          where: { matter: { id: { equals: $id } }, status: { in: [draft, active, archived] } }
          orderBy: [{ updatedAt: desc }, { id: asc }]
          take: 40
          skip: $skip
        ) {
          id title status category confidentiality description updatedAt
          matter { id matterNumber title }
          currentVersion { id versionNumber fileName mediaType checksumSha256 createdAt }
        }
      }
    `, { id, skip: documentPage.skip }),
    boundedQuery<{ legalTasks: LegalAiMatterWorkspace['tasks'] }>(`
      query LegalAiMatterTasks($id: ID!, $skip: Int!) {
        legalTasks(
          where: { matter: { id: { equals: $id } } }
          orderBy: [{ dueAt: asc }, { updatedAt: desc }, { id: asc }]
          take: 30
          skip: $skip
        ) { id title status priority dueAt }
      }
    `, { id, skip: taskPage.skip }),
    boundedQuery<{ deadlines: LegalAiMatterWorkspace['deadlines'] }>(`
      query LegalAiMatterDeadlines($id: ID!, $skip: Int!) {
        deadlines(
          where: { matter: { id: { equals: $id } } }
          orderBy: [{ dueAt: asc }, { id: asc }]
          take: 30
          skip: $skip
        ) { id title status dueAt timezone isVerified }
      }
    `, { id, skip: deadlinePage.skip }),
    boundedQuery<{ auditEvents: LegalAiMatterWorkspace['auditEvents'] }>(`
      query LegalAiMatterAudit($id: ID!, $skip: Int!) {
        auditEvents(
          where: { matter: { id: { equals: $id } } }
          orderBy: [{ occurredAt: desc }, { id: asc }]
          take: 30
          skip: $skip
        ) { id eventType category outcome occurredAt }
      }
    `, { id, skip: auditPage.skip }),
  ])

  const notices = [
    'Only evidence returned by Keystone under the current firm, role, matter assignment, and ethical-wall scope is shown.',
    'No model is invoked and no legal conclusion is generated by this workspace.',
  ]
  for (const [index, count] of counts.entries()) if (!count.success) notices.push(`${names[index]} inventory count is unavailable. Retry this collection; loaded rows are not a complete inventory.`)
  if (!documents.success) notices.push('Document evidence is unavailable to the current role.')
  if (!tasks.success) notices.push('Task evidence is unavailable to the current role.')
  if (!deadlines.success) notices.push('Deadline evidence is unavailable to the current role.')
  if (!audit.success) notices.push('Audit evidence is unavailable to the current role.')
  const strip = ({ page, pageCount, total: count }: EvidencePage) => ({ page, pageCount, total: count })

  return {
    success: true,
    data: {
      matter: matterResult.data.matter,
      pages: {
        documents: { ...(documents.success ? strip(documentPage) : { ...strip(documentPage), total: null, pageCount: null }), canContinue: documents.success && documents.data.documents.length === 40 },
        tasks: { ...(tasks.success ? strip(taskPage) : { ...strip(taskPage), total: null, pageCount: null }), canContinue: tasks.success && tasks.data.legalTasks.length === 30 },
        deadlines: { ...(deadlines.success ? strip(deadlinePage) : { ...strip(deadlinePage), total: null, pageCount: null }), canContinue: deadlines.success && deadlines.data.deadlines.length === 30 },
        auditEvents: { ...(audit.success ? strip(auditPage) : { ...strip(auditPage), total: null, pageCount: null }), canContinue: audit.success && audit.data.auditEvents.length === 30 },
      },
      documents: documents.success ? documents.data.documents : [],
      tasks: tasks.success ? tasks.data.legalTasks : [],
      deadlines: deadlines.success ? deadlines.data.deadlines : [],
      auditEvents: audit.success ? audit.data.auditEvents : [],
      notices,
    },
  }
}

export async function getLegalAiKnowledge(requestedPage = 1, query = ''): Promise<Result<{ documents: LegalAiEvidenceDocument[]; page: EvidencePage; query: string }>> {
  const q = String(query ?? '').trim().slice(0, 100)
  const where = { status: { equals: 'active' }, category: { in: ['research', 'internal', 'contract'] }, ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) }
  const count = await boundedQuery<{ total: number }>(`query LegalAiKnowledgeCount($where: DocumentWhereInput!) { total: documentsCount(where: $where) }`, { where })
  if (!count.success) return count
  const page = evidencePage(count.data.total, requestedPage, 40)
  const result = await boundedQuery<{ documents: LegalAiEvidenceDocument[] }>(`
    query LegalAiKnowledge($where: DocumentWhereInput!, $skip: Int!) {
      documents(
        where: $where
        orderBy: [{ updatedAt: desc }, { id: asc }]
        take: 40
        skip: $skip
      ) {
        id title status category confidentiality description updatedAt
        matter { id matterNumber title }
        currentVersion { id versionNumber fileName mediaType checksumSha256 createdAt }
      }
    }
  `, { where, skip: page.skip })
  if (!result.success) return result
  return { success: true, data: { documents: result.data.documents, page: { page: page.page, pageCount: page.pageCount, total: page.total }, query: q } }
}
