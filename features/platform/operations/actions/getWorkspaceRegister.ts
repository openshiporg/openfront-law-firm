// Server-only loader, deliberately not a server action: its inputs (section metadata and
// the section-level action affordance) come from the trusted workspace resolver result.
import { mapWorkspaceRecord } from '@/features/keystone/mutations/practiceWorkspace'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import type { PracticeOverviewQueueItem, PracticeWorkspacePageInfo } from '../types'
import { workQueuePageInfo } from '../lib/workQueuePagination'
import {
  REGISTER_PAGE_SIZE,
  registerDefinition,
  registerOrderBy,
  registerQueries,
  registerSortOptions,
  registerStatusOptions,
  registerWhere,
  type RegisterParams,
  type RegisterSortOption,
} from '../lib/workspaceRegister'

export type WorkspaceRegister = {
  category: string
  key: string
  title: string
  description: string
  total: number
  items: PracticeOverviewQueueItem[]
  pagination: PracticeWorkspacePageInfo
  params: RegisterParams
  searchable: boolean
  historyAvailable?: boolean
  statusOptions: string[]
  sortOptions: Array<Pick<RegisterSortOption, 'key' | 'label'>>
}

export type WorkspaceRegisterResult = { success: true; data: WorkspaceRegister } | { success: false; error: string }

const iso = (value: Date | null) => (value ? value.toISOString() : null)

// A full, searchable register for one workspace section. Every request runs as the
// signed-in viewer, so list access, matter scope and ethical walls apply unchanged;
// `canAct` is the section-level affordance the practice workspace already computed.
export async function getWorkspaceRegister(
  category: string,
  params: RegisterParams,
  sectionMeta: { title: string; description: string; canAct: boolean },
): Promise<WorkspaceRegisterResult> {
  const definition = registerDefinition(category, params.view, params.scope)
  if (!definition) return { success: false, error: 'This register is not available for the workspace.' }
  const { source, options } = definition
  const queries = registerQueries(source)
  const where = registerWhere(source, options, params)

  const count = await keystoneClient<{ total: number | null }>(queries.count, { where })
  if (!count.success || typeof count.data.total !== 'number') {
    return { success: false, error: 'The authorized register count could not be loaded.' }
  }
  const requested = workQueuePageInfo(count.data.total, params.page, 0, REGISTER_PAGE_SIZE)
  const page = await keystoneClient<{ items: Array<Record<string, unknown>> | null }>(queries.page, {
    where,
    orderBy: registerOrderBy(source, options, params.sort),
    take: REGISTER_PAGE_SIZE,
    skip: (requested.page - 1) * REGISTER_PAGE_SIZE,
  })
  if (!page.success || !Array.isArray(page.data.items)) {
    return { success: false, error: 'The authorized register page could not be loaded.' }
  }

  const items = page.data.items.map((record, index) => {
    const item = mapWorkspaceRecord(category, source, record, (requested.page - 1) * REGISTER_PAGE_SIZE + index + 1, sectionMeta.canAct)
    return { ...item, at: iso(item.at) }
  })
  return {
    success: true,
    data: {
      category,
      key: source.key,
      title: sectionMeta.title,
      description: source.historyStatuses ? 'Current and terminal records within your current authorization scope. Historical records retain their original lifecycle restrictions.' : sectionMeta.description,
      total: count.data.total,
      items,
      pagination: workQueuePageInfo(count.data.total, requested.page, items.length, REGISTER_PAGE_SIZE),
      params: { ...params, page: requested.page },
      searchable: Boolean(options.search?.length),
      historyAvailable: Boolean(registerDefinition(category, params.view, 'history')?.source.historyStatuses),
      statusOptions: registerStatusOptions(source),
      sortOptions: registerSortOptions(source, options).map(({ key, label }) => ({ key, label })),
    },
  }
}
