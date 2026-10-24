'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Plus } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { ChoiceTrack, FormFooter, ReasonField, TextField, useCommand } from '@/features/platform/components/CommandFormParts'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { EmptyState, Panel, StatusDot, Track, fieldClass, labelClass, statusLabel, statusTone, textareaClass, trackItemClass } from '@/features/platform/components/ui'

import { addDocketDeadline, changeDocketStatus, createDocket, recordEntry, saveCourt, verifyEntry } from '../actions/docketCommands'
import { COURT_TYPES, DEADLINE_TYPES, DOCKET_TRANSITIONS, ENTRY_OUTCOMES, ENTRY_TYPES, type CourtRow, type DocketEntryRow, type DocumentVersionOption } from '../lib/docketTypes'

function SelectField({ id, name, label, defaultValue, options, required, emptyLabel, className }: { id: string; name: string; label: string; defaultValue?: string; options: ReadonlyArray<readonly [string, string]>; required?: boolean; emptyLabel?: string; className?: string }) {
  return (
    <label htmlFor={id} className={cn(labelClass, className)}>{label}
      <FormSelect id={id} name={name} defaultValue={defaultValue ?? (emptyLabel ? '' : options[0]?.[0])} required={required} className={fieldClass}>
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </FormSelect>
    </label>
  )
}

function CourtForm({ court, onDone }: { court?: CourtRow; onDone: () => void }) {
  const [state, action, pending] = useCommand(saveCourt, onDone)
  const key = court?.id ?? 'new'
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={court?.id ?? ''} />
      <TextField id={`court-name-${key}`} name="name" label="Name" required minLength={2} maxLength={200} defaultValue={court?.name} className="sm:col-span-2" />
      <SelectField id={`court-type-${key}`} name="courtType" label="Type" defaultValue={court?.courtType ?? 'state'} options={COURT_TYPES} />
      <TextField id={`court-jurisdiction-${key}`} name="jurisdiction" label="Jurisdiction" required minLength={2} maxLength={200} defaultValue={court?.jurisdiction} />
      <TextField id={`court-division-${key}`} name="division" label="Division" maxLength={200} defaultValue={court?.division ?? ''} />
      <TextField id={`court-phone-${key}`} name="phone" label="Phone" type="tel" maxLength={60} defaultValue={court?.phone ?? ''} />
      <TextField id={`court-website-${key}`} name="website" label="Website" type="url" maxLength={2000} defaultValue={court?.website ?? ''} placeholder="https://" />
      <TextField id={`court-filing-${key}`} name="filingUrl" label="Filing address" type="url" maxLength={2000} defaultValue={court?.filingUrl ?? ''} placeholder="https://" />
      <ChoiceTrack name="status" label="Status" defaultValue={court?.status ?? 'active'} options={[['active', 'Active'], ['inactive', 'Inactive']]} className="sm:col-span-2" />
      <FormFooter state={state} pending={pending} label={court ? 'Save court' : 'Add court'} className="sm:col-span-2" />
    </form>
  )
}

export function CourtsPanel({ courts }: { courts: CourtRow[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = () => setOpen(null)
  return (
    <Panel
      id="courts"
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Courts<span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{courts.length.toLocaleString()}</span></h2>}
      actions={<Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Add court</button></Track>}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border p-4"><CourtForm onDone={close} /></div> : null}
      {courts.length ? <ul className="divide-y divide-border">
        {courts.map((court) => <li key={court.id}>
          <button type="button" onClick={() => setOpen(open === court.id ? null : court.id)} aria-expanded={open === court.id} className="grid w-full min-w-0 gap-0.5 px-4 py-3 text-left hover:bg-muted/40">
            <span className="flex min-w-0 items-center gap-2">
              <StatusDot tone={statusTone(court.status ?? 'active')} />
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{court.name}</span>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(court.status ?? 'active')}</span>
            </span>
            <span className="truncate pl-4 text-xs text-muted-foreground">{[COURT_TYPES.find(([value]) => value === court.courtType)?.[1], court.jurisdiction, court.division, `${court.docketsCount ?? 0} dockets`].filter(Boolean).join(' · ')}</span>
          </button>
          {open === court.id ? <div className="border-t border-border bg-muted/20 p-4"><CourtForm court={court} onDone={close} /></div> : null}
        </li>)}
      </ul> : <div className="p-4"><EmptyState title="No courts yet" /></div>}
    </Panel>
  )
}

