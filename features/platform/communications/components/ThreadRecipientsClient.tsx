'use client'

import { useState, useTransition } from 'react'
import { Plus, UserMinus } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { EmptyState, Panel, StatusDot, Track, fieldClass, labelClass, pillDangerClass, pillPrimaryClass, textareaClass, trackItemClass } from '@/features/platform/components/ui'
import { addParticipantAction, getContactEmailMethods, removeParticipantAction } from '../actions/recipients'
import type { ContactEmailMethod, ParticipantRow, ThreadRecipientSetup } from '../actions/recipientTypes'
import { ActionMessage, useRecipientAction } from './useRecipientAction'

type RecipientType = 'staff' | 'contact' | 'portal'
const TYPES: Array<[RecipientType, string]> = [['staff', 'Staff'], ['contact', 'Contact'], ['portal', 'Portal account']]
const ROLE_LABEL: Record<string, string> = { staff: 'Staff', client: 'Client', external_counsel: 'External counsel', third_party: 'Third party' }

export function participantName(participant: ParticipantRow) {
  return participant.user?.name || participant.contact?.displayName || participant.portalAccount?.email || participant.displayAddress || 'Recipient'
}

export function participantRole(participant: ParticipantRow) {
  return ROLE_LABEL[String(participant.participantRole)] ?? 'Recipient'
}

function AddForm({ threadId, onDone }: { threadId: string; onDone: () => void }) {
  const [state, action, pending] = useRecipientAction(addParticipantAction, onDone)
  const [type, setType] = useState<RecipientType>('staff')
  const [methods, setMethods] = useState<ContactEmailMethod[] | null>(null)
  const [loading, startLoading] = useTransition()
  function chooseContact(contactId: string) {
    setMethods(null)
    if (!contactId) return
    startLoading(async () => setMethods(await getContactEmailMethods(contactId)))
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="type" value={type} />
      <div className="grid gap-1.5 sm:col-span-2">
        <p className="text-xs font-medium text-muted-foreground">Add</p>
        <Track label="Recipient type">
          {TYPES.map(([value, label]) => <button key={value} type="button" onClick={() => setType(value)} aria-pressed={type === value} className={trackItemClass(type === value)}>{label}</button>)}
        </Track>
      </div>
      {type === 'staff' ? <div className="sm:col-span-2"><SearchableOptionSelect key="staff" id={`recipient-user-${threadId}`} name="userId" label="Staff member" kind="member" options={[]} required emptyLabel="Select…" /></div> : null}
      {type === 'portal' ? <div className="sm:col-span-2"><SearchableOptionSelect key="portal" id={`recipient-portal-${threadId}`} name="portalAccountId" label="Portal account" kind="portalAccount" options={[]} required emptyLabel="Select…" /></div> : null}
      {type === 'contact' ? <>
        <div className="sm:col-span-2"><SearchableOptionSelect key="contact" id={`recipient-contact-${threadId}`} name="contactId" label="Contact" kind="contact" options={[]} required emptyLabel="Select…" onValueChange={chooseContact} /></div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`recipient-role-${threadId}`} className="text-xs font-medium text-muted-foreground">Role</label>
          <FormSelect id={`recipient-role-${threadId}`} name="participantRole" defaultValue="client" required className={fieldClass}>
            <option value="client">Client</option>
            <option value="external_counsel">External counsel</option>
            <option value="third_party">Third party</option>
          </FormSelect>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`recipient-method-${threadId}`} className="text-xs font-medium text-muted-foreground">Email address</label>
          {methods?.length ? (
            <FormSelect key={methods.map((method) => method.id).join()} id={`recipient-method-${threadId}`} name="contactMethodId" defaultValue={methods[0].id} required className={fieldClass}>
              {methods.map((method) => <option key={method.id} value={method.id}>{method.value}{method.label ? ` · ${method.label}` : ''}{method.isPrimary ? ' · primary' : ''}</option>)}
            </FormSelect>
          ) : <p className="flex min-h-10 items-center text-sm text-muted-foreground">{loading ? 'Loading…' : methods ? 'No contactable email' : 'Choose a contact first'}</p>}
        </div>
      </> : null}
      {type === 'portal' ? <p className="text-xs text-muted-foreground sm:col-span-2">Joins as a client. The account needs a current portal share of this thread.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <ActionMessage state={state} />
        <Track><button type="submit" disabled={pending || (type === 'contact' && !methods?.length)} className={pillPrimaryClass}>{pending ? 'Adding…' : 'Add recipient'}</button></Track>
      </div>
    </form>
  )
}

function RemoveForm({ threadId, participant, onDone }: { threadId: string; participant: ParticipantRow; onDone: () => void }) {
  const [state, action, pending] = useRecipientAction(removeParticipantAction, onDone)
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="participantId" value={participant.id} />
      <label className={labelClass}>Reason for removing {participantName(participant)}<textarea name="reason" required minLength={5} maxLength={2000} rows={2} className={textareaClass} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActionMessage state={state} />
        <Track><button type="submit" disabled={pending} className={pillDangerClass}>{pending ? 'Removing…' : 'Remove recipient'}</button></Track>
      </div>
    </form>
  )
}

export function ThreadRecipientsClient({ threadId, setup }: { threadId: string; setup: ThreadRecipientSetup }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = () => setOpen(null)
  const canAdd = setup.threadStatus === 'open'
  const active = setup.participants.filter((participant) => participant.status === 'active')
  const removed = setup.participants.filter((participant) => participant.status !== 'active')
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Recipients<span className="font-mono text-xs font-normal text-muted-foreground">{active.length}</span></h2>}
      actions={canAdd ? <Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Add</button></Track> : null}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border p-4"><AddForm threadId={threadId} onDone={close} /></div> : null}
      {setup.participants.length ? (
        <ul className="divide-y divide-border">
          {[...active, ...removed].map((participant) => {
            const isActive = participant.status === 'active'
            return (
              <li key={participant.id} className="min-w-0">
                <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn('flex min-w-0 items-center gap-2 text-sm font-semibold', !isActive && 'text-muted-foreground')}><StatusDot tone={isActive ? 'emerald' : 'zinc'} /><span className="truncate">{participantName(participant)}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{isActive ? participantRole(participant) : 'Removed'}</span></p>
                    <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{participant.displayAddress || 'No address'}</p>
                  </div>
                  {isActive ? <Track><button type="button" onClick={() => setOpen(open === participant.id ? null : participant.id)} aria-pressed={open === participant.id} aria-label={`Remove ${participantName(participant)}`} className={trackItemClass(open === participant.id)}><UserMinus className="size-3.5" aria-hidden="true" />Remove</button></Track> : null}
                </div>
                {open === participant.id ? <div className="border-t border-border bg-muted/20 p-4"><RemoveForm threadId={threadId} participant={participant} onDone={close} /></div> : null}
              </li>
            )
          })}
        </ul>
      ) : <div className="p-4"><EmptyState title="No recipients yet" /></div>}
    </Panel>
  )
}
