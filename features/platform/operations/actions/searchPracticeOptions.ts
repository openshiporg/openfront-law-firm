'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import {
  PRACTICE_OPTION_SEARCH_LIMIT,
  practiceOptionDefinitions,
  type PracticeOption,
  type PracticeOptionKind,
} from '../lib/practiceOptions'

export async function searchPracticeOptions(kind: PracticeOptionKind, query: string, page = 1): Promise<{ success: true; data: PracticeOption[]; page: number; nextPage: number | null } | { success: false; error: string }> {
  const definition = Object.hasOwn(practiceOptionDefinitions, kind) ? practiceOptionDefinitions[kind] : null
  if (!definition) return { success: false, error: 'Unsupported option search.' }
  const q = String(query ?? '').trim().slice(0, 100)
  if (!Number.isSafeInteger(page) || page < 1 || page > Math.floor(2_147_483_647 / PRACTICE_OPTION_SEARCH_LIMIT)) return { success: false, error: 'Invalid option page. Start a new search.' }
  const response = await keystoneClient<{ rows: Array<Record<string, unknown>> }>(definition.query, {
    where: definition.where({ contains: q, mode: 'insensitive' }),
    take: PRACTICE_OPTION_SEARCH_LIMIT + 1,
    skip: (page - 1) * PRACTICE_OPTION_SEARCH_LIMIT,
  })
  if (!response.success) return { success: false, error: response.error }
  if (!Array.isArray(response.data.rows)) return { success: false, error: 'The option page could not be loaded.' }
  return { success: true, page, nextPage: response.data.rows.length > PRACTICE_OPTION_SEARCH_LIMIT ? page + 1 : null, data: response.data.rows.slice(0, PRACTICE_OPTION_SEARCH_LIMIT).map(definition.map).filter((option) => option.value) }
}
