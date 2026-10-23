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
  return <form action={action} className={formClass}>
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">Record policy revision</h3>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">Next after rev. {revision}</span>
    </div>
    <input type="hidden" name="operation" value="policy" /><input type="hidden" name="expectedRevision" value={revision} />
    <label className={labelClass}>Discovery choice<FormSelect className={fieldClass} name="mode">
      <option value="read_intersection">Matter-read + materialized AND live team/wall (admitted)</option>
      <option value="manager_discovery_review">Portal-manager-only discovery (review only)</option>
      <option value="live_team_only_review">Live team without materialized access (review only)</option>
    </FormSelect></label>
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">Grantable statuses</legend>
      <div className="flex flex-wrap gap-2">
        {[['open', 'Open'], ['on_hold', 'On hold'], ['closing', 'Closing'], ['proposed', 'Proposed (review only)'], ['pending_conflict', 'Pending conflict (review only)'], ['closed', 'Closed (review only)'], ['declined', 'Declined (review only)']].map(([value, label]) => <label key={value} className={chipClass}><input type="checkbox" name="statuses" value={value} defaultChecked={value === 'open'} className="size-4 accent-foreground" />{label}</label>)}
      </div>
    </fieldset>
    <label className={labelClass}>Review reason<textarea className={textareaClass} required name="reason" minLength={5} maxLength={2000} /></label>
    <Track><Submit label="Record new revision" /></Track>
    <Message ok={state.ok} message={state.message} />
  </form>
}

export function PortalGrantForm({ operation, intentKey, policyRevision, expectedVersion, portalAccountId, contactId, matterId, grantId, accountLabel, matterLabel }: {
  operation: 'grant' | 'revoke'; intentKey: string; policyRevision: number; expectedVersion: number; portalAccountId: string; contactId: string; matterId: string; grantId: string | null; accountLabel: string; matterLabel: string
}) {
  const [state, action] = useActionState(policyPortal, { ok: false, message: '' })
  // The operation reference stays fixed while this form is open so a retry replays the
  // same intent; a new intent is started only by an explicit choice.
  const [operationKey, setOperationKey] = useState(intentKey)
  return <form action={action} className={formClass}>
    <h3 className="text-sm font-semibold text-foreground">{operation === 'grant' ? 'Grant or replace access' : 'Revoke grant and shares'}</h3>
    <MetaGrid className="sm:grid-cols-2 lg:grid-cols-2">
      <Meta label="Client account">{accountLabel}</Meta>
      <Meta label="Matter">{matterLabel}</Meta>
      <Meta label="Policy revision"><span className="tabular-nums">{policyRevision}</span></Meta>
      <Meta label="Expected grant version"><span className="tabular-nums">{expectedVersion}</span></Meta>
    </MetaGrid>
    {operation === 'grant' ? <p role="note" className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">Replacing a grant retires it and its shares; shares are not carried forward.</p> : null}
    {Object.entries({ operation, policyRevision, expectedVersion, portalAccountId, contactId, matterId, grantId: grantId ?? '' }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <input type="hidden" name="idempotencyKey" value={operationKey} />
    {operation === 'grant' ? <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">Capabilities</legend>
      <div className="flex flex-wrap gap-2">
        {[['documents','Documents'],['uploads','Uploads'],['invoices','Invoices'],['messages','Messages']].map(([name,label]) => <label key={name} className={chipClass}><input name={name} type="checkbox" className="size-4 accent-foreground" />{label}</label>)}
      </div>
    </fieldset> : null}
    <label className={labelClass}>Reason<textarea className={textareaClass} name="reason" required minLength={5} maxLength={2000} /></label>
    <div className="min-w-0 text-xs text-muted-foreground">
      <span>Operation ref </span><span className="break-all font-mono text-foreground">{operationKey}</span>
      <span> · resubmitting repeats this operation</span>
    </div>
    <Track>
      <Submit label={operation === 'grant' ? 'Record grant' : 'Record revoke'} danger={operation === 'revoke'} />
      <button type="button" className={pillClass} onClick={() => setOperationKey(crypto.randomUUID())}>New operation</button>
    </Track>
    <Message ok={state.ok} message={state.message} />
  </form>
}
