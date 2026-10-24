'use client'

import { useActionState, useState } from 'react'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Panel, StatusDot, Track, fieldClass, labelClass, pillClass, pillDangerClass, pillPrimaryClass, trackItemClass } from '@/features/platform/components/ui'

import { addContactMethod, changeContactMethod, removeAddress, saveAddress, setPrimaryAddress } from '../actions/contacts'
import {
  ADDRESS_TYPES,
  ADDRESS_TYPE_LABELS,
  METHOD_TYPES,
  METHOD_TYPE_LABELS,
  initialContactActionState,
  type ContactAddressRow,
  type ContactMethodRow,
} from '../lib/contactTypes'
import { ActionResult, useRefreshOnSuccess } from './ContactForms'

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-foreground" />{label}</label>
}

function AddressForm({ contactId, address, onDone }: { contactId: string; address?: ContactAddressRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveAddress, initialContactActionState)
  useRefreshOnSuccess(state, onDone)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="addressId" value={address?.id ?? ''} />
      <label className={labelClass}>Type
        <select name="addressType" defaultValue={address?.addressType ?? 'mailing'} className={fieldClass}>
          {ADDRESS_TYPES.map((type) => <option key={type} value={type}>{ADDRESS_TYPE_LABELS[type]}</option>)}
        </select>
      </label>
      <label className={labelClass}>Label<input name="label" maxLength={80} defaultValue={address?.label ?? ''} className={fieldClass} /></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>Address line 1<input name="line1" required maxLength={200} defaultValue={address?.line1 ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>Address line 2<input name="line2" maxLength={200} defaultValue={address?.line2 ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>City<input name="city" required maxLength={120} defaultValue={address?.city ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>State or region<input name="region" maxLength={120} defaultValue={address?.region ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>Postal code<input name="postalCode" maxLength={20} defaultValue={address?.postalCode ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>Country<input name="countryCode" maxLength={2} defaultValue={address?.countryCode ?? 'US'} pattern="[A-Za-z]{2}" className={cn(fieldClass, 'uppercase')} /></label>
      <div className="sm:col-span-2"><Check name="isPrimary" label="Primary address" defaultChecked={address?.isPrimary ?? false} /></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <ActionResult state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : address ? 'Save address' : 'Add address'}</button></Track>
      </div>
    </form>
  )
}

function AddressActions({ contactId, address }: { contactId: string; address: ContactAddressRow }) {
  const [primaryState, primaryAction, primaryPending] = useActionState(setPrimaryAddress, initialContactActionState)
  const [removeState, removeAction, removePending] = useActionState(removeAddress, initialContactActionState)
  useRefreshOnSuccess(primaryState)
  useRefreshOnSuccess(removeState)
  const failure = [primaryState, removeState].find((state) => state.message && !state.ok)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {failure ? <ActionResult state={failure} /> : <span />}
      <Track>
        {!address.isPrimary ? (
          <form action={primaryAction}><input type="hidden" name="contactId" value={contactId} /><input type="hidden" name="addressId" value={address.id} /><button type="submit" disabled={primaryPending} className={pillClass}>Make primary</button></form>
        ) : null}
        <form action={removeAction}><input type="hidden" name="contactId" value={contactId} /><input type="hidden" name="addressId" value={address.id} /><button type="submit" disabled={removePending} className={pillDangerClass}>{removePending ? 'Removing…' : 'Remove'}</button></form>
      </Track>
    </div>
  )
}

function addressLine(address: ContactAddressRow) {
  return [address.line1, address.line2, address.city, [address.region, address.postalCode].filter(Boolean).join(' '), address.countryCode].filter(Boolean).join(', ')
}

export function AddressManager({ contactId, addresses }: { contactId: string; addresses: ContactAddressRow[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = () => setOpen(null)
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Addresses<span className="font-mono text-xs font-normal text-muted-foreground">{addresses.length}</span></h2>}
      actions={<Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Add</button></Track>}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border p-4"><AddressForm contactId={contactId} onDone={close} /></div> : null}
      {addresses.length ? (
        <ul className="divide-y divide-border">
          {addresses.map((address) => (
            <li key={address.id} className="min-w-0">
              <button type="button" onClick={() => setOpen(open === address.id ? null : address.id)} aria-expanded={open === address.id} className="block w-full min-w-0 px-4 py-3 text-left hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot tone={address.isPrimary ? 'emerald' : 'zinc'} />
                  <span className="min-w-0 truncate text-sm font-semibold">{address.label || ADDRESS_TYPE_LABELS[address.addressType ?? 'other']}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{address.isPrimary ? 'Primary' : ADDRESS_TYPE_LABELS[address.addressType ?? 'other']}</span>
                </span>
                <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{addressLine(address) || 'No street address'}</span>
              </button>
              {open === address.id ? (
                <div className="grid gap-4 border-t border-border bg-muted/20 p-4">
                  <AddressForm contactId={contactId} address={address} onDone={close} />
                  <div className="border-t border-border pt-4"><AddressActions contactId={contactId} address={address} /></div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : open !== 'new' ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">No addresses</p> : null}
    </Panel>
  )
}

function MethodForm({ contactId, onDone }: { contactId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(addContactMethod, initialContactActionState)
  useRefreshOnSuccess(state, onDone)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="contactId" value={contactId} />
      <label className={labelClass}>Type
        <select name="methodType" defaultValue="email" className={fieldClass}>
          {METHOD_TYPES.map((type) => <option key={type} value={type}>{METHOD_TYPE_LABELS[type]}</option>)}
        </select>
      </label>
      <label className={labelClass}>Label<input name="label" maxLength={80} placeholder="Work" className={fieldClass} /></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>Value<input name="value" required maxLength={320} autoComplete="off" className={fieldClass} /></label>
      <div className="flex flex-wrap gap-x-6 sm:col-span-2">
        <Check name="isPrimary" label="Primary" defaultChecked={false} />
        <Check name="canContact" label="Can contact" defaultChecked />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <ActionResult state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Adding…' : 'Add method'}</button></Track>
      </div>
    </form>
  )
}

function MethodRow({ contactId, method }: { contactId: string; method: ContactMethodRow }) {
  const [state, action, pending] = useActionState(changeContactMethod, initialContactActionState)
  useRefreshOnSuccess(state)
  return (
    <li className="grid min-w-0 gap-2 px-4 py-3">
      <div className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <StatusDot tone={!method.canContact ? 'rose' : method.isPrimary ? 'emerald' : 'zinc'} />
          <span className="min-w-0 truncate text-sm font-semibold">{method.value || 'No value'}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{[method.isPrimary ? 'Primary' : null, method.canContact ? null : 'Do not contact'].filter(Boolean).join(' · ') || METHOD_TYPE_LABELS[method.methodType]}</span>
        </span>
        <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{[METHOD_TYPE_LABELS[method.methodType], method.label, method.verifiedAt ? 'Verified' : null].filter(Boolean).join(' · ')}</span>
      </div>
      <form action={action} className="flex flex-wrap items-center justify-between gap-2 pl-4">
        <input type="hidden" name="contactId" value={contactId} />
        <input type="hidden" name="methodId" value={method.id} />
        {state.message && !state.ok ? <ActionResult state={state} /> : <span />}
        <Track>
          {!method.isPrimary ? <button type="submit" name="change" value="primary" disabled={pending} className={cn(pillClass, 'h-7 text-xs')}>Make primary</button> : null}
          <button type="submit" name="change" value={method.canContact ? 'stop' : 'allow'} disabled={pending} className={cn(pillClass, 'h-7 text-xs')}>{method.canContact ? 'Do not contact' : 'Allow contact'}</button>
          <button type="submit" name="change" value="remove" disabled={pending} className={cn(pillDangerClass, 'h-7 text-xs')}>Remove</button>
        </Track>
      </form>
    </li>
  )
}

export function ContactMethodManager({ contactId, methods }: { contactId: string; methods: ContactMethodRow[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Contact methods<span className="font-mono text-xs font-normal text-muted-foreground">{methods.length}</span></h2>}
      actions={<Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}><Plus className="size-3.5" aria-hidden="true" />Add</button></Track>}
      bodyClassName="p-0"
    >
      {open ? <div className="border-b border-border p-4"><MethodForm contactId={contactId} onDone={() => setOpen(false)} /></div> : null}
      {methods.length ? (
        <ul className="divide-y divide-border">
          {methods.map((method) => <MethodRow key={method.id} contactId={contactId} method={method} />)}
        </ul>
      ) : !open ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">No contact methods</p> : null}
    </Panel>
  )
}
