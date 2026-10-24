import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import { DOCKET_STATUSES, type CourtRow, type DocketDetail, type DocketRow, type DocumentVersionOption } from '../lib/docketTypes'

type Result<T> = { success: true; data: T } | { success: false; error: string }

const docketFields = 'id docketNumber title status filedAt court { id name } matter { id matterNumber title } entriesCount'

export async function getCourts(): Promise<Result<CourtRow[]>> {
  const response = await keystoneClient<{ courts: CourtRow[] | null }>(`
    query DocketCourts { courts(orderBy: [{ name: asc }, { id: asc }], take: 200) { id name courtType jurisdiction division status phone website filingUrl docketsCount } }
  `)
  if (!response.success || !Array.isArray(response.data.courts)) return { success: false, error: 'Courts are unavailable to your role.' }
  return { success: true, data: response.data.courts }
}

export async function getDocketRegister({ status, q }: { status: string; q: string }): Promise<Result<{ dockets: DocketRow[]; counts: Record<string, number> }>> {
  const search = q.trim().slice(0, 120)
  const statusFilter = (DOCKET_STATUSES as readonly string[]).includes(status) ? status : 'active'
  const searchWhere = search ? { OR: [{ docketNumber: { contains: search, mode: 'insensitive' } }, { title: { contains: search, mode: 'insensitive' } }, { court: { name: { contains: search, mode: 'insensitive' } } }] } : {}
  const response = await keystoneClient<{ dockets: DocketRow[] | null; active: number; stayed: number; appealed: number; closed: number }>(`
    query DocketRegister($where: DocketWhereInput!, $active: DocketWhereInput!, $stayed: DocketWhereInput!, $appealed: DocketWhereInput!, $closed: DocketWhereInput!) {
      dockets(where: $where, orderBy: [{ updatedAt: desc }, { id: asc }], take: 100) { ${docketFields} }
      active: docketsCount(where: $active)
      stayed: docketsCount(where: $stayed)
      appealed: docketsCount(where: $appealed)
      closed: docketsCount(where: $closed)
    }
  `, {
    where: { ...searchWhere, status: { equals: statusFilter } },
    ...Object.fromEntries(DOCKET_STATUSES.map((value) => [value, { ...searchWhere, status: { equals: value } }])),
  })
  if (!response.success || !Array.isArray(response.data.dockets)) return { success: false, error: 'Dockets are unavailable to your role.' }
  const { dockets, ...counts } = response.data
  return { success: true, data: { dockets, counts } }
}

export async function getDocketDetail(docketId: string): Promise<Result<{ docket: DocketDetail; versions: DocumentVersionOption[] }>> {
  const id = docketId.trim()
  if (!id || id.length > 200) return { success: false, error: 'Docket reference is invalid.' }
  const response = await keystoneClient<{ docket: DocketDetail | null }>(`
    query DocketDetail($id: ID!) {
      docket(where: { id: $id }) {
        ${docketFields} notes closedAt
        entries(orderBy: [{ occurredAt: desc }, { id: asc }], take: 200) {
          id title entryType status occurredAt filedAt enteredAt description sourceUrl isVerified verifiedAt verifiedBy { name }
          documentVersion { id fileName versionNumber }
        }
        deadlines(orderBy: [{ dueAt: asc }, { id: asc }], take: 100) { id title status deadlineType dueAt timezone isVerified }
      }
    }
  `, { id })
  if (!response.success) return { success: false, error: 'This docket is unavailable in your current access.' }
  const docket = response.data.docket
  if (!docket) return { success: false, error: 'This docket is unavailable in your current access.' }
  let versions: DocumentVersionOption[] = []
  if (docket.matter?.id) {
    const options = await keystoneClient<{ documentVersions: Array<{ id: string; fileName: string | null; versionNumber: number | null; document: { title: string | null } | null }> | null }>(`
      query DocketVersionOptions($matterId: ID!) {
        documentVersions(where: { document: { matter: { id: { equals: $matterId } } } }, orderBy: [{ createdAt: desc }, { id: asc }], take: 100) { id fileName versionNumber document { title } }
      }
    `, { matterId: docket.matter.id })
    if (options.success && Array.isArray(options.data.documentVersions)) {
      versions = options.data.documentVersions.map((version) => ({ id: version.id, label: `${version.document?.title || 'Document'} · v${version.versionNumber ?? '?'}${version.fileName ? ` · ${version.fileName}` : ''}` }))
    }
  }
  return { success: true, data: { docket, versions } }
}
