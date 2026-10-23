'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { fieldClass, labelClass, pillPrimaryClass, textareaClass, trackClass, trackItemClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'

import { createDeskRecord, type DeskCreateState } from './actions/createDeskRecord'

type DeskKind = 'matters' | 'work' | 'documents' | 'communications' | 'time-expenses'
type CreateKind = 'task' | 'deadline' | 'document' | 'message' | 'expense'

const forms: Record<DeskKind, Array<{ kind: CreateKind; label: string }>> = {
  matters: [],
  work: [{ kind: 'task', label: 'Task' }, { kind: 'deadline', label: 'Draft deadline' }],
  documents: [{ kind: 'document', label: 'Document record' }],
  communications: [{ kind: 'message', label: 'Draft message' }],
  'time-expenses': [{ kind: 'expense', label: 'Expense' }],
}


// Primary create paths for each desk. Matters open only from a cleared intake, so that
// desk links to the controlled intake and conversion workflow instead of a raw create.
export function DeskCreatePanel({ desk, timeZone }: { desk: DeskKind; timeZone: string }) {
  const [selected, setSelected] = useState<CreateKind | null>(null)
  if (desk === 'matters') {
    return (
      <section aria-labelledby="open-matter-heading" className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-xs">
        <h2 id="open-matter-heading" className="text-sm font-semibold">Open a matter</h2>
        <nav aria-label="Open a matter" className={cn(trackClass, 'mt-3')}>
          <Link href="/dashboard/platform/intake#new-intake-heading" className={pillPrimaryClass}><Plus className="size-4" aria-hidden="true" />Start client intake</Link>
          <Link href="/dashboard/platform/intake#intake-conversion" className={trackItemClass(false)}>From a cleared intake</Link>
        </nav>
      </section>
    )
  }
  const options = forms[desk]
  const active = options.find((form) => form.kind === selected)
  return (
    <section aria-labelledby={`create-${desk}-heading`} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 id={`create-${desk}-heading`} className="text-sm font-semibold">New</h2>
        <div role="group" aria-label="Record to create" className={trackClass}>
          {options.map((form) => (
            <button key={form.kind} type="button" aria-pressed={selected === form.kind} onClick={() => setSelected(selected === form.kind ? null : form.kind)} className={trackItemClass(selected === form.kind)}>
              <Plus className="size-3.5" aria-hidden="true" />{form.label}
            </button>
          ))}
        </div>
      </header>
      {active ? <CreateForm key={active.kind} kind={active.kind} timeZone={timeZone} /> : null}
    </section>
  )
}

