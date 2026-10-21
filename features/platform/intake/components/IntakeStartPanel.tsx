/* Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 · audience: intake staff · use: create a prospect and conflict-ready intake · tone: technical/austere · genre: modern-minimal · macrostructure: Intake sheet · theme: Quiet */
'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { UserRoundPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { startIntake, type IntakeSetup, type IntakeStartState } from '../actions/startIntake'

export function IntakeStartPanel({ setup }: { setup: IntakeSetup }) {
  const [contactType, setContactType] = useState('person')
  const [state, action, pending] = useActionState<IntakeStartState, FormData>(startIntake, { ok: false, message: '' })
  return (
    <section className="border-y border-border py-5" aria-labelledby="new-intake-heading">
      <div className="flex items-start gap-3 px-1">
        <UserRoundPlus className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 id="new-intake-heading" className="text-base font-bold text-foreground">Start client intake</h2>
        </div>
      </div>
      <form action={action} className="mt-5 space-y-5 px-1">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Select id="contactType" label="Contact type" name="contactType" value={contactType} onChange={setContactType} options={[['person', 'Person'], ['organization', 'Organization']]} />
          {contactType === 'person' ? <><Field id="firstName" label="First name" required /><Field id="lastName" label="Last name" required /></> : <Field id="organizationName" label="Organization name" required />}
          <Field id="email" label="Email" type="email" />
          <Field id="phone" label="Phone" type="tel" />
          <Field id="title" label="Intake title" required />
          <Select id="source" label="Source" name="source" value="other" options={[['website', 'Website'], ['referral', 'Referral'], ['phone', 'Phone'], ['walk_in', 'Walk-in'], ['other', 'Other']]} />
          <SearchableOptionSelect id="officeId" label="Office" name="officeId" emptyLabel="No office selected" kind="office" total={setup.officesCount} options={setup.offices.map((office) => ({ value: office.id, label: `${office.name} · ${office.code}` }))} />
          <SearchableOptionSelect id="assignedToId" label="Assignee" name="assignedToId" emptyLabel="Assign to me" kind="member" total={setup.membershipsCount} options={setup.memberships.map((membership) => ({ value: membership.user.id, label: `${membership.user.name} · ${membership.user.email}` }))} />
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <TextArea id="summary" label="Prospective matter summary" maxLength={4000} />
          <TextArea id="adversePartySummary" label="Known adverse parties" maxLength={2000} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" className="min-h-11 whitespace-nowrap" disabled={pending}>{pending ? 'Creating…' : 'Create intake'}</Button>
          <div className="min-h-6 text-sm">{state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'text-foreground' : 'text-destructive'}>{state.message}</p> : null}</div>
        </div>
      </form>
    </section>
  )
}

function Field({ id, label, type = 'text', required = false }: { id: string; label: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} type={type} required={required} className="min-h-11" /></div>
}

function TextArea({ id, label, maxLength }: { id: string; label: string; maxLength: number }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><textarea id={id} name={id} maxLength={maxLength} rows={4} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" /></div>
}

function Select({ id, label, name, value, options, onChange }: { id: string; label: string; name: string; value: string; options: string[][]; onChange?: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <FormSelect id={id} name={name} value={onChange ? value : undefined} defaultValue={onChange ? undefined : value} onValueChange={onChange ? (event) => onChange(event) : undefined} className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50">
        {options.map(([optionValue, optionLabel]) => <option key={`${optionValue}-${optionLabel}`} value={optionValue}>{optionLabel}</option>)}
      </FormSelect>
    </div>
  )
}
