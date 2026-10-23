'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Meta,
  MetaGrid,
  Track,
  fieldClass,
  labelClass,
  pillClass,
  pillDangerClass,
  pillPrimaryClass,
  textareaClass,
} from '@/features/platform/components/ui'
import { policyPortal } from '../actions/policyPortal'

function Submit({ label, danger = false }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} className={danger ? pillDangerClass : pillPrimaryClass}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? 'Working…' : label}
    </button>
  )
}

const chipClass = 'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground has-[:checked]:border-foreground/40 has-[:checked]:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50'
const formClass = 'min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs'

function Message({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null
  return <p role="status" className={cn('text-sm', ok ? 'text-foreground' : 'text-destructive')}>{message}</p>
}

export function PortalPolicyForm({ revision }: { revision: number }) {
  const [state, action] = useActionState(policyPortal, { ok: false, message: '' })
  return <details className="group rounded-xl border border-border bg-card shadow-xs" open={revision === 0}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
      {revision === 0 ? 'Set sharing rules' : 'Change sharing rules'}
      <span className="text-xs font-medium text-muted-foreground"><span className="group-open:hidden">Open</span><span className="hidden group-open:inline">Close</span></span>
    </summary>
    <form action={action} className="min-w-0 space-y-4 border-t border-border p-4">
      <input type="hidden" name="operation" value="policy" /><input type="hidden" name="expectedRevision" value={revision} />
      <label className={labelClass}>Who can share a matter<FormSelect className={fieldClass} name="mode">
        <option value="read_intersection">Staff who can open the matter and are on its team</option>
        <option value="manager_discovery_review">Portal managers only (preview, not enforced)</option>
        <option value="live_team_only_review">Current matter team only (preview, not enforced)</option>
      </FormSelect></label>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">Matters that can be shared</legend>
        <div className="flex flex-wrap gap-2">
          {[['open', 'Open'], ['on_hold', 'On hold'], ['closing', 'Closing'], ['proposed', 'Proposed (preview)'], ['pending_conflict', 'Pending conflict check (preview)'], ['closed', 'Closed (preview)'], ['declined', 'Declined (preview)']].map(([value, label]) => <label key={value} className={chipClass}><input type="checkbox" name="statuses" value={value} defaultChecked={value === 'open'} className="size-4 accent-foreground" />{label}</label>)}
        </div>
      </fieldset>
      <label className={labelClass}>Reason for change<textarea className={textareaClass} required name="reason" minLength={5} maxLength={2000} /></label>
      <Track><Submit label="Save sharing rules" /></Track>
      <Message ok={state.ok} message={state.message} />
    </form>
  </details>
}

export function PortalGrantForm({ operation, intentKey, policyRevision, expectedVersion, portalAccountId, contactId, matterId, grantId, accountLabel, matterLabel }: {
  operation: 'grant' | 'revoke'; intentKey: string; policyRevision: number; expectedVersion: number; portalAccountId: string; contactId: string; matterId: string; grantId: string | null; accountLabel: string; matterLabel: string
}) {
  const [state, action] = useActionState(policyPortal, { ok: false, message: '' })
  // The operation reference stays fixed while this form is open so a retry replays the
  // same intent; a new intent is started only by an explicit choice.
  const [operationKey, setOperationKey] = useState(intentKey)
  return <form action={action} className={formClass}>
    <h3 className="text-sm font-semibold text-foreground">{operation === 'grant' ? (grantId ? 'Change access' : 'Give access') : 'Remove access'}</h3>
    <MetaGrid className="sm:grid-cols-2 lg:grid-cols-2">
      <Meta label="Client">{accountLabel}</Meta>
      <Meta label="Matter">{matterLabel}</Meta>
    </MetaGrid>
    {operation === 'grant' && grantId ? <p role="note" className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">Changing access replaces the current access. Items already shared must be shared again.</p> : null}
    {operation === 'revoke' ? <p role="note" className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">The client loses this matter and every item shared from it.</p> : null}
    {Object.entries({ operation, policyRevision, expectedVersion, portalAccountId, contactId, matterId, grantId: grantId ?? '' }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <input type="hidden" name="idempotencyKey" value={operationKey} />
    {operation === 'grant' ? <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">What the client can see</legend>
      <div className="flex flex-wrap gap-2">
        {[['documents','Documents'],['uploads','Upload documents'],['invoices','Invoices'],['messages','Messages']].map(([name,label]) => <label key={name} className={chipClass}><input name={name} type="checkbox" className="size-4 accent-foreground" />{label}</label>)}
      </div>
    </fieldset> : null}
    <label className={labelClass}>Reason<textarea className={textareaClass} name="reason" required minLength={5} maxLength={2000} /></label>
    <Track>
      <Submit label={operation === 'grant' ? (grantId ? 'Save access' : 'Give access') : 'Remove access'} danger={operation === 'revoke'} />
    </Track>
    <details className="group text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none font-medium hover:text-foreground [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span> details</summary>
      <div className="mt-2 space-y-2">
        <p className="tabular-nums">Rules version {policyRevision} · access version {expectedVersion}</p>
        <p className="min-w-0">Reference <span className="break-all font-mono text-foreground">{operationKey}</span>. Submitting again repeats this same change.</p>
        <Track><button type="button" className={pillClass} onClick={() => setOperationKey(crypto.randomUUID())}>Start a new change</button></Track>
      </div>
    </details>
    <Message ok={state.ok} message={state.message} />
  </form>
}
