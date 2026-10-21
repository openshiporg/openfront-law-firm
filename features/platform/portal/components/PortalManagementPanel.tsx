'use client'

import { useActionState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { useFormStatus } from 'react-dom'
import { KeyRound, Loader2, Share2, ShieldCheck, UserPlus, UserX } from 'lucide-react'

import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import type { PracticeOptionKind } from '@/features/platform/operations/lib/practiceOptions'

import { managePortal } from '../actions/managePortal'
import type { PortalManagementState } from '../actions/types'

type Option = { id: string; title: string; subtitle: string; status: string }
type Resource = Option & { resourceType: 'document' | 'invoice' | 'communication_thread' }

const initialState: PortalManagementState = { ok: false, message: '', inviteToken: null }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? 'Working…' : label}
    </button>
  )
}

function Select({ name, label, options, required = true, search }: { name: string; label: string; options: Array<Option & { value?: string }>; required?: boolean; search?: PracticeOptionKind }) {
  // Searchable lists reach records beyond the preview; values stay exact record ids.
  if (search) {
    return <SearchableOptionSelect id={`portal-${name}`} name={name} label={label} emptyLabel="Select…" required={required} kind={search} options={options.map((option) => ({ value: option.value ?? option.id, label: `${option.title} · ${option.subtitle}` }))} />
  }
  return (
    <label className="block text-xs font-semibold text-foreground">
      {label}
      <FormSelect name={name} required={required} className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">Select…</option>
        {options.map((option) => <option key={option.value ?? option.id} value={option.value ?? option.id}>{option.title} · {option.subtitle}</option>)}
      </FormSelect>
    </label>
  )
}

export function PortalManagementPanel({
  contacts,
  contactPreviewNote,
  accounts,
  grants,
  shares,
  resources,
}: {
  contacts: Option[]
  contactPreviewNote?: string
  accounts: Option[]
  matters: Option[]
  grants: Option[]
  shares: Option[]
  resources: Resource[]
}) {
  const [state, formAction] = useActionState(managePortal, initialState)
  const targets = [
    ...accounts.map((item) => ({ ...item, value: `account:${item.id}` })),
    ...shares.map((item) => ({ ...item, value: `share:${item.id}` })),
  ]

  return (
    <section aria-labelledby="portal-controls-title" className="border-y border-border bg-muted/20 py-6">
      <div className="px-1 sm:px-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div><h2 id="portal-controls-title" className="text-base font-bold">Client access controls</h2></div>
        </div>

        <div className="mt-6 grid gap-px border border-border bg-border lg:grid-cols-2 xl:grid-cols-4">
          <form action={formAction} className="space-y-4 bg-background p-4">
            <input type="hidden" name="operation" value="invite" />
            <h3 className="flex items-center gap-2 text-sm font-bold"><UserPlus className="size-4" /> Invite or restore client</h3>
            <Select name="contactId" label="Contact" options={contacts} search="contact" />
            {contactPreviewNote ? <p role="note" className="text-xs leading-5 text-muted-foreground">{contactPreviewNote}</p> : null}
            <label className="block text-xs font-semibold">Email<input name="email" type="email" required maxLength={320} className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <Submit label="Create invitation" />
          </form>

          <div className="space-y-4 bg-background p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4" /> Versioned matter access</h3>
            <a href="#portal-policy" className="underline">Review discovery policy, exact target, grant and history</a>
          </div>

          <form action={formAction} className="space-y-4 bg-background p-4">
            <input type="hidden" name="operation" value="share" />
            <h3 className="flex items-center gap-2 text-sm font-bold"><Share2 className="size-4" /> Share resource</h3>
            <Select name="accessId" label="Matter grant" options={grants} />
            <Select name="resource" label="Exact resource" options={resources.map((item) => ({ ...item, value: `${item.resourceType}:${item.id}` }))} />
            <Submit label="Share with client" />
          </form>

          <form action={formAction} className="space-y-4 bg-background p-4">
            <input type="hidden" name="operation" value="revoke" />
            <h3 className="flex items-center gap-2 text-sm font-bold"><UserX className="size-4" /> Revoke access</h3>
            <Select name="target" label="Account or share" options={targets} />
            <label className="block text-xs font-semibold">Reason<textarea name="reason" required minLength={5} maxLength={2000} rows={3} className="mt-2 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <Submit label="Revoke access" />
          </form>
        </div>

        {state.message ? <p role="status" className={`mt-4 text-sm ${state.ok ? 'text-foreground' : 'text-destructive'}`}>{state.message}</p> : null}
        {state.inviteToken ? (
          <div className="mt-4 border border-border bg-background p-4">
            <p className="text-xs font-semibold">One-time client link</p>
            <a href={`/portal/accept?token=${encodeURIComponent(state.inviteToken)}`} className="mt-2 block break-all font-mono text-xs leading-5 underline-offset-4 hover:underline">{`/portal/accept?token=${encodeURIComponent(state.inviteToken)}`}</a>
          </div>
        ) : null}
      </div>
    </section>
  )
}
