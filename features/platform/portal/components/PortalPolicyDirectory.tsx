import { randomUUID } from 'node:crypto'
import { FormSelect } from '@/components/ui/form-select'
import Link from 'next/link'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { PortalGrantForm, PortalPolicyForm } from './PortalPolicyForms'

export type PortalDirectoryParams = { search?: string; status?: string; page?: number; matterId?: string; portalAccountId?: string }
type Grant = { id: string; status: string; version: number; policyRevision: number; canReadDocuments: boolean; canUploadDocuments: boolean; canReadInvoices: boolean; canReadMessages: boolean; expiresAt: string | null }
type Workspace = {
  state: string; policy: { revision: number; mode: string; statuses: string[] } | null;
  policyHistory: { revision: number; mode: string; statuses: string[]; admission: string }[];
  latestRevision: number; latestChoice: string; latestAdmission: string; canConfigure: boolean; canManage: boolean;
  total: number; page: number; hasNext: boolean;
  items: { id: string; matterNumber: string; status: string }[]; accounts: { id: string; contactId: string }[];
  selection: { id: string; matterNumber: string; status: string } | null;
  grants: Grant[]; history: { id: string; operation: string; policyRevision: number; resultVersion: number; completedAt: string }[];
}
const query = `query($search: String, $status: String, $page: Int, $matterId: ID, $portalAccountId: ID) {
  portalPolicyWorkspace(search: $search, status: $status, page: $page, matterId: $matterId, portalAccountId: $portalAccountId) {
    state latestRevision latestChoice latestAdmission canConfigure canManage policy { revision mode statuses } policyHistory { revision mode statuses admission }
    total page hasNext items { id matterNumber status } accounts { id contactId } selection { id matterNumber status }
    grants { id status version policyRevision canReadDocuments canUploadDocuments canReadInvoices canReadMessages expiresAt }
    history { id operation policyRevision resultVersion completedAt }
  }
}`

type AccountLabel = { id: string; status: string; email: string; contact: { id: string; displayName: string } | null }
const accountLabelQuery = `query PortalAccountLabels($ids: [ID!]!) { portalAccounts(where: { id: { in: $ids } }, take: 13) { id status email contact { id displayName } } }`

// Readable identities for the preview and for an exact off-preview selection. These are
// session-scoped list reads (portal-read authority already gates this directory); when an
// identity is not readable the raw reference is shown instead, without widening access.
async function loadAccountLabels(ids: string[]) {
  if (!ids.length) return new Map<string, AccountLabel>()
  const response = await keystoneClient<{ portalAccounts: AccountLabel[] }>(accountLabelQuery, { ids })
  return new Map((response.success ? response.data.portalAccounts : []).map((account) => [account.id, account]))
}

const accountLabel = (account: AccountLabel | undefined, id: string) =>
  account ? `${account.contact?.displayName ?? account.email} · ${account.email}` : `Account ${id} (identity restricted)`