function CreateForm({ kind, timeZone }: { kind: CreateKind; timeZone: string }) {
  const [state, action, pending] = useActionState<DeskCreateState, FormData>(createDeskRecord, { ok: false, message: '' })
  return (
    <form action={action} className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="sm:col-span-2"><SearchableOptionSelect id={`${kind}-matter`} name="matterId" label="Matter" emptyLabel="Search for the matter" required kind="matter" options={[]} /></div>
      {kind === 'task' ? <>
        <Field id="task-title" name="title" label="Task" required maxLength={300} className="sm:col-span-2" />
        <ChoiceTrack name="priority" label="Priority" defaultValue="normal" options={[['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']]} />
        <Field id="task-due" name="dueAt" label={`Due (${timeZone})`} type="datetime-local" />
        <input type="hidden" name="timezone" value={timeZone} />
      </> : null}
      {kind === 'deadline' ? <>
        <Field id="deadline-title" name="title" label="Deadline" required maxLength={300} className="sm:col-span-2" />
        <ChoiceSelect id="deadline-type" name="deadlineType" label="Type" defaultValue="internal" options={[['court', 'Court'], ['statutory', 'Statutory'], ['contractual', 'Contractual'], ['internal', 'Internal'], ['limitation', 'Limitation'], ['other', 'Other']]} />
        <Field id="deadline-zone" name="timezone" label="Time zone" required defaultValue={timeZone} maxLength={64} />
        <Field id="deadline-due" name="dueAt" label="Due (wall-clock, in that zone)" type="datetime-local" required />
      </> : null}
      {kind === 'document' ? <>
        <Field id="document-title" name="title" label="Title" required maxLength={300} className="sm:col-span-2" />
        <ChoiceSelect id="document-category" name="category" label="Category" defaultValue="other" options={[['pleading', 'Pleading'], ['correspondence', 'Correspondence'], ['evidence', 'Evidence'], ['contract', 'Contract'], ['research', 'Research'], ['billing', 'Billing'], ['internal', 'Internal'], ['other', 'Other']]} />
        <ChoiceTrack name="confidentiality" label="Confidentiality" defaultValue="matter" options={[['matter', 'Matter team'], ['restricted', 'Restricted'], ['client_shareable', 'Client shareable']]} />
      </> : null}
      {kind === 'message' ? <>
        <ChoiceTrack name="channel" label="Channel" defaultValue="email" options={[['email', 'Email'], ['sms', 'SMS'], ['phone', 'Phone'], ['portal', 'Portal'], ['internal', 'Internal'], ['other', 'Other']]} className="sm:col-span-2" />
        <Field id="message-subject" name="subject" label="Subject" required maxLength={300} className="sm:col-span-2" />
        <label htmlFor="message-body" className={cn(labelClass, 'sm:col-span-2')}>Message<textarea id="message-body" name="body" required maxLength={20000} rows={5} className={textareaClass} /></label>
      </> : null}
      {kind === 'expense' ? <>
        <Field id="expense-description" name="description" label="Description" required minLength={3} maxLength={2000} className="sm:col-span-2" />
        <ChoiceSelect id="expense-type" name="expenseType" label="Type" defaultValue="other" options={[['filing_fee', 'Filing fee'], ['travel', 'Travel'], ['expert', 'Expert'], ['copying', 'Copying'], ['service', 'Service'], ['other', 'Other']]} />
        <Field id="expense-date" name="incurredAt" label="Date incurred" type="date" required />
        <input type="hidden" name="timezone" value={timeZone} />
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
          <Field id="expense-amount" name="amount" label="Amount" required inputMode="decimal" />
          <Field id="expense-currency" name="currencyCode" label="Currency" required defaultValue="USD" maxLength={3} />
        </div>
        <label className="flex min-h-10 items-center gap-2 self-end text-sm"><input type="checkbox" name="isBillable" defaultChecked className="size-4 accent-foreground" />Billable</label>
      </> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        {state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm [overflow-wrap:anywhere]', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}{state.href ? <> <Link href={state.href} className="font-semibold underline underline-offset-4">Open</Link></> : null}</p> : <span />}
        <div className={trackClass}><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Creating…' : 'Create'}</button></div>
      </div>
    </form>
  )
}

function Field({ id, name, label, type = 'text', required = false, defaultValue, minLength, maxLength, inputMode, className }: { id: string; name: string; label: string; type?: string; required?: boolean; defaultValue?: string; minLength?: number; maxLength?: number; inputMode?: 'decimal'; className?: string }) {
  return <label htmlFor={id} className={cn(labelClass, className)}>{label}<input id={id} name={name} type={type} required={required} defaultValue={defaultValue} minLength={minLength} maxLength={maxLength} inputMode={inputMode} className={fieldClass} /></label>
}

function ChoiceSelect({ id, name, label, defaultValue, options }: { id: string; name: string; label: string; defaultValue: string; options: string[][] }) {
  return <label htmlFor={id} className={labelClass}>{label}<FormSelect id={id} name={name} defaultValue={defaultValue} className={fieldClass}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</FormSelect></label>
}

/** Segmented choice: radio inputs rendered as raised pills in a recessed track. */
function ChoiceTrack({ name, label, defaultValue, options, className }: { name: string; label: string; defaultValue: string; options: string[][]; className?: string }) {
  return (
    <fieldset className={cn('grid min-w-0 gap-1.5', className)}>
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className={trackClass}>
        {options.map(([value, text]) => (
          <label key={value} className="relative">
            <input type="radio" name={name} value={value} defaultChecked={value === defaultValue} className="peer sr-only" />
            <span className={cn(trackItemClass(false), 'cursor-pointer peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-black/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 dark:peer-checked:bg-zinc-800')}>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
