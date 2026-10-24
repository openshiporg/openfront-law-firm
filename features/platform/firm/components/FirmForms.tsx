'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, statusTone, trackClass, trackItemClass } from '@/features/platform/components/ui'

import { saveFirmDefaults, saveOffice } from '../actions/firm'
import {
  COMMON_CURRENCIES,
  OFFICE_STATUSES,
  OFFICE_STATUS_LABELS,
  initialFirmActionState,
  type FirmActionState,
  type FirmDefaults,
  type OfficeRow,
  type OfficeStatus,
} from '../lib/firmTypes'

function Result({ state }: { state: FirmActionState }) {
  if (!state.message) return <span />
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

function useRefreshOnSuccess(state: FirmActionState, onDone?: () => void) {
  const router = useRouter()
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    if (state.ok && state.revision) {
      router.refresh()
      done.current?.()
    }
  }, [state.ok, state.revision, router])
}

export function FirmDefaultsForm({ firm, timeZones }: { firm: FirmDefaults; timeZones: string[] }) {
  const [state, action, pending] = useActionState(saveFirmDefaults, initialFirmActionState)
  useRefreshOnSuccess(state)
  return (
    <Panel title={<h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold"><StatusDot tone={statusTone(firm.status)} /><span className="truncate">Firm defaults</span></h2>}>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="firmId" value={firm.id} />
        <label className={cn(labelClass, 'sm:col-span-2')}>Legal name<input name="name" required maxLength={200} defaultValue={firm.name} className={fieldClass} /></label>
        <label className={cn(labelClass, 'sm:col-span-2')}>Slug<input name="slug" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={firm.slug} className={cn(fieldClass, 'font-mono')} /></label>
        <label className={labelClass}>Default time zone<input name="defaultTimezone" required list="firm-time-zones" maxLength={64} defaultValue={firm.defaultTimezone} autoComplete="off" className={fieldClass} /></label>
        <label className={labelClass}>Default currency<input name="defaultCurrency" required list="firm-currencies" maxLength={3} pattern="[A-Za-z]{3}" defaultValue={firm.defaultCurrency} autoComplete="off" className={cn(fieldClass, 'uppercase')} /></label>
        <datalist id="firm-time-zones">{timeZones.map((zone) => <option key={zone} value={zone} />)}</datalist>
        <datalist id="firm-currencies">{COMMON_CURRENCIES.map((code) => <option key={code} value={code} />)}</datalist>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 sm:col-span-2">
          <Result state={state} />
          <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : 'Save'}</button></Track>
        </div>
      </form>
    </Panel>
  )
}

function OfficeForm({ office, defaultTimeZone, onDone }: { office?: OfficeRow; defaultTimeZone: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveOffice, initialFirmActionState)
  const [status, setStatus] = useState<OfficeStatus>(office?.status ?? 'active')
  useRefreshOnSuccess(state, onDone)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="officeId" value={office?.id ?? ''} />
      <input type="hidden" name="status" value={status} />
      <label className={labelClass}>Name<input name="name" required maxLength={200} defaultValue={office?.name ?? ''} className={fieldClass} /></label>
      <label className={labelClass}>Code<input name="code" required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" defaultValue={office?.code ?? ''} className={cn(fieldClass, 'font-mono')} /></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>Time zone<input name="timezone" required list="firm-time-zones" maxLength={64} defaultValue={office?.timezone ?? defaultTimeZone} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>Email<input name="email" type="email" maxLength={320} defaultValue={office?.email ?? ''} autoComplete="off" className={fieldClass} /></label>
      <label className={labelClass}>Phone<input name="phone" type="tel" maxLength={40} defaultValue={office?.phone ?? ''} autoComplete="off" className={fieldClass} /></label>
      <fieldset className="grid gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Status</legend>
        <div className={trackClass}>
          {OFFICE_STATUSES.map((value) => (
            <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={trackItemClass(status === value)}>
              <StatusDot tone={statusTone(value)} />{OFFICE_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <Result state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : office ? 'Save office' : 'Add office'}</button></Track>
      </div>
    </form>
  )
}

export function OfficeManager({ offices, total, defaultTimeZone }: { offices: OfficeRow[]; total: number; defaultTimeZone: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = () => setOpen(null)
  const active = offices.filter((office) => office.status === 'active').length
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Offices<span className="font-mono text-xs font-normal text-muted-foreground">{active} active · {total}</span></h2>}
      actions={<Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Add</button></Track>}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border p-4"><OfficeForm defaultTimeZone={defaultTimeZone} onDone={close} /></div> : null}
      {offices.length ? (
        <ul className="divide-y divide-border">
          {offices.map((office) => (
            <li key={office.id} className="min-w-0">
              <button type="button" onClick={() => setOpen(open === office.id ? null : office.id)} aria-expanded={open === office.id} className="block w-full min-w-0 px-4 py-3 text-left hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot tone={statusTone(office.status)} />
                  <span className="min-w-0 truncate text-sm font-semibold">{office.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{OFFICE_STATUS_LABELS[office.status] ?? office.status}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{office.code}</span>
                </span>
                <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{[office.timezone, office.email, office.phone].filter(Boolean).join(' · ')}</span>
              </button>
              {open === office.id ? <div className="border-t border-border bg-muted/20 p-4"><OfficeForm office={office} defaultTimeZone={defaultTimeZone} onDone={close} /></div> : null}
            </li>
          ))}
        </ul>
      ) : open !== 'new' ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">No offices</p> : null}
    </Panel>
  )
}
