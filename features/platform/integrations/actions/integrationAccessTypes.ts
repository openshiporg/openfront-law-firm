export type IntegrationActionState = { ok: boolean; message: string; revision: number }

/** The issued secret travels to the browser once in this state and is never stored or logged. */
export type IssueApiKeyState = IntegrationActionState & { secret?: string; prefix?: string | null; name?: string }

export type ApiKeyRow = {
  id: string
  name: string
  prefix: string | null
  status: string | null
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string | null
  owner: { name: string | null; email: string | null } | null
}

export type ConnectionRow = { id: string; name: string; provider: string; category: string | null; status: string | null; lastSyncedAt: string | null }

export type IntegrationAccessSetup = {
  apiKeys: { status: 'loaded'; rows: ApiKeyRow[] } | { status: 'unavailable' }
  connections: { status: 'loaded'; rows: ConnectionRow[] } | { status: 'unavailable' }
}
