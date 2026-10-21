'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { useFormStatus } from 'react-dom'
import { policyPortal } from '../actions/policyPortal'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="min-h-10 rounded-md border px-4 focus-visible:ring-2 disabled:opacity-50">{pending ? 'Working…' : label}</button>
}
const field = 'block min-h-10 w-full rounded-md border bg-background p-2 focus-visible:ring-2'

export function PortalPolicyForm({ revision }: { revision: number }) {
  const [state, action] = useActionState(policyPortal, { ok: false, message: '' })
  return <form action={action} className="space-y-4 border p-4">
    <h3 className="font-semibold">Record policy revision</h3>
    <input type="hidden" name="operation" value="policy" /><input type="hidden" name="expectedRevision" value={revision} />
    <label className="block">Discovery choice<FormSelect className={field} name="mode">
      <option value="read_intersection">Matter-read + materialized AND live team/wall (admitted)</option>
      <option value="manager_discovery_review">Portal-manager-only discovery (review only)</option>
      <option value="live_team_only_review">Live team without materialized access (review only)</option>
    </FormSelect></label>
    <fieldset><legend>Explicit grantable statuses</legend>{[['open', 'Open'], ['on_hold', 'On hold'], ['closing', 'Closing'], ['proposed', 'Proposed (review only)'], ['pending_conflict', 'Pending conflict (review only)'], ['closed', 'Closed (review only)'], ['declined', 'Declined (review only)']].map(([value, label]) => <label key={value} className="mr-4 inline-flex gap-2"><input type="checkbox" name="statuses" value={value} defaultChecked={value === 'open'} />{label}</label>)}</fieldset>
    <label className="block">Review reason<textarea className={field} required name="reason" minLength={5} maxLength={2000} /></label>
    <Submit label="Record new revision" />
    {state.message ? <p role="status">{state.message}</p> : null}
  </form>
}

export function PortalGrantForm({ operation, intentKey, policyRevision, expectedVersion, portalAccountId, contactId, matterId, grantId, accountLabel, matterLabel }: {
  operation: 'grant' | 'revoke'; intentKey: string; policyRevision: number; expectedVersion: number; portalAccountId: string; contactId: string; matterId: string; grantId: string | null; accountLabel: string; matterLabel: string
}) {
  const [state, action] = useActionState(policyPortal, { ok: false, message: '' })
  // The operation reference stays fixed while this form is open so a retry replays the
  // same intent; a new intent is started only by an explicit choice.
  const [operationKey, setOperationKey] = useState(intentKey)
  return <form action={action} className="space-y-4 border p-4">
    <h3 className="font-semibold">{operation === 'grant' ? 'Grant exact capabilities / replace grant' : 'Revoke exact grant and shares'}</h3>
    <p className="text-sm">Target: {accountLabel} on matter {matterLabel}. Policy {policyRevision}, expected grant version {expectedVersion}. Replacing a grant retires the original and its shares; shares are not carried forward.</p>
    {Object.entries({ operation, policyRevision, expectedVersion, portalAccountId, contactId, matterId, grantId: grantId ?? '' }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <input type="hidden" name="idempotencyKey" value={operationKey} />
    <p className="text-xs text-muted-foreground">Operation reference <span className="break-all font-mono">{operationKey}</span>. Submitting again after an unanswered request safely repeats this same operation. <button type="button" className="underline" onClick={() => setOperationKey(crypto.randomUUID())}>Start a new operation</button></p>
    {operation === 'grant' ? <fieldset><legend>Explicit capabilities</legend>{[['documents','Documents'],['uploads','Uploads'],['invoices','Invoices'],['messages','Messages']].map(([name,label]) => <label key={name} className="mr-4 inline-flex gap-2"><input name={name} type="checkbox" />{label}</label>)}</fieldset> : null}
    <label className="block">Reason<textarea className={field} name="reason" required minLength={5} maxLength={2000} /></label>
    <Submit label={operation === 'grant' ? 'Record grant intent' : 'Record revoke intent'} />
    {state.message ? <p role="status">{state.message}</p> : null}
  </form>
}
