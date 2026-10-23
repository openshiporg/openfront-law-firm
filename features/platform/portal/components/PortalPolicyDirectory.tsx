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
  pillClass,
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
  if (!response.success) return <section id="portal-policy" className="scroll-mt-20"><ErrorBanner title="Matter access unavailable">Couldn’t load matter access. Invitations and removals below still work.</ErrorBanner></section>
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
  const statusName = (status: string) => status.replaceAll('_', ' ')
  const selectionGrantable = Boolean(data.selection && data.policy?.statuses.includes(data.selection.status))
  const clientLabel = account ? accountLabel(exactAccount ?? labels.get(account.id), account.id) : ''
  const accessSummary = (grant: Grant) => [grant.canReadDocuments && 'documents', grant.canUploadDocuments && 'uploads', grant.canReadInvoices && 'invoices', grant.canReadMessages && 'messages'].filter(Boolean).join(', ') || 'nothing yet'
  return <section id="portal-policy" aria-labelledby="portal-policy-title" className="min-w-0 scroll-mt-20 space-y-5">
    <SectionHeader id="portal-policy-title" title="Who can see this matter" />
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <MetaGrid>
        <Meta label="Sharing rules">{data.policy ? 'Set' : <span className="text-destructive">Not set; set them below before giving access</span>}</Meta>
        <Meta label="Matters that can be shared">{data.policy ? data.policy.statuses.map(statusName).join(', ') : '—'}</Meta>
      </MetaGrid>
      <details className="group mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span> details</summary>
        <MetaGrid className="mt-3">
          <Meta label="Rules version"><span className="tabular-nums">{data.policy ? data.policy.revision : '—'}</span></Meta>
          <Meta label="Last change"><span className="tabular-nums">{statusName(data.latestChoice)} · {statusName(data.latestAdmission)} · v{data.latestRevision}</span></Meta>
        </MetaGrid>
        <p className="mt-3 text-xs text-muted-foreground">Access given before any rules existed shows as version 0.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm tabular-nums">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Version</th><th className="py-2 pr-3 font-medium">Rule</th><th className="py-2 pr-3 font-medium">Matters</th><th className="py-2 font-medium">Result</th></tr></thead>
            <tbody className="divide-y divide-border">{data.policyHistory.map((policy) => <tr key={policy.revision}><td className="py-2 pr-3 font-medium">{policy.revision}</td><td className="py-2 pr-3 text-muted-foreground">{statusName(policy.mode)}</td><td className="py-2 pr-3 text-muted-foreground">{policy.statuses.map(statusName).join(', ')}</td><td className="py-2 text-muted-foreground">{statusName(policy.admission)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
    {data.canConfigure ? <PortalPolicyForm revision={data.latestRevision} /> : null}
    {data.state !== 'ready' ? <Notice>{data.state === 'matter_read_denied' ? 'Your role can’t view matters, so it can’t give clients access to them.' : data.state === 'portal_read_denied' ? 'Your role can’t view client portal access.' : 'Set the sharing rules before giving clients access to matters.'}</Notice> : <>
      <form method="get" className="grid min-w-0 gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        {account ? <div className="grid min-w-0 gap-1.5"><span className="text-xs font-medium text-muted-foreground">Client</span><input type="hidden" name="portalAccountId" value={account.id} /><div className="flex min-h-10 min-w-0 items-center gap-2"><span className="min-w-0 truncate text-sm font-medium text-foreground">{clientLabel}</span><Link href="/dashboard/platform/portal#portal-policy" className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline">Change</Link></div></div> : <div className="min-w-0"><SearchableOptionSelect id="portal-directory-account" name="portalAccountId" label="Client" emptyLabel="Choose a client" kind="portalAccount" options={[...new Map([...data.accounts.map((item) => ({ value: item.id, label: accountLabel(labels.get(item.id), item.id) })), ...(selectedId && exactAccount ? [{ value: selectedId, label: accountLabel(exactAccount, selectedId) }] : [])].map((option) => [option.value, option])).values()]} /></div>}
        <label className={labelClass}>Matter number<input name="search" type="search" defaultValue={params.search} maxLength={100} className={fieldClass} /></label>
        <label className={labelClass}>Matter status<FormSelect name="status" defaultValue={params.status ?? ''} className={fieldClass}><option value="">Any shareable status</option>{data.policy?.statuses.map((status) => <option key={status} value={status}>{statusName(status)}</option>)}</FormSelect></label>
        <Track className="justify-self-start"><button className={pillPrimaryClass}>Find matters</button></Track>
      </form>
      <div className="space-y-3">
        <SectionHeader title="Matters you can share" count={data.total} />
        {!data.items.length ? <EmptyState title="No matching matters." /> : <RowList label="Matters you can share">{data.items.map((matter) => <li key={matter.id} className={cn('flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3', params.matterId === matter.id && 'bg-muted/50')}>
          <TitleLine as="p" status={matter.status} headingClassName="text-sm">{matter.matterNumber}</TitleLine>
          <Track><Link className={pillClass} href={href({ matterId: matter.id })}>{params.matterId === matter.id ? 'Selected' : account ? 'Manage access' : 'Select'}</Link></Track>
        </li>)}</RowList>}
        <Pager label="Matter pages" summary={`Page ${data.page}`} previous={data.page > 1 ? href({ page: data.page - 1 }) : null} next={data.hasNext ? href({ page: data.page + 1 }) : null} />
      </div>
      {params.matterId && account && data.policy ? <>
        <Panel title={<TitleLine as="h3" status={data.selection?.status} headingClassName="text-sm">{data.selection?.matterNumber ?? 'Matter'}</TitleLine>}>
          <p className="break-words text-sm text-muted-foreground">{clientLabel}</p>
          {latest ? <p className="mt-1 text-sm text-foreground">Current access: {latest.status === 'active' ? accessSummary(latest) : statusName(latest.status)}</p> : <p className="mt-1 text-sm text-muted-foreground">No access yet.</p>}
          {!selectionGrantable ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">This matter’s status can’t be shared under the current rules. You can still remove access.</p> : null}
        </Panel>
        {data.canManage ? <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {selectionGrantable ? <PortalGrantForm key={`grant-${latest?.id ?? 'new'}-${latest?.version ?? 0}`} accountLabel={clientLabel} matterLabel={data.selection?.matterNumber ?? params.matterId} operation="grant" intentKey={randomUUID()} policyRevision={data.policy.revision} expectedVersion={latest?.version ?? 0} portalAccountId={account.id} contactId={account.contactId} matterId={params.matterId} grantId={latest?.id ?? null} /> : null}
          {latest && ['active', 'expired'].includes(latest.status) ? <PortalGrantForm key={`revoke-${latest.id}-${latest.version}`} accountLabel={clientLabel} matterLabel={data.selection?.matterNumber ?? params.matterId} operation="revoke" intentKey={randomUUID()} policyRevision={data.policy.revision} expectedVersion={latest.version} portalAccountId={account.id} contactId={account.contactId} matterId={params.matterId} grantId={latest.id} /> : null}
        </div> : <Notice>Your role can view client access but can’t change it.</Notice>}
        <details className="group rounded-xl border border-border bg-card p-4 shadow-xs">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span> access history</summary>
          <div className="mt-3 space-y-3">
            {data.grants.length ? <RowList label="Access records">{data.grants.map((grant) => <li key={grant.id} className="min-w-0 space-y-3 px-4 py-3">
              <TitleLine as="p" status={grant.status} headingClassName="text-sm tabular-nums">Access v{grant.version}</TitleLine>
              <MetaGrid className="grid-cols-2 sm:grid-cols-5 lg:grid-cols-5">
                <Meta label="Documents">{yesNo(grant.canReadDocuments)}</Meta>
                <Meta label="Uploads">{yesNo(grant.canUploadDocuments)}</Meta>
                <Meta label="Invoices">{yesNo(grant.canReadInvoices)}</Meta>
                <Meta label="Messages">{yesNo(grant.canReadMessages)}</Meta>
                <Meta label="Expires">{grant.expiresAt ?? 'Never'}</Meta>
              </MetaGrid>
            </li>)}</RowList> : <EmptyState title="No access records for this client and matter." />}
            {data.history.length ? <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[30rem] text-sm tabular-nums">
                <thead className="border-b border-border bg-muted/40"><tr className="text-left text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Change</th><th className="px-3 py-2 text-right font-medium">Version</th><th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Reference</th></tr></thead>
                <tbody className="divide-y divide-border">{data.history.map((item) => <tr key={item.id}><td className="px-3 py-2 font-medium">{item.operation === 'grant' ? 'Access given' : item.operation === 'revoke' ? 'Access removed' : statusName(item.operation)}</td><td className="px-3 py-2 text-right">{item.resultVersion}</td><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{item.completedAt}</td><td className="max-w-[14rem] truncate px-3 py-2 font-mono text-xs text-muted-foreground">{item.id}</td></tr>)}</tbody>
              </table>
            </div> : null}
          </div>
        </details>
      </> : <Notice>{selectedId && !account ? 'That client’s portal account isn’t active, so you can’t give them access.' : 'Choose a client, then choose a matter to give or remove access.'}</Notice>}
    </>}
  </section>
}
