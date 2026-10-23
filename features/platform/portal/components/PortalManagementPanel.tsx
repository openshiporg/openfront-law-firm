'use client'

import type { ReactNode } from 'react'
import { useActionState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { useFormStatus } from 'react-dom'
import { KeyRound, Loader2, Share2, UserPlus, UserX } from 'lucide-react'

import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import type { PracticeOptionKind } from '@/features/platform/operations/lib/practiceOptions'
import {
  Panel,
  SectionHeader,
  Track,
  fieldClass,
  labelClass,
  pillClass,
  pillDangerClass,
  pillPrimaryClass,
  textareaClass,
} from '@/features/platform/components/ui'

import { managePortal } from '../actions/managePortal'
import type { PortalManagementState } from '../actions/types'

type Option = { id: string; title: string; subtitle: string; status: string }
type Resource = Option & { resourceType: 'document' | 'invoice' | 'communication_thread' }

const initialState: PortalManagementState = { ok: false, message: '', inviteToken: null }

function Submit({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus()
  return (
    <Track>
      <button type="submit" disabled={pending} className={tone === 'danger' ? pillDangerClass : pillPrimaryClass}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{pending ? 'Working…' : label}
      </button>
    </Track>
  )
}

function Select({ name, label, options, required = true, search }: { name: string; label: string; options: Array<Option & { value?: string }>; required?: boolean; search?: PracticeOptionKind }) {
  // Searchable lists reach records beyond the preview; values stay exact record ids.
  if (search) {
    return <SearchableOptionSelect id={`portal-${name}`} name={name} label={label} emptyLabel="Select…" required={required} kind={search} options={options.map((option) => ({ value: option.value ?? option.id, label: `${option.title} · ${option.subtitle}` }))} />
  }
  return (
    <label className={labelClass}>
      {label}
      <FormSelect name={name} required={required} className={fieldClass}>
        <option value="">Select…</option>
        {options.map((option) => <option key={option.value ?? option.id} value={option.value ?? option.id}>{option.title} · {option.subtitle}</option>)}
      </FormSelect>
    </label>
  )
}

function CardTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground"><span className="text-muted-foreground" aria-hidden="true">{icon}</span><span className="truncate">{children}</span></h3>
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
  const card = 'flex min-w-0 flex-col gap-4 bg-card p-4'

  return (
    <section aria-labelledby="portal-controls-title" className="min-w-0 space-y-4">
      <SectionHeader id="portal-controls-title" title="Client access controls" />

      <div className="grid min-w-0 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs md:grid-cols-2 xl:grid-cols-4">
        <form action={formAction} className={card}>
          <input type="hidden" name="operation" value="invite" />
          <CardTitle icon={<UserPlus className="size-4" />}>Invite or restore client</CardTitle>
          <Select name="contactId" label="Contact" options={contacts} search="contact" />
          {contactPreviewNote ? <p role="note" className="text-xs leading-5 text-muted-foreground">{contactPreviewNote}</p> : null}
          <label className={labelClass}>Email<input name="email" type="email" required maxLength={320} className={fieldClass} /></label>
          <div className="mt-auto"><Submit label="Create invitation" /></div>
        </form>

        <div className={card}>
          <CardTitle icon={<KeyRound className="size-4" />}>Matter access</CardTitle>
          <p className="text-xs text-muted-foreground">Policy, target, grant and history</p>
          <div className="mt-auto"><Track><a href="#portal-policy" className={pillClass}>Open matter access</a></Track></div>
        </div>

        <form action={formAction} className={card}>
          <input type="hidden" name="operation" value="share" />
          <CardTitle icon={<Share2 className="size-4" />}>Share resource</CardTitle>
          <Select name="accessId" label="Matter grant" options={grants} />
          <Select name="resource" label="Exact resource" options={resources.map((item) => ({ ...item, value: `${item.resourceType}:${item.id}` }))} />
          <div className="mt-auto"><Submit label="Share with client" /></div>
        </form>

        <form action={formAction} className={card}>
          <input type="hidden" name="operation" value="revoke" />
          <CardTitle icon={<UserX className="size-4" />}>Revoke access</CardTitle>
          <Select name="target" label="Account or share" options={targets} />
          <label className={labelClass}>Reason<textarea name="reason" required minLength={5} maxLength={2000} rows={3} className={textareaClass} /></label>
          <div className="mt-auto"><Submit label="Revoke access" tone="danger" /></div>
        </form>
      </div>

      {state.message ? <p role="status" className={state.ok ? 'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground' : 'rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'}>{state.message}</p> : null}
      {state.inviteToken ? (
        <Panel title="One-time client link">
          <a href={`/portal/accept?token=${encodeURIComponent(state.inviteToken)}`} className="block break-all font-mono text-xs leading-5 underline-offset-4 hover:underline">{`/portal/accept?token=${encodeURIComponent(state.inviteToken)}`}</a>
        </Panel>
      ) : null}
    </section>
  )
}
