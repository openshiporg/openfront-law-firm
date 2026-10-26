'use client'

import type { ReactNode } from 'react'
import { useActionState, useState } from 'react'
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

import { EmailDeliveryStatus } from '@/features/platform/integrations/components/EmailDeliveryStatus'

import { managePortal } from '../actions/managePortal'
import type { PortalManagementState } from '../actions/types'
import { useKeptForm } from '../../components/useKeptForm'

type Option = { id: string; title: string; subtitle: string; status: string }
type Resource = Option & { resourceType: 'document' | 'invoice' | 'communication_thread' }

const initialState: PortalManagementState = { ok: false, message: '', inviteToken: null, invitationEmailed: null }

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
  emailConfigured,
}: {
  emailConfigured: boolean
  contacts: Option[]
  contactPreviewNote?: string
  accounts: Option[]
  matters: Option[]
  grants: Option[]
  shares: Option[]
  resources: Resource[]
}) {
  const [state, formAction] = useActionState(managePortal, initialState)
  const formActionForm = useKeptForm(formAction, state)
  const targets = [
    ...accounts.map((item) => ({ ...item, value: `account:${item.id}` })),
    ...shares.map((item) => ({ ...item, value: `share:${item.id}` })),
  ]
  const card = 'flex min-w-0 flex-col gap-4 bg-card p-4'
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitedToken, setInvitedToken] = useState(state.inviteToken)
  if (invitedToken !== state.inviteToken) {
    setInvitedToken(state.inviteToken)
    if (state.inviteToken) setInviteEmail('')
  }

  const acceptPath = state.inviteToken ? `/portal/accept?token=${encodeURIComponent(state.inviteToken)}` : ''
  const threadCount = resources.filter((item) => item.resourceType === 'communication_thread').length
  const resourceKind = { document: 'Document', invoice: 'Invoice', communication_thread: 'Conversation' } as const

  return (
    <section aria-labelledby="portal-controls-title" className="min-w-0 space-y-4">
      <SectionHeader id="portal-controls-title" title="Client portal" />
      <EmailDeliveryStatus configured={emailConfigured} context="portal" />

      <div className="grid min-w-0 gap-px overflow-hidden rounded-[6px] border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
        <form {...formActionForm} className={card}>
          <input type="hidden" name="operation" value="invite" />
          <CardTitle icon={<UserPlus className="size-4" />}>Invite a client</CardTitle>
          <SearchableOptionSelect
            id="portal-contactId"
            name="contactId"
            label="Contact"
            emptyLabel="Select…"
            required
            kind="contact"
            options={contacts.map((option) => ({ value: option.id, label: `${option.title} · ${option.subtitle}` }))}
            onOptionChange={(option) => setInviteEmail(option?.label.match(/[^\s·]+@[^\s·]+/)?.[0] ?? '')}
          />
          {contactPreviewNote ? <p role="note" className="text-xs leading-5 text-muted-foreground">{contactPreviewNote}</p> : null}
          <label className={labelClass}>Client email<input name="email" type="email" required maxLength={320} autoComplete="off" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={fieldClass} /></label>
          <div className="mt-auto"><Submit label={emailConfigured ? 'Send invitation' : 'Create invitation link'} /></div>
        </form>

        <div className={card}>
          <CardTitle icon={<KeyRound className="size-4" />}>Who can see this matter</CardTitle>
          <p className="text-xs text-muted-foreground">Choose a client and a matter, then pick what they can see.</p>
          <div className="mt-auto"><Track><a href="#portal-policy" className={pillClass}>Manage matter access</a></Track></div>
        </div>

        <form {...formActionForm} className={card}>
          <input type="hidden" name="operation" value="share" />
          <CardTitle icon={<Share2 className="size-4" />}>Share an item</CardTitle>
          <Select name="accessId" label="Client and matter" options={grants} />
          <Select name="resource" label="Item" options={resources.map((item) => ({ ...item, subtitle: `${resourceKind[item.resourceType]} · ${item.subtitle}`, value: `${item.resourceType}:${item.id}` }))} />
          {threadCount ? <p role="note" className="text-xs leading-5 text-muted-foreground">Clients see only sent and received messages. A conversation with none can’t be shared.</p> : null}
          <div className="mt-auto"><Submit label="Share with client" /></div>
        </form>

        <form {...formActionForm} className={card}>
          <input type="hidden" name="operation" value="revoke" />
          <CardTitle icon={<UserX className="size-4" />}>Remove access</CardTitle>
          <Select name="target" label="Client or shared item" options={targets} />
          <label className={labelClass}>Reason<textarea name="reason" required minLength={5} maxLength={2000} rows={3} className={textareaClass} /></label>
          <div className="mt-auto"><Submit label="Remove access" tone="danger" /></div>
        </form>
      </div>

      {state.message ? <p role="status" className={state.ok ? 'rounded-[4px] border border-border bg-card px-3 py-2 text-sm text-foreground' : 'rounded-[4px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'}>{state.message}</p> : null}
      {state.inviteToken ? (
        <Panel title={state.invitationEmailed ? 'Invitation link (backup)' : 'Invitation link'}>
          <a href={acceptPath} className="block break-all font-mono text-xs leading-5 underline-offset-4 hover:underline">{acceptPath}</a>
          <p className="mt-2 text-xs text-muted-foreground">Shown once. It can be used once.</p>
        </Panel>
      ) : null}
    </section>
  )
}