export async function PortalPolicyDirectory({ params = {} }: { params?: PortalDirectoryParams }) {
  const response = await keystoneClient<{ portalPolicyWorkspace: Workspace }>(query, { ...params, status: params.status || null, matterId: params.matterId || null, portalAccountId: params.portalAccountId || null })
  if (!response.success) return <section id="portal-policy" className="border p-4" role="alert">The client access directory could not be loaded, so no access was granted. Invitations and revocations below still work.</section>
  const data = response.data.portalPolicyWorkspace
  const selectedId = params.portalAccountId?.trim().slice(0, 200) || ''
  const labels = await loadAccountLabels([...new Set([...data.accounts.map((item) => item.id), ...(selectedId ? [selectedId] : [])])])
  const previewAccount = data.accounts.find((item) => item.id === selectedId)
  const exactAccount = labels.get(selectedId)
  // An off-preview account is usable only when its exact readback is active and bound to
  // a contact; the grant command rechecks account, contact and eligibility regardless.
  const account = previewAccount ?? (exactAccount?.status === 'active' && exactAccount.contact ? { id: exactAccount.id, contactId: exactAccount.contact.id } : undefined)
  const latest = data.grants[0]
  const href = (changes: PortalDirectoryParams) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...params, ...changes })) if (value) search.set(key, String(value))
    return `/dashboard/platform/portal?${search}#portal-policy`
  }
  return <section id="portal-policy" className="space-y-6 border-y py-6">
    <h2 className="text-lg font-semibold">Client matter access</h2>
    <p>Current access policy: {data.policy ? `revision ${data.policy.revision} — clients can be given access to ${data.policy.statuses.map((status) => status.replaceAll('_', ' ')).join(', ')} matters` : 'not set, so no new access can be granted'}. Latest recorded choice: {data.latestChoice.replaceAll('_', ' ')} ({data.latestAdmission.replaceAll('_', ' ')}, revision {data.latestRevision}). Grants made before any policy existed are shown as legacy and were not approved by a later policy.</p>
    <details><summary>Policy history (latest twelve revisions)</summary><ul>{data.policyHistory.map((policy) => <li key={policy.revision}>Revision {policy.revision}: {policy.mode}, {policy.statuses.join(', ')}, {policy.admission}</li>)}</ul></details>
    {data.canConfigure ? <PortalPolicyForm revision={data.latestRevision} /> : <p>Recording policy requires current human firm-configuration authority.</p>}
    {data.state !== 'ready' ? <p role="note">{data.state === 'matter_read_denied' ? 'Matter discovery requires actual Matter-read permission; portal management does not imply it.' : data.state === 'portal_read_denied' ? 'Portal-read authority is required for the directory. Firm configuration does not imply portal discovery.' : 'Admit an explicit conservative policy before discovering grantable targets.'}</p> : <>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label>Matter number search<input name="search" defaultValue={params.search} maxLength={100} className="block min-h-10 rounded-md border p-2" /></label>
        <label>Grantable status<FormSelect name="status" defaultValue={params.status ?? ''} className="block min-h-10 rounded-md border p-2"><option value="">All admitted statuses</option>{data.policy?.statuses.map((status) => <option key={status}>{status}</option>)}</FormSelect></label>
        <div className="min-w-64"><SearchableOptionSelect id="portal-directory-account" name="portalAccountId" label="Client account" emptyLabel="Choose…" kind="portalAccount" options={[...new Map([...data.accounts.map((item) => ({ value: item.id, label: accountLabel(labels.get(item.id), item.id) })), ...(selectedId && exactAccount ? [{ value: selectedId, label: accountLabel(exactAccount, selectedId) }] : [])].map((option) => [option.value, option])).values()]} /></div>
        <button className="min-h-10 rounded-md border px-4">Search / select account</button>
      </form>
      <p className="text-sm">{data.items.length} shown of {data.total} matters whose status the current policy allows, within your matter access. Search for any client account by email; the grant is checked again against the account, contact and policy when it is recorded.</p>
      {!data.items.length ? <p>No authorized policy-status matches on this page.</p> : <ul className="divide-y">{data.items.map((matter) => <li key={matter.id} className="py-3"><Link className="underline" href={href({ matterId: matter.id })}>{matter.matterNumber}</Link> · {matter.status} · readable and policy-status eligible, not a completed grant</li>)}</ul>}
      <nav aria-label="Portal Matter directory pages" className="flex gap-4">{data.page > 1 ? <Link href={href({ page: data.page - 1 })}>Previous</Link> : null}<span>Page {data.page}</span>{data.hasNext ? <Link href={href({ page: data.page + 1 })}>Next</Link> : null}</nav>
      {params.matterId && account && data.policy ? <>
        <h3 className="font-semibold">Owned target readback</h3>
        <p>{accountLabel(exactAccount ?? labels.get(account.id), account.id)} → {data.selection?.matterNumber} · {data.selection?.status} · {data.selection && data.policy.statuses.includes(data.selection.status) ? 'status allowed by the current policy' : 'readable but not currently grantable; revocation remains separate'}</p>
        {data.grants.length ? <ul>{data.grants.map((grant) => <li key={grant.id} className="break-all py-2">Grant {grant.id}: {grant.status}, version {grant.version}, {grant.policyRevision ? `policy ${grant.policyRevision}` : 'legacy revision 0'}; documents {String(grant.canReadDocuments)}, uploads {String(grant.canUploadDocuments)}, invoices {String(grant.canReadInvoices)}, messages {String(grant.canReadMessages)}; expires {grant.expiresAt ?? 'not set'}.</li>)}</ul> : <p>No grant in current target scope.</p>}
        {data.canManage ? <div className="grid gap-4 lg:grid-cols-2">
          {data.selection && data.policy.statuses.includes(data.selection.status) ? <PortalGrantForm key={`grant-${latest?.id ?? 'new'}-${latest?.version ?? 0}`} accountLabel={accountLabel(exactAccount ?? labels.get(account.id), account.id)} matterLabel={data.selection?.matterNumber ?? params.matterId} operation="grant" intentKey={randomUUID()} policyRevision={data.policy.revision} expectedVersion={latest?.version ?? 0} portalAccountId={account.id} contactId={account.contactId} matterId={params.matterId} grantId={latest?.id ?? null} /> : null}
          {latest && ['active', 'expired'].includes(latest.status) ? <PortalGrantForm key={`revoke-${latest.id}-${latest.version}`} accountLabel={accountLabel(exactAccount ?? labels.get(account.id), account.id)} matterLabel={data.selection?.matterNumber ?? params.matterId} operation="revoke" intentKey={randomUUID()} policyRevision={data.policy.revision} expectedVersion={latest.version} portalAccountId={account.id} contactId={account.contactId} matterId={params.matterId} grantId={latest.id} /> : null}
        </div> : <p>Current portal-management authority is required to execute.</p>}
        <h3 className="font-semibold">Your durable intent history / recovery</h3>
        <p className="text-sm">Your latest twelve completed access changes for this client and matter (the full record is in the audit log). If a request went unanswered, submit the same form again or reload this list; a change in your authority or the policy stops a repeat, and past records are kept.</p>
        {data.history.length ? <ul>{data.history.map((item) => <li key={item.id} className="break-all py-2">{item.id}: {item.operation}, policy {item.policyRevision}, result version {item.resultVersion}, {item.completedAt}</li>)}</ul> : <p>No completed owned intent visible for this selection.</p>}
      </> : <p>{selectedId && !account ? 'That client account is not active or its contact is not readable, so no grant can be recorded for it.' : 'Choose a matter and an active client account to review grants.'}</p>}
    </>}
  </section>
}
