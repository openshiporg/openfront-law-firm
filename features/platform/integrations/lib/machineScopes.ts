import { machineScopePermissionMap } from '@/features/keystone/access'

/** The allowlisted machine scopes issueApiKey accepts (normalizeMachineScopes). Server-only. */
export function availableApiKeyScopes(): string[] {
  return Object.keys(machineScopePermissionMap)
}

export const CONNECTION_CATEGORIES: Array<[string, string]> = [
  ['email', 'Email'],
  ['calendar', 'Calendar'],
  ['document_storage', 'Document storage'],
  ['signature', 'Signature'],
  ['payment', 'Payment'],
  ['court', 'Court / docket'],
  ['accounting', 'Accounting'],
  ['other', 'Other'],
]
