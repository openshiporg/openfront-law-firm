'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type ImportConnectionState = { ok: boolean; message: string }

const SPREADSHEET_PROVIDER = 'spreadsheet_csv'

/** Creates (or finishes activating) the firm's spreadsheet import connection. The
 * connection owns the source-ID map that stops the same row importing twice. Uses the
 * IntegrationConnection list create (integration-management access, firm-bound) and the
 * controlled transitionIntegrationConnection command for activation. */
export async function createSpreadsheetImportConnection(_previous: ImportConnectionState, _formData: FormData): Promise<ImportConnectionState> {
  const denied = { ok: false, message: 'The import connection could not be set up. This needs integration-management access.' }
  const existing = await keystoneClient<{ integrationConnections: Array<{ id: string; status: string }> }>(`
    query SpreadsheetImportConnection($provider: String!) {
      integrationConnections(where: { provider: { equals: $provider }, status: { in: [active, pending] } }, orderBy: [{ createdAt: asc }], take: 5) { id status }
    }
  `, { provider: SPREADSHEET_PROVIDER })
  if (!existing.success) return denied
  if (existing.data.integrationConnections.some((connection) => connection.status === 'active')) {
    revalidatePath('/dashboard/platform/data')
    return { ok: true, message: 'Spreadsheet import is ready.' }
  }
  let connectionId = existing.data.integrationConnections.find((connection) => connection.status === 'pending')?.id
  if (!connectionId) {
    const created = await keystoneClient<{ createIntegrationConnection: { id: string } | null }>(`
      mutation CreateSpreadsheetImportConnection($data: IntegrationConnectionCreateInput!) { createIntegrationConnection(data: $data) { id } }
    `, { data: { name: 'Spreadsheet import', provider: SPREADSHEET_PROVIDER, category: 'other' } })
    if (!created.success || !created.data.createIntegrationConnection?.id) return denied
    connectionId = created.data.createIntegrationConnection.id
  }
  const activated = await keystoneClient<{ transitionIntegrationConnection: { replayed: boolean } }>(`
    mutation ActivateSpreadsheetImportConnection($connectionId: ID!, $reason: String!) {
      transitionIntegrationConnection(connectionId: $connectionId, toStatus: "active", reason: $reason) { replayed }
    }
  `, { connectionId, reason: 'Set up spreadsheet contact import from the Data page.' })
  revalidatePath('/dashboard/platform/data')
  if (!activated.success) return denied
  return { ok: true, message: 'Spreadsheet import is ready.' }
}
