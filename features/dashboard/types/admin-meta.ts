import type { JSONValue } from './index'
import type { getGraphQLNames } from '../lib/getGqlNames'

export type FieldSchema = Record<string, JSONValue> & {
  kind?: string; type?: string; mode?: string; many?: boolean
  validation?: { isRequired?: boolean; min?: number; max?: number; length?: { min?: number; max?: number } }
  options?: Array<{ label: string; value: string | number }>
  refListKey?: string; refLabelField?: string; labelField?: string; searchFields?: string[]
  defaultValue?: JSONValue; isRequired?: boolean; isNullable?: boolean
}
export interface RawFieldMeta {
  path: string; label: string; description: string | null
  fieldMeta: FieldSchema
  viewsIndex: number; customViewsIndex: number | null
  isFilterable: boolean; isOrderable: boolean
  search: 'default' | 'insensitive' | null
  isNonNull: string[]
  createView: { fieldMode: 'edit' | 'hidden'; isRequired?: boolean }
  itemView: { fieldMode: 'edit' | 'read' | 'hidden' | null; fieldPosition: 'form' | 'sidebar' | null; isRequired?: boolean }
  listView: { fieldMode: 'read' | 'hidden' }
  isRequired?: boolean
}
export interface RawListMeta {
  key: string; path: string; label: string; singular: string; plural: string
  description: string | null; fields: RawFieldMeta[]
  initialColumns: string[]; initialSearchFields: string[]; pageSize: number; labelField: string
  initialSort: { field: string; direction: 'ASC' | 'DESC' } | null
  isSingleton: boolean; isHidden: boolean; hideCreate: boolean; hideDelete: boolean
  itemQueryName: string; listQueryName: string
  groups: Array<{ label: string; description: string | null; fields: Array<{ path: string }> }>
}
export type EnhancedListMeta = RawListMeta & { gqlNames: ReturnType<typeof getGraphQLNames>; graphql: { names: ReturnType<typeof getGraphQLNames> } }
export type RecordListMeta = Omit<EnhancedListMeta, 'fields'> & { fields: Record<string, RawFieldMeta> }
export interface RawAdminMeta { lists: RawListMeta[]; enableSessionItem?: boolean; enableSignout?: boolean }
export interface AdminMeta { lists: EnhancedListMeta[]; list?: RecordListMeta; enableSessionItem?: boolean; enableSignout?: boolean }
