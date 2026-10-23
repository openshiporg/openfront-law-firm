'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'

import { cn } from '@/lib/utils'
import { Panel, Track, fieldClass, labelClass, pillPrimaryClass, textareaClass, trackClass, trackItemClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { startIntake, type IntakeSetup, type IntakeStartState } from '../actions/startIntake'

const contactTypes = [['person', 'Person'], ['organization', 'Organization']] as const

export function IntakeStartPanel({ setup }: { setup: IntakeSetup }) {
  const [contactType, setContactType] = useState('person')
  const [state, action, pending] = useActionState<IntakeStartState, FormData>(startIntake, { ok: false, message: '' })
  return (
    <Panel title={<h2 id="new-intake-heading" className="min-w-0 truncate text-sm font-semibold text-foreground">New intake</h2>} bodyClassName="p-0">
      <form action={action} aria-labelledby="new-intake-heading" className="min-w-0">
        <div className="space-y-5 p-4">
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Contact type</legend>
            <div role="radiogroup" className={trackClass}>
              {contactTypes.map(([value, text]) => (
                <label key={value} className={cn(trackItemClass(contactType === value), 'cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50')}>
                  <input type="radio" name="contactType" value={value} checked={contactType === value} onChange={() => setContactType(value)} className="sr-only" />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {contactType === 'person' ? <><Field id="firstName" label="First name" required /><Field id="lastName" label="Last name" required /></> : <Field id="organizationName" label="Organization name" required />}
            <Field id="email" label="Email" type="email" />
            <Field id="phone" label="Phone" type="tel" />
          </div>

          <div className="grid min-w-0 gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-3">
            <Field id="title" label="Intake title" required />
            <Select id="source" label="Source" name="source" value="other" options={[['website', 'Website'], ['referral', 'Referral'], ['phone', 'Phone'], ['walk_in', 'Walk-in'], ['other', 'Other']]} />
            <SearchableOptionSelect id="officeId" label="Office" name="officeId" emptyLabel="No office selected" kind="office" total={setup.officesCount} options={setup.offices.map((office) => ({ value: office.id, label: `${office.name} · ${office.code}` }))} />
            <SearchableOptionSelect id="assignedToId" label="Assignee" name="assignedToId" emptyLabel="Assign to me" kind="member" total={setup.membershipsCount} options={setup.memberships.map((membership) => ({ value: membership.user.id, label: `${membership.user.name} · ${membership.user.email}` }))} />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <TextArea id="summary" label="Prospective matter summary" maxLength={4000} />
            <TextArea id="adversePartySummary" label="Known adverse parties" maxLength={2000} />
          </div>
        </div>
        <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
          <Track><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Creating…' : 'Create intake'}</button></Track>
          {state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'min-w-0 break-words text-sm text-foreground' : 'min-w-0 break-words text-sm text-destructive'}>{state.message}</p> : null}
        </footer>
      </form>
    </Panel>
  )
}

function Field({ id, label, type = 'text', required = false }: { id: string; label: string; type?: string; required?: boolean }) {
  return <label htmlFor={id} className={labelClass}>{label}<input id={id} name={id} type={type} required={required} className={fieldClass} /></label>
}

function TextArea({ id, label, maxLength }: { id: string; label: string; maxLength: number }) {
  return <label htmlFor={id} className={labelClass}>{label}<textarea id={id} name={id} maxLength={maxLength} rows={4} className={textareaClass} /></label>
}

function Select({ id, label, name, value, options }: { id: string; label: string; name: string; value: string; options: string[][] }) {
  return (
    <div className={labelClass}>
      <label htmlFor={id}>{label}</label>
      <FormSelect id={id} name={name} defaultValue={value} className={cn(fieldClass, 'text-foreground')}>
        {options.map(([optionValue, optionLabel]) => <option key={`${optionValue}-${optionLabel}`} value={optionValue}>{optionLabel}</option>)}
      </FormSelect>
    </div>
  )
}
