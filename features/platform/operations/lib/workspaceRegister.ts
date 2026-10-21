import {
  workspaceListQueries,
  workspaceRegisterOptions,
  workspaceSource,
  type WorkspaceRegisterOptions,
  type WorkspaceSource,
} from '@/features/keystone/mutations/practiceWorkspace'

import { lifecycles } from '@/features/keystone/lib/lifecycles'

export const REGISTER_PAGE_SIZE = 25
export const REGISTER_SEARCH_MAX_LENGTH = 100

export type RegisterParams = { view: string; q: string; status: string; sort: string; page: number; scope?: 'queue' | 'history' }
export type RegisterSortOption = { key: string; label: string; orderBy: Array<Record<string, 'asc' | 'desc'>> }
type SearchParamRecord = Record<string, string | string[] | undefined>

function first(raw: SearchParamRecord, key: string) {
  const value = raw[key]
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

// `view` selects one section's full register; everything else is untrusted URL state
// that is clamped or discarded rather than passed through.
export function parseRegisterParams(raw: SearchParamRecord): RegisterParams | null {
  const view = first(raw, 'view').trim()
  if (!/^[a-z][a-z-]{0,40}$/.test(view)) return null
  const page = Number(first(raw, 'page'))
  return {
    view,
    scope: first(raw, 'scope') === 'history' ? 'history' : 'queue',
    q: first(raw, 'q').trim().slice(0, REGISTER_SEARCH_MAX_LENGTH),
    status: first(raw, 'status').trim().slice(0, 40),
    sort: first(raw, 'sort').trim().slice(0, 40),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

const historyModels: Partial<Record<string, keyof typeof lifecycles>> = {
  Matter: 'matter', Intake: 'intake', Consultation: 'consultation', ConflictCheck: 'conflictCheck',
  LegalTask: 'legalTask', Deadline: 'deadline', DocketEntry: 'docketEntry', Document: 'document',
  SignatureRequest: 'signatureRequest', CommunicationMessage: 'communicationMessage',
  CommunicationThread: 'communicationThread', CommunicationDelivery: 'communicationDelivery',
  TimeEntry: 'timeEntry', Expense: 'expense', Invoice: 'invoice',
}
const historyCategories = new Set(['intake', 'matters', 'work', 'documents', 'communications', 'time-expenses', 'billing'])

export function registerDefinition(category: string, key: string, scope: 'queue' | 'history' = 'queue') {
  const base = workspaceSource(category, key)
  if (!base || !workspaceListQueries[base.model]) return null
  const lifecycle = historyCategories.has(category) ? historyModels[base.model] : undefined
  let source = base
  if (scope === 'history' && lifecycle) {
    // Only the operational status preset is removed. Any other source predicate
    // AND all current ordinary list/field/tenant/wall filters remain in force.
    const where = Object.fromEntries(Object.entries(base.where ?? {}).filter(([field]) => field !== 'status'))
    source = { ...base, where, historyStatuses: Object.keys(lifecycles[lifecycle]) }
  }
  return { source, options: workspaceRegisterOptions[`${category}:${key}`] ?? {} }
}

export function registerStatusOptions(source: WorkspaceSource): string[] {
  if (source.historyStatuses) return source.historyStatuses
  const status = (source.where as { status?: { in?: unknown } } | undefined)?.status
  return Array.isArray(status?.in) ? status.in.map(String) : []
}

function asOrderList(orderBy: WorkspaceSource['orderBy']): Array<Record<string, 'asc' | 'desc'>> {
  const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [{ updatedAt: 'desc' }]
  return list as Array<Record<string, 'asc' | 'desc'>>
}

export function registerSortOptions(source: WorkspaceSource, options: WorkspaceRegisterOptions): RegisterSortOption[] {
  const sorts: RegisterSortOption[] = [{ key: 'default', label: 'Default order', orderBy: asOrderList(source.orderBy) }]
  const by = (field: string, direction: 'asc' | 'desc'): Record<string, 'asc' | 'desc'> => ({ [field]: direction })
  if (options.dateField) {
    sorts.push({ key: 'date-asc', label: 'Oldest / earliest first', orderBy: [by(options.dateField, 'asc')] })
    sorts.push({ key: 'date-desc', label: 'Newest / latest first', orderBy: [by(options.dateField, 'desc')] })
  }
  if (options.nameField) sorts.push({ key: 'name-asc', label: 'Name A–Z', orderBy: [by(options.nameField, 'asc')] })
  return sorts
}

function nested(path: string, filter: Record<string, unknown>): Record<string, unknown> {
  return path.split('.').reduceRight<Record<string, unknown>>((inner, part) => ({ [part]: inner }), filter)
}

// The section's own base filter is always kept; status narrows only within the statuses
// that section already shows, and search touches only fields the register projects.
export function registerWhere(source: WorkspaceSource, options: WorkspaceRegisterOptions, params: Pick<RegisterParams, 'q' | 'status'>) {
  const clauses: Array<Record<string, unknown>> = [source.where ?? {}]
  if (params.status && registerStatusOptions(source).includes(params.status)) clauses.push({ status: { equals: params.status } })
  if (params.q && options.search?.length) {
    clauses.push({ OR: options.search.map((path) => nested(path, { contains: params.q, mode: 'insensitive' })) })
  }
  return { AND: clauses }
}

export function registerOrderBy(source: WorkspaceSource, options: WorkspaceRegisterOptions, sortKey: string) {
  const sorts = registerSortOptions(source, options)
  const chosen = sorts.find((option) => option.key === sortKey) ?? sorts[0]
  const orderBy = [...chosen.orderBy]
  if (!orderBy.some((entry) => 'id' in entry)) orderBy.push({ id: 'asc' })
  return orderBy
}

export function registerQueries(source: WorkspaceSource) {
  const list = workspaceListQueries[source.model]
  return {
    count: `query WorkspaceRegisterCount($where: ${source.model}WhereInput!) { total: ${list}Count(where: $where) }`,
    page: `query WorkspaceRegisterPage($where: ${source.model}WhereInput!, $orderBy: [${source.model}OrderByInput!]!, $take: Int!, $skip: Int!) { items: ${list}(where: $where, orderBy: $orderBy, take: $take, skip: $skip) { ${source.query} } }`,
  }
}

export function registerHref(category: string, params: Partial<RegisterParams> & { view: string }) {
  const search = new URLSearchParams({ view: params.view })
  if (params.scope === 'history') search.set('scope', 'history')
  if (params.q) search.set('q', params.q)
  if (params.status) search.set('status', params.status)
  if (params.sort && params.sort !== 'default') search.set('sort', params.sort)
  if (params.page && params.page > 1) search.set('page', String(params.page))
  return `/dashboard/platform/${category}?${search.toString()}`
}