export function CreateDocketPanel({ courts, timeZone }: { courts: CourtRow[]; timeZone: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useCommand(createDocket, () => setOpen(false))
  const activeCourts = courts.filter((court) => court.status !== 'inactive').map((court) => [court.id, `${court.name} · ${court.jurisdiction}`] as const)
  return (
    <section aria-labelledby="new-docket-heading" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 id="new-docket-heading" className="text-sm font-semibold">New docket</h2>
        <Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}><Plus className="size-3.5" aria-hidden="true" />Docket</button></Track>
      </header>
      {open ? (activeCourts.length ? (
        <form action={action} className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
          <input type="hidden" name="timezone" value={timeZone} />
          <div className="sm:col-span-2"><SearchableOptionSelect id="docket-matter" name="matterId" label="Matter" emptyLabel="Choose a matter" required kind="matter" options={[]} /></div>
          <TextField id="docket-number" name="docketNumber" label="Docket number" required maxLength={120} />
          <SelectField id="docket-court" name="courtId" label="Court" required emptyLabel="Choose a court" options={activeCourts} />
          <TextField id="docket-title" name="title" label="Title" required minLength={2} maxLength={300} className="sm:col-span-2" />
          <TextField id="docket-filed" name="filedAt" label={`Filed date (${timeZone})`} type="date" />
          <FormFooter state={state} pending={pending} label="Create docket" pendingLabel="Creating…" className="sm:col-span-2" />
        </form>
      ) : <div className="border-t border-border p-4"><EmptyState title="Add an active court first" /></div>) : state.ok && state.message ? <p role="status" className="border-t border-border px-4 py-3 text-sm">{state.message}</p> : null}
    </section>
  )
}

export function DocketStatusControl({ docketId, status }: { docketId: string; status: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useCommand(changeDocketStatus, () => setOpen(false))
  const targets = DOCKET_TRANSITIONS[status] ?? []
  if (!targets.length) return null
  return (
    <div className="relative">
      <Track><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={trackItemClass(true)}>Change status</button></Track>
      {open ? (
        <form action={action} className="absolute right-0 z-20 mt-2 grid w-72 max-w-[calc(100vw-2rem)] gap-3 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <input type="hidden" name="docketId" value={docketId} />
          <ChoiceTrack name="toStatus" label="New status" defaultValue={targets[0]} options={targets.map((value) => [value, statusLabel(value)] as const)} />
          <FormFooter state={state} pending={pending} label="Save" />
        </form>
      ) : null}
    </div>
  )
}

export function RecordEntryForm({ docketId, timeZone, versions }: { docketId: string; timeZone: string; versions: DocumentVersionOption[] }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useCommand(recordEntry, () => setOpen(false))
  return (
    <section aria-labelledby="record-entry-heading" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 id="record-entry-heading" className="text-sm font-semibold">Record entry</h2>
        <Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}><Plus className="size-3.5" aria-hidden="true" />Entry</button></Track>
      </header>
      {open ? (
        <form action={action} className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
          <input type="hidden" name="docketId" value={docketId} />
          <input type="hidden" name="timezone" value={timeZone} />
          <TextField id="entry-title" name="title" label="Title" required maxLength={300} className="sm:col-span-2" />
          <SelectField id="entry-type" name="entryType" label="Type" defaultValue="filing" options={ENTRY_TYPES} />
          <TextField id="entry-occurred" name="occurredAt" label={`Occurred (${timeZone})`} type="datetime-local" required />
          <TextField id="entry-filed" name="filedAt" label="Filed (court date)" type="datetime-local" />
          <TextField id="entry-entered" name="enteredAt" label="Entered (court date)" type="datetime-local" />
          <label htmlFor="entry-description" className={cn(labelClass, 'sm:col-span-2')}>Description<textarea id="entry-description" name="description" maxLength={8000} rows={3} className={textareaClass} /></label>
          <TextField id="entry-source" name="sourceUrl" label="Source address" type="url" maxLength={2000} placeholder="https://" />
          <SelectField id="entry-version" name="documentVersionId" label="Supporting document" emptyLabel="None" options={versions.map((version) => [version.id, version.label] as const)} />
          <FormFooter state={state} pending={pending} label="Record entry" pendingLabel="Recording…" className="sm:col-span-2" />
        </form>
      ) : null}
    </section>
  )
}

function VerifyEntryForm({ docketId, entry, onDone }: { docketId: string; entry: DocketEntryRow; onDone: () => void }) {
  const [state, action, pending] = useCommand(verifyEntry, onDone)
  const outcomes = (ENTRY_OUTCOMES[entry.status] ?? []).filter((outcome) => (outcome !== 'filed' || entry.filedAt) && (outcome !== 'entered' || entry.enteredAt))
  if (!outcomes.length) return <p className="text-xs text-muted-foreground">No verification outcome is available for this entry.</p>
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="docketId" value={docketId} />
      <input type="hidden" name="entryId" value={entry.id} />
      <ChoiceTrack name="toStatus" label="Court record shows" defaultValue={outcomes[0]} options={outcomes.map((value) => [value, statusLabel(value)] as const)} />
      {(!entry.filedAt || !entry.enteredAt) ? <p className="text-xs text-muted-foreground">{!entry.filedAt && !entry.enteredAt ? 'Filed and entered need court dates.' : !entry.filedAt ? 'Filed needs a court filed date.' : 'Entered needs a court entered date.'}</p> : null}
      <ReasonField id={`verify-${entry.id}`} label="Verification note" minLength={3} />
      <FormFooter state={state} pending={pending} label="Verify" pendingLabel="Verifying…" />
    </form>
  )
}

