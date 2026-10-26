'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, textareaClass, trackClass, trackItemClass } from '@/features/platform/components/ui'

import { changeContactStatus, createContact, updateContactIdentity } from '../actions/contacts'
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  CONTACT_STATUS_TONES,
  MAX_CONFLICT_ALIASES,
  aliasList,
  initialContactActionState,
  type ContactActionState,
  type ContactIdentity,
  type ContactStatus,
  type ContactType,
} from '../lib/contactTypes'
import { useKeptForm } from '../../components/useKeptForm'

export function ActionResult({ state }: { state: ContactActionState }) {
  if (!state.message) return <span />
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

export function useRefreshOnSuccess(state: ContactActionState, onDone?: () => void) {
  const router = useRouter()
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    if (state.ok && state.revision) {
      router.refresh()
      done.current?.()
    }
  }, [state.revision, state.ok, router])
}

function TypeTrack({ value, onChange }: { value: ContactType; onChange: (value: ContactType) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Type</legend>
      <div className={trackClass}>
        {(['person', 'organization'] as const).map((type) => (
          <button key={type} type="button" aria-pressed={value === type} onClick={() => onChange(type)} className={trackItemClass(value === type)}>
            {type === 'person' ? 'Person' : 'Organization'}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Identity inputs shared by create and edit; names follow the Contact list fields. */
function IdentityFields({ contact, type, onTypeChange }: { contact?: ContactIdentity; type: ContactType; onTypeChange: (value: ContactType) => void }) {
  return (
    <>
      <input type="hidden" name="contactType" value={type} />
      <div className="sm:col-span-2"><TypeTrack value={type} onChange={onTypeChange} /></div>
      <label className={cn(labelClass, 'sm:col-span-2', type !== 'organization' && 'hidden')}>Organization name<input name="organizationName" maxLength={200} defaultValue={contact?.organizationName ?? ''} className={fieldClass} /></label>
      <label className={cn(labelClass, type !== 'person' && 'hidden')}>First name<input name="firstName" maxLength={120} defaultValue={contact?.firstName ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={cn(labelClass, type !== 'person' && 'hidden')}>Last name<input name="lastName" maxLength={120} defaultValue={contact?.lastName ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={cn(labelClass, type !== 'person' && 'hidden')}>Middle name<input name="middleName" maxLength={120} defaultValue={contact?.middleName ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>Preferred name<input name="preferredName" maxLength={120} defaultValue={contact?.preferredName ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>Email<input name="primaryEmail" type="email" maxLength={320} defaultValue={contact?.primaryEmail ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>Phone<input name="primaryPhone" type="tel" maxLength={40} defaultValue={contact?.primaryPhone ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>
        <span className="flex justify-between gap-2">Conflict aliases (one per line)<span className="font-mono">max {MAX_CONFLICT_ALIASES}</span></span>
        <textarea name="conflictSearchAliases" rows={3} defaultValue={aliasList(contact?.conflictSearchAliases).join('\n')} className={textareaClass} />
      </label>
    </>
  )
}

function StatusSelect({ value, onChange }: { value: ContactStatus; onChange: (value: ContactStatus) => void }) {
  return (
    <fieldset className="grid gap-1.5 sm:col-span-2">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Status</legend>
      <div className={cn(trackClass, 'flex-wrap rounded-[6px]')}>
        {CONTACT_STATUSES.filter((status) => status !== 'archived').map((status) => (
          <button key={status} type="button" aria-pressed={value === status} onClick={() => onChange(status)} className={trackItemClass(value === status)}>
            <StatusDot tone={CONTACT_STATUS_TONES[status]} />{CONTACT_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function NewContactForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [state, action, pending] = useActionState(createContact, initialContactActionState)
  const actionForm = useKeptForm(action, state)
  const [type, setType] = useState<ContactType>('person')
  const [status, setStatus] = useState<ContactStatus>('prospective_client')
  const handled = useRef(0)
  useEffect(() => {
    if (state.ok && state.id && handled.current !== state.revision) {
      handled.current = state.revision
      onCreated(state.id)
    }
  }, [state, onCreated])
  return (
    <form {...actionForm} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="status" value={status} />
      <IdentityFields type={type} onTypeChange={setType} />
      <StatusSelect value={status} onChange={setStatus} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-2">
        <ActionResult state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Creating…' : 'Create contact'}</button></Track>
      </div>
    </form>
  )
}

/** "New contact" pill that opens a drawer; on success it opens the new contact. */
export function NewContactSheet() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Track>
        <button type="button" onClick={() => setOpen(true)} className={pillPrimaryClass}><Plus className="size-3.5" aria-hidden="true" />New contact</button>
      </Track>
      <SheetContent side="right" className="w-full overflow-y-auto p-5 sm:max-w-lg">
        <SheetTitle className="mb-5 pr-8 text-base">New contact</SheetTitle>
        {open ? <NewContactForm onCreated={(id) => { setOpen(false); router.push(`/dashboard/platform/contacts/${id}`) }} /> : null}
      </SheetContent>
    </Sheet>
  )
}

export function ContactIdentityForm({ contact }: { contact: ContactIdentity }) {
  const [state, action, pending] = useActionState(updateContactIdentity, initialContactActionState)
  const actionForm = useKeptForm(action, state)
  const [type, setType] = useState<ContactType>(contact.contactType)
  useRefreshOnSuccess(state)
  return (
    <Panel title="Identity">
      <form {...actionForm} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="contactId" value={contact.id} />
        <IdentityFields contact={contact} type={type} onTypeChange={setType} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-2">
          <ActionResult state={state} />
          <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : 'Save'}</button></Track>
        </div>
      </form>
    </Panel>
  )
}

/** Status pills; choosing one saves it immediately. */
export function ContactStatusTrack({ contactId, status }: { contactId: string; status: ContactStatus }) {
  const [state, action, pending] = useActionState(changeContactStatus, initialContactActionState)
  const actionForm = useKeptForm(action, state)
  useRefreshOnSuccess(state)
  return (
    <Panel title="Status">
      <form {...actionForm} className="grid gap-3">
        <input type="hidden" name="contactId" value={contactId} />
        <div role="group" aria-label="Contact status" className={cn(trackClass, 'flex-wrap rounded-[6px]')}>
          {CONTACT_STATUSES.map((value) => (
            <button key={value} type="submit" name="status" value={value} disabled={pending || value === status} aria-pressed={value === status} className={cn(trackItemClass(value === status), value === status && 'disabled:opacity-100')}>
              <StatusDot tone={CONTACT_STATUS_TONES[value]} />{CONTACT_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
        <ActionResult state={state} />
      </form>
    </Panel>
  )
}
