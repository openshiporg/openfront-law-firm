'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { CONNECTION_CATEGORIES, availableApiKeyScopes } from '../lib/machineScopes'
import type { ApiKeyRow, ConnectionRow, IntegrationAccessSetup, IntegrationActionState, IssueApiKeyState } from './integrationAccessTypes'

const PATH = '/dashboard/platform/integrations'
const MAX_KEY_LIFETIME_MS = 366 * 24 * 60 * 60 * 1000

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

async function loadApiKeys() {
  const response = await keystoneClient<{ apiKeys: Array<Omit<ApiKeyRow, 'scopes'> & { scopes: unknown }> }>(`
    query IntegrationApiKeys { apiKeys(orderBy: [{ createdAt: desc }], take: 50) { id name prefix status scopes expiresAt lastUsedAt createdAt owner { name email } } }
  `)
  if (!response.success) return null
  return (response.data.apiKeys ?? []).map((key) => ({ ...key, scopes: Array.isArray(key.scopes) ? key.scopes.map(String) : [] }))
}

export async function getIntegrationAccessSetup(): Promise<IntegrationAccessSetup> {
  const [apiKeys, connections] = await Promise.all([
    loadApiKeys(),
    keystoneClient<{ integrationConnections: ConnectionRow[] }>(`
      query IntegrationConnectionRows { integrationConnections(orderBy: [{ name: asc }, { id: asc }], take: 50) { id name provider category status lastSyncedAt } }
    `),
  ])
  return {
    apiKeys: apiKeys ? { status: 'loaded', rows: apiKeys } : { status: 'unavailable' },
    connections: connections.success ? { status: 'loaded', rows: connections.data.integrationConnections ?? [] } : { status: 'unavailable' },
  }
}

export async function issueApiKeyAction(previous: IssueApiKeyState, formData: FormData): Promise<IssueApiKeyState> {
  const revision = previous.revision + 1
  const name = text(formData, 'name')
  const allowed = new Set(availableApiKeyScopes())
  const scopes = [...new Set(formData.getAll('scopes').map((scope) => String(scope).trim()).filter(Boolean))]
  const expiresRaw = text(formData, 'expiresAt')
  if (!name) return { ok: false, message: 'Name is required.', revision }
  if (name.length > 120) return { ok: false, message: 'Name must be 120 characters or fewer.', revision }
  if (!scopes.length) return { ok: false, message: 'Choose at least one scope.', revision }
  if (scopes.length > 20) return { ok: false, message: 'Choose 20 scopes or fewer.', revision }
  if (scopes.some((scope) => !allowed.has(scope))) return { ok: false, message: 'A chosen scope is not available.', revision }
  let expiresAt: string | null = null
  if (expiresRaw) {
    const date = new Date(expiresRaw)
    const remaining = date.getTime() - Date.now()
    if (Number.isNaN(remaining) || remaining <= 0 || remaining > MAX_KEY_LIFETIME_MS) return { ok: false, message: 'Expiry must be in the future and within 366 days.', revision }
    expiresAt = date.toISOString()
  }
  const existing = await loadApiKeys()
  if (!existing) return { ok: false, message: 'API keys need credential management permission.', revision }
  if (existing.some((key) => key.name === name)) return { ok: false, message: 'An API key with this name already exists.', revision }
  const result = await keystoneClient<{ issueApiKey: { credential: { name: string; prefix: string | null }; secret: string } }>(`
    mutation IssueApiKey($name: String!, $scopes: [String!]!, $expiresAt: DateTime) {
      issueApiKey(name: $name, scopes: $scopes, expiresAt: $expiresAt) { credential { name prefix } secret }
    }
  `, { name, scopes, expiresAt })
  if (!result.success) return { ok: false, message: 'The key was not issued. You need credential management permission, and every scope must be within your own role.', revision }
  revalidatePath(PATH)
  const { credential, secret } = result.data.issueApiKey
  return { ok: true, message: 'API key issued. Copy the secret now; it will not be shown again.', revision, secret, prefix: credential.prefix, name: credential.name }
}

export async function revokeApiKeyAction(previous: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  const revision = previous.revision + 1
  const id = text(formData, 'id')
  const reason = text(formData, 'reason')
  if (!id) return { ok: false, message: 'API key is missing.', revision }
  if (reason.length < 3 || reason.length > 1000) return { ok: false, message: 'Enter a reason between 3 and 1,000 characters.', revision }
  const result = await keystoneClient<{ revokeApiKey: { replayed: boolean } }>(`
    mutation RevokeApiKey($id: ID!, $reason: String!) { revokeApiKey(id: $id, reason: $reason) { replayed } }
  `, { id, reason })
  if (!result.success) return { ok: false, message: 'The key was not revoked. Credential management permission is required.', revision }
  revalidatePath(PATH)
  return { ok: true, message: 'API key revoked.', revision }
}

export async function createConnectionAction(previous: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  const revision = previous.revision + 1
  const name = text(formData, 'name')
  const provider = text(formData, 'provider')
  const category = text(formData, 'category')
  if (!name) return { ok: false, message: 'Name is required.', revision }
  if (name.length > 200) return { ok: false, message: 'Name must be 200 characters or fewer.', revision }
  if (!provider) return { ok: false, message: 'Provider is required.', revision }
  if (provider.length > 120) return { ok: false, message: 'Provider must be 120 characters or fewer.', revision }
  if (!CONNECTION_CATEGORIES.some(([value]) => value === category)) return { ok: false, message: 'Choose a category.', revision }
  const result = await keystoneClient<{ createIntegrationConnection: { id: string } | null }>(`
    mutation CreateIntegrationConnection($data: IntegrationConnectionCreateInput!) { createIntegrationConnection(data: $data) { id } }
  `, { data: { name, provider, category } })
  if (!result.success || !result.data.createIntegrationConnection) return { ok: false, message: 'The connection was not added. Integration management permission is required.', revision }
  revalidatePath(PATH)
  return { ok: true, message: 'Connection added as pending. Activate it when it is ready.', revision }
}