export function EntryTimeline({ docketId, entries, timeZone, canRecord }: { docketId: string; entries: DocketEntryRow[]; timeZone: string; canRecord: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const format = (value: string | null) => {
    if (!value) return null
    try { return new Intl.DateTimeFormat('en', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
  }
  return (
    <Panel id="entries" title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Entries<span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{entries.length.toLocaleString()}</span></h2>} bodyClassName="p-0">
      {entries.length ? <ol className="divide-y divide-border">
        {entries.map((entry) => <li key={entry.id} className="grid gap-1 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <StatusDot tone={entry.isVerified ? statusTone(entry.status === 'filed' || entry.status === 'entered' ? 'verified' : entry.status) : 'amber'} />
            <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{entry.title || 'Untitled entry'}</h3>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(entry.status)} · {entry.isVerified ? 'Verified' : 'Unverified'}</span>
            {canRecord && !entry.isVerified && ENTRY_OUTCOMES[entry.status] ? <Track className="ml-auto"><button type="button" onClick={() => setOpen(open === entry.id ? null : entry.id)} aria-expanded={open === entry.id} className={cn(trackItemClass(open === entry.id), 'h-7 px-3 text-xs')}>Verify</button></Track> : null}
          </div>
          <p className="pl-4 font-mono text-xs tabular-nums text-muted-foreground">{[ENTRY_TYPES.find(([value]) => value === entry.entryType)?.[1] ?? entry.entryType, format(entry.occurredAt), entry.filedAt ? `Filed ${format(entry.filedAt)}` : null, entry.enteredAt ? `Entered ${format(entry.enteredAt)}` : null].filter(Boolean).join(' · ')}</p>
          {entry.description ? <p className="whitespace-pre-line pl-4 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{entry.description}</p> : null}
          {entry.sourceUrl || entry.documentVersion || entry.isVerified ? <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-xs text-muted-foreground">
            {entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">Source<ExternalLink className="size-3" aria-hidden="true" /></a> : null}
            {entry.documentVersion ? <span>{entry.documentVersion.fileName || 'Document'} v{entry.documentVersion.versionNumber ?? '?'}</span> : null}
            {entry.isVerified ? <span>Verified{entry.verifiedBy?.name ? ` by ${entry.verifiedBy.name}` : ''}{entry.verifiedAt ? ` · ${format(entry.verifiedAt)}` : ''}</span> : null}
          </p> : null}
          {open === entry.id ? <div className="mt-2 rounded-lg bg-muted/30 p-3"><VerifyEntryForm docketId={docketId} entry={entry} onDone={() => setOpen(null)} /></div> : null}
        </li>)}
      </ol> : <div className="p-4"><EmptyState title="No entries recorded" /></div>}
    </Panel>
  )
}

export function DocketDeadlines({ docketId, deadlines, timeZone, canAdd }: { docketId: string; deadlines: Array<{ id: string; title: string | null; status: string; deadlineType: string | null; dueAt: string | null; timezone: string | null; isVerified: boolean | null }>; timeZone: string; canAdd: boolean }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useCommand(addDocketDeadline, () => setOpen(false))
  const format = (value: string | null, zone: string | null) => {
    if (!value) return 'No due time'
    try { return new Intl.DateTimeFormat('en', { timeZone: zone || timeZone, dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(value)) } catch { return value }
  }
  return (
    <Panel
      id="deadlines"
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Deadlines<span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{deadlines.length.toLocaleString()}</span></h2>}
      actions={canAdd ? <Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}><Plus className="size-3.5" aria-hidden="true" />Add deadline</button></Track> : null}
      bodyClassName="p-0"
    >
      {open ? (
        <form action={action} className="grid gap-4 border-b border-border p-4">
          <input type="hidden" name="docketId" value={docketId} />
          <input type="hidden" name="timezone" value={timeZone} />
          <TextField id="deadline-title" name="title" label="Title" required maxLength={300} />
          <SelectField id="deadline-type" name="deadlineType" label="Type" defaultValue="court" options={DEADLINE_TYPES} />
          <TextField id="deadline-due" name="dueAt" label={`Due (${timeZone})`} type="datetime-local" required />
          <FormFooter state={state} pending={pending} label="Add deadline" pendingLabel="Adding…" />
        </form>
      ) : null}
      {deadlines.length ? <ul className="divide-y divide-border">
        {deadlines.map((deadline) => <li key={deadline.id} className="min-w-0 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={statusTone(deadline.status)} />
            <Link href={`/dashboard/platform/work/deadline/${encodeURIComponent(deadline.id)}`} className="min-w-0 truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline">{deadline.title || 'Untitled deadline'}</Link>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(deadline.status)}</span>
          </div>
          <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{format(deadline.dueAt, deadline.timezone)} · {deadline.isVerified ? 'Verified' : 'Not verified'}</p>
        </li>)}
      </ul> : <div className="p-4"><EmptyState title="No linked deadlines" /></div>}
    </Panel>
  )
}
