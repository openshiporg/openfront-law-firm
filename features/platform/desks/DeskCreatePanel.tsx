'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'

import { createDeskRecord, type DeskCreateState } from './actions/createDeskRecord'

type DeskKind = 'matters' | 'work' | 'documents' | 'communications' | 'time-expenses'
type CreateKind = 'task' | 'deadline' | 'document' | 'message' | 'expense'

const forms: Record<DeskKind, Array<{ kind: CreateKind; label: string }>> = {
  matters: [],
  work: [{ kind: 'task', label: 'New task' }, { kind: 'deadline', label: 'New draft deadline' }],
  documents: [{ kind: 'document', label: 'New document record' }],
  communications: [{ kind: 'message', label: 'New draft message' }],
  'time-expenses': [{ kind: 'expense', label: 'New expense' }],
}

const selectClass = 'flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

// Primary create paths for each desk. Matters open only from a cleared intake, so that
// desk links to the controlled intake and conversion workflow instead of a raw create.
export function DeskCreatePanel({ desk, timeZone }: { desk: DeskKind; timeZone: string }) {
  if (desk === 'matters') {
    return (
      <nav aria-label="Open a matter" className="flex flex-wrap gap-2">
        <Link href="/dashboard/platform/intake#new-intake-heading" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background"><Plus className="h-4 w-4" aria-hidden="true" />Start client intake</Link>
        <Link href="/dashboard/platform/intake#intake-conversion" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">Open a matter from a cleared intake</Link>
      </nav>
    )
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      {forms[desk].map((form) => <CreateForm key={form.kind} kind={form.kind} label={form.label} timeZone={timeZone} />)}
    </div>
  )
}

function CreateForm({ kind, label, timeZone }: { kind: CreateKind; label: string; timeZone: string }) {
  const [state, action, pending] = useActionState<DeskCreateState, FormData>(createDeskRecord, { ok: false, message: '' })
  return (
    <details className="group w-full rounded-md border border-border sm:w-auto open:sm:w-[32rem]">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-foreground"><Plus className="h-4 w-4" aria-hidden="true" />{label}</summary>
      <form action={action} className="grid gap-3 border-t border-border p-3">
        <input type="hidden" name="kind" value={kind} />
        <SearchableOptionSelect id={`${kind}-matter`} name="matterId" label="Matter" emptyLabel="Search for the matter" required kind="matter" options={[]} />
        {kind === 'task' ? <>
          <Field id="task-title" name="title" label="Task" required maxLength={300} />
          <ChoiceSelect id="task-priority" name="priority" label="Priority" defaultValue="normal" options={[['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']]} />
          <Field id="task-due" name="dueAt" label={`Due (${timeZone})`} type="datetime-local" />
          <input type="hidden" name="timezone" value={timeZone} />
        </> : null}
        {kind === 'deadline' ? <>
          <Field id="deadline-title" name="title" label="Deadline" required maxLength={300} />
          <ChoiceSelect id="deadline-type" name="deadlineType" label="Type" defaultValue="internal" options={[['court', 'Court'], ['statutory', 'Statutory'], ['contractual', 'Contractual'], ['internal', 'Internal'], ['limitation', 'Limitation'], ['other', 'Other']]} />
          <Field id="deadline-due" name="dueAt" label="Due (wall-clock time in the zone below)" type="datetime-local" required />
          <Field id="deadline-zone" name="timezone" label="Time zone" required defaultValue={timeZone} maxLength={64} />
        </> : null}
        {kind === 'document' ? <>
          <Field id="document-title" name="title" label="Title" required maxLength={300} />
          <ChoiceSelect id="document-category" name="category" label="Category" defaultValue="other" options={[['pleading', 'Pleading'], ['correspondence', 'Correspondence'], ['evidence', 'Evidence'], ['contract', 'Contract'], ['research', 'Research'], ['billing', 'Billing'], ['internal', 'Internal'], ['other', 'Other']]} />
          <ChoiceSelect id="document-confidentiality" name="confidentiality" label="Confidentiality" defaultValue="matter" options={[['matter', 'Matter team'], ['restricted', 'Restricted'], ['client_shareable', 'Client shareable']]} />
        </> : null}
        {kind === 'message' ? <>
          <ChoiceSelect id="message-channel" name="channel" label="Channel" defaultValue="email" options={[['email', 'Email'], ['sms', 'SMS'], ['phone', 'Phone'], ['portal', 'Portal'], ['internal', 'Internal'], ['other', 'Other']]} />
          <Field id="message-subject" name="subject" label="Subject" required maxLength={300} />
          <div className="space-y-2"><Label htmlFor="message-body">Message</Label><textarea id="message-body" name="body" required maxLength={20000} rows={5} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" /></div>
        </> : null}
        {kind === 'expense' ? <>
          <Field id="expense-description" name="description" label="Description" required minLength={3} maxLength={2000} />
          <ChoiceSelect id="expense-type" name="expenseType" label="Type" defaultValue="other" options={[['filing_fee', 'Filing fee'], ['travel', 'Travel'], ['expert', 'Expert'], ['copying', 'Copying'], ['service', 'Service'], ['other', 'Other']]} />
          <Field id="expense-date" name="incurredAt" label="Date incurred" type="date" required />
          <input type="hidden" name="timezone" value={timeZone} />
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <Field id="expense-amount" name="amount" label="Amount" required inputMode="decimal" />
            <Field id="expense-currency" name="currencyCode" label="Currency" required defaultValue="USD" maxLength={3} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="isBillable" defaultChecked className="h-4 w-4" />Billable to the client</label>
        </> : null}
        <Button type="submit" className="min-h-11 justify-self-start" disabled={pending}>{pending ? 'Creating…' : 'Create'}</Button>
        {state.message ? <p role={state.ok ? 'status' : 'alert'} className={`text-sm ${state.ok ? 'text-foreground' : 'text-destructive'}`}>{state.message}{state.href ? <> <Link href={state.href} className="font-semibold underline">Open it</Link></> : null}</p> : null}
      </form>
    </details>
  )
}

function Field({ id, name, label, type = 'text', required = false, defaultValue, minLength, maxLength, inputMode }: { id: string; name: string; label: string; type?: string; required?: boolean; defaultValue?: string; minLength?: number; maxLength?: number; inputMode?: 'decimal' }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={name} type={type} required={required} defaultValue={defaultValue} minLength={minLength} maxLength={maxLength} inputMode={inputMode} className="min-h-11" /></div>
}

function ChoiceSelect({ id, name, label, defaultValue, options }: { id: string; name: string; label: string; defaultValue: string; options: string[][] }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><FormSelect id={id} name={name} defaultValue={defaultValue} className={selectClass}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</FormSelect></div>
}
