'use server'

import { revalidatePath } from 'next/cache'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type PolicyPortalState = { ok: boolean; message: string }
function required(form: FormData, name: string, max = 200) {
  const value = String(form.get(name) ?? '').trim()
  if (!value || value.length > max) throw new Error(`Check ${name}.`)
  return value
}
function integer(form: FormData, name: string) {
  const raw = required(form, name)
  if (!/^\d+$/.test(raw)) throw new Error(`Check ${name}.`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) throw new Error(`Check ${name}.`)
  return value
}
const policyMutation = `mutation($expectedRevision: Int!, $mode: String!, $statuses: [String!]!, $reason: String!) { recordPortalDiscoveryPolicy(expectedRevision: $expectedRevision, mode: $mode, statuses: $statuses, reason: $reason) { revision admission } }`
const commandMutation = `mutation($data: PortalGrantCommandInput!) { executePortalGrant(data: $data) { intentId replayed grant { id status version policyRevision } } }`

export async function policyPortal(_state: PolicyPortalState, form: FormData): Promise<PolicyPortalState> {
  try {
    if (required(form, 'operation') === 'policy') {
      const response = await keystoneClient<{ recordPortalDiscoveryPolicy: { revision: number; admission: string } }>(policyMutation, {
        expectedRevision: integer(form, 'expectedRevision'), mode: required(form, 'mode'), statuses: form.getAll('statuses').map(String), reason: required(form, 'reason', 2000),
      })
      if (!response.success) return { ok: false, message: 'Policy not acknowledged. Reload current revisions before retrying; no disclosure authority was inferred.' }
      revalidatePath('/dashboard/platform/portal')
      const result = response.data.recordPortalDiscoveryPolicy
      return { ok: true, message: `Revision ${result.revision}: ${result.admission}. Review-only choices do not replace the admitted policy.` }
    }
    const operation = required(form, 'operation')
    if (!['grant', 'revoke'].includes(operation)) throw new Error('Unsupported operation.')
    const data = {
      operation, idempotencyKey: required(form, 'idempotencyKey'), policyRevision: integer(form, 'policyRevision'), expectedVersion: integer(form, 'expectedVersion'),
      portalAccountId: required(form, 'portalAccountId'), contactId: required(form, 'contactId'), matterId: required(form, 'matterId'), grantId: String(form.get('grantId') ?? '') || null,
      canReadDocuments: form.get('documents') === 'on', canUploadDocuments: form.get('uploads') === 'on', canReadInvoices: form.get('invoices') === 'on', canReadMessages: form.get('messages') === 'on',
      reason: required(form, 'reason', 2000),
    }
    const response = await keystoneClient<{ executePortalGrant: { intentId: string; replayed: boolean; grant: { id: string; status: string; version: number } } }>(commandMutation, { data })
    if (!response.success) return { ok: false, message: 'Not acknowledged. Keep the same key and exact inputs for recovery; inspect current grant/history before creating a different intent.' }
    revalidatePath('/dashboard/platform/portal')
    const result = response.data.executePortalGrant
    return { ok: true, message: `${result.replayed ? 'Recovered' : 'Recorded'} intent ${result.intentId}: grant ${result.grant.id}, ${result.grant.status}, version ${result.grant.version}. Reload selection to inspect current readback/history before the next intent.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Check the submitted intent.' }
  }
}
