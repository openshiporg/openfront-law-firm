import { randomUUID } from 'node:crypto'
import { FormSelect } from '@/components/ui/form-select'
import Link from 'next/link'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { cn } from '@/lib/utils'
import {
  EmptyState,
  ErrorBanner,
  Meta,
  MetaGrid,
  Notice,
  Pager,
  Panel,
  RowList,
  SectionHeader,
  TitleLine,
  Track,
  fieldClass,
  labelClass,
  pillPrimaryClass,
} from '@/features/platform/components/ui'
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
  if (!response.success) return <section id="portal-policy" className="scroll-mt-20"><ErrorBanner title="Client access directory unavailable">No access was granted. Invitations and revocations still work.</ErrorBanner></section>
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
  const yesNo = (value: boolean) => value ? 'Yes' : 'No'
  const selectionGrantable = Boolean(data.selection && data.policy?.statuses.includes(data.selection.status))
  return <section id="portal-policy" aria-labelledby="portal-policy-title" className="min-w-0 scroll-mt-20 space-y-5">
    <SectionHeader id="portal-policy-title" title="Client matter access" />
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <MetaGrid>
        <Meta label="Current policy">{data.policy ? <span className="tabular-nums">Revision {data.policy.revision}</span> : <span className="text-destructive">Not set; no new access can be granted</span>}</Meta>
        <Meta label="Grantable statuses">{data.policy ? data.policy.statuses.map((status) => status.replaceAll('_', ' ')).join(', ') : '—'}</Meta>
        <Meta label="Latest recorded choice">{data.latestChoice.replaceAll('_', ' ')}</Meta>
        <Meta label="Admission"><span className="tabular-nums">{data.latestAdmission.replaceAll('_', ' ')} · rev. {data.latestRevision}</span></Meta>
      </MetaGrid>
      <Notice className="mt-4">Grants made before any policy existed show as legacy (revision 0).</Notice>
      <details className="group mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span> policy history · last 12</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm tabular-nums">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Revision</th><th className="py-2 pr-3 font-medium">Mode</th><th className="py-2 pr-3 font-medium">Statuses</th><th className="py-2 font-medium">Admission</th></tr></thead>
            <tbody className="divide-y divide-border">{data.policyHistory.map((policy) => <tr key={policy.revision}><td className="py-2 pr-3 font-medium">{policy.revision}</td><td className="py-2 pr-3 text-muted-foreground">{policy.mode}</td><td className="py-2 pr-3 text-muted-foreground">{policy.statuses.join(', ')}</td><td className="py-2 text-muted-foreground">{policy.admission}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
    {data.canConfigure ? <PortalPolicyForm revision={data.latestRevision} /> : <Notice>Recording policy requires current human firm-configuration authority.</Notice>}
    {data.state !== 'ready' ? <Notice>{data.state === 'matter_read_denied' ? 'Matter discovery requires Matter-read permission; portal management does not imply it.' : data.state === 'portal_read_denied' ? 'Directory requires portal-read authority; firm configuration does not imply it.' : 'Admit an explicit policy before discovering grantable targets.'}</Notice> : <>
      <form method="get" className="grid min-w-0 gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
        <label className={labelClass}>Matter number<input name="search" type="search" defaultValue={params.search} maxLength={100} className={fieldClass} /></label>
        <label className={labelClass}>Grantable status<FormSelect name="status" defaultValue={params.status ?? ''} className={fieldClass}><option value="">All admitted statuses</option>{data.policy?.statuses.map((status) => <option key={status}>{status}</option>)}</FormSelect></label>
        <div className="min-w-0"><SearchableOptionSelect id="portal-directory-account" name="portalAccountId" label="Client account" emptyLabel="Choose…" kind="portalAccount" options={[...new Map([...data.accounts.map((item) => ({ value: item.id, label: accountLabel(labels.get(item.id), item.id) })), ...(selectedId && exactAccount ? [{ value: selectedId, label: accountLabel(exactAccount, selectedId) }] : [])].map((option) => [option.value, option])).values()]} /></div>
        <Track className="justify-self-start"><button className={pillPrimaryClass}>Search</button></Track>
      </form>
      <div className="space-y-3">
        <SectionHeader title="Eligible matters" count={data.total} />
        {!data.items.length ? <EmptyState title="No policy-eligible matters on this page." /> : <RowList label="Policy-eligible matters">{data.items.map((matter) => <li key={matter.id} className={cn('flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3', params.matterId === matter.id && 'bg-muted/50')}>
          <TitleLine as="p" status={matter.status} headingClassName="text-sm"><Link className="underline-offset-4 hover:underline" href={href({ matterId: matter.id })}>{matter.matterNumber}</Link></TitleLine>
          <span className="text-xs text-muted-foreground">Eligible · not a grant</span>
        </li>)}</RowList>}
        <Pager label="Portal Matter directory pages" summary={`${data.items.length} shown of ${data.total} · page ${data.page}`} previous={data.page > 1 ? href({ page: data.page - 1 }) : null} next={data.hasNext ? href({ page: data.page + 1 }) : null} />
      </div>
      {params.matterId && account && data.policy ? <>
        <Panel title={<h3 className="text-sm font-semibold text-foreground">Selected target</h3>}>
          <TitleLine as="p" status={data.selection?.status} headingClassName="text-sm">{data.selection?.matterNumber}</TitleLine>
          <p className="mt-1 break-words text-sm text-muted-foreground">{accountLabel(exactAccount ?? labels.get(account.id), account.id)}</p>
          <p className={cn('mt-1 text-xs', selectionGrantable ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400')}>{selectionGrantable ? 'Status allowed by current policy' : 'Readable but not grantable; revocation is separate'}</p>
        </Panel>
        <div className="space-y-3">
          <SectionHeader title="Grants" count={data.grants.length} />
          {data.grants.length ? <RowList label="Grants">{data.grants.map((grant) => <li key={grant.id} className="min-w-0 space-y-3 px-4 py-3">
            <TitleLine as="p" status={grant.status} headingClassName="text-sm tabular-nums">Version {grant.version} · {grant.policyRevision ? `policy ${grant.policyRevision}` : 'legacy rev. 0'}</TitleLine>
            <MetaGrid className="grid-cols-2 sm:grid-cols-5 lg:grid-cols-5">
              <Meta label="Documents">{yesNo(grant.canReadDocuments)}</Meta>
              <Meta label="Uploads">{yesNo(grant.canUploadDocuments)}</Meta>
              <Meta label="Invoices">{yesNo(grant.canReadInvoices)}</Meta>
              <Meta label="Messages">{yesNo(grant.canReadMessages)}</Meta>
              <Meta label="Expires">{grant.expiresAt ?? 'Not set'}</Meta>
            </MetaGrid>
            <p className="break-all font-mono text-xs text-muted-foreground">{grant.id}</p>
          </li>)}</RowList> : <EmptyState title="No grant in current target scope." />}
        </div>
        {data.canManage ? <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {data.selection && data.policy.statuses.includes(data.selection.status) ? <PortalGrantForm key={`grant-${latest?.id ?? 'new'}-${latest?.version ?? 0}`} accountLabel={accountLabel(exactAccount ?? labels.get(account.id), account.id)} matterLabel={data.selection?.matterNumber ?? params.matterId} operation="grant" intentKey={randomUUID()} policyRevision={data.policy.revision} expectedVersion={latest?.version ?? 0} portalAccountId={account.id} contactId={account.contactId} matterId={params.matterId} grantId={latest?.id ?? null} /> : null}
          {latest && ['active', 'expired'].includes(latest.status) ? <PortalGrantForm key={`revoke-${latest.id}-${latest.version}`} accountLabel={accountLabel(exactAccount ?? labels.get(account.id), account.id)} matterLabel={data.selection?.matterNumber ?? params.matterId} operation="revoke" intentKey={randomUUID()} policyRevision={data.policy.revision} expectedVersion={latest.version} portalAccountId={account.id} contactId={account.contactId} matterId={params.matterId} grantId={latest.id} /> : null}
        </div> : <Notice>Current portal-management authority is required to execute.</Notice>}
        <div className="space-y-3">
          <SectionHeader title="Your access changes" count={data.history.length} />
          <Notice>Unanswered request: resubmit the same form or reload. Authority or policy changes stop a repeat. Last 12 shown; full record in the audit log.</Notice>
          {data.history.length ? <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[36rem] text-sm tabular-nums">
              <thead className="border-b border-border bg-muted/40"><tr className="text-left text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Operation</th><th className="px-3 py-2 text-right font-medium">Policy</th><th className="px-3 py-2 text-right font-medium">Result ver.</th><th className="px-3 py-2 font-medium">Completed</th><th className="px-3 py-2 font-medium">Reference</th></tr></thead>
              <tbody className="divide-y divide-border">{data.history.map((item) => <tr key={item.id}><td className="px-3 py-2 font-medium">{item.operation}</td><td className="px-3 py-2 text-right">{item.policyRevision}</td><td className="px-3 py-2 text-right">{item.resultVersion}</td><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{item.completedAt}</td><td className="max-w-[14rem] truncate px-3 py-2 font-mono text-xs text-muted-foreground">{item.id}</td></tr>)}</tbody>
            </table>
          </div> : <EmptyState title="No completed changes for this selection." />}
        </div>
      </> : <Notice>{selectedId && !account ? 'That client account is not active or its contact is not readable; no grant can be recorded.' : 'Choose a matter and an active client account to review grants.'}</Notice>}
    </>}
  </section>
}
