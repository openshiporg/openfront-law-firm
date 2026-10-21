'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { convertIntake, type IntakeSetup, type IntakeStartState } from '../actions/startIntake'

export function IntakeConversionPanel({ setup, pageHrefs }: { setup: IntakeSetup; pageHrefs?: { previous: string | null; next: string | null } }) {
  return (
    <section id="intake-conversion" className="scroll-mt-20 border-y border-border py-5" aria-labelledby="conversion-heading">
      <div className="flex items-start gap-3 px-1">
        <ArrowRight className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 id="conversion-heading" className="text-base font-bold text-foreground">Convert cleared intake · {setup.decisionIntakesCount.toLocaleString()}</h2>
        </div>
      </div>
      {!setup.decisionIntakes.length ? <p className="mt-4 border-y border-dashed border-border px-3 py-6 text-sm text-muted-foreground">No decision-stage intake is ready for conversion.</p> : (
        <div className="mt-5 divide-y divide-border border-y border-border">
          {setup.decisionIntakes.map((intake) => <ConversionForm key={intake.id} intake={intake} setup={setup} />)}
        </div>
      )}
      {setup.decisionPageCount > 1 && pageHrefs ? (
        <nav aria-label="Decision-stage intake pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">Page {setup.decisionPage} of {setup.decisionPageCount}</p>
          <div className="flex gap-2">
            {pageHrefs.previous ? <Link href={pageHrefs.previous} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Previous</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Previous</span>}
            {pageHrefs.next ? <Link href={pageHrefs.next} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Next</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Next</span>}
          </div>
        </nav>
      ) : null}
    </section>
  )
}

function ConversionForm({ intake, setup }: { intake: IntakeSetup['decisionIntakes'][number]; setup: IntakeSetup }) {
  const [state, action, pending] = useActionState<IntakeStartState, FormData>(convertIntake, { ok: false, message: '' })
  return (
    <form action={action} className="space-y-4 px-2 py-5">
      <input type="hidden" name="intakeId" value={intake.id} />
      <div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{intake.intakeNumber}</p><h3 className="mt-1 truncate text-sm font-bold text-foreground">{intake.title}</h3><p className="mt-1 truncate text-sm text-muted-foreground">{intake.primaryContact.displayName}</p></div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field id={`number-${intake.id}`} name="matterNumber" label="Matter number" required />
        <Field id={`title-${intake.id}`} name="matterTitle" label="Matter title" required defaultValue={intake.title} />
        <SearchableOptionSelect id={`attorney-${intake.id}`} name="responsibleAttorneyId" label="Responsible attorney" required kind="member" total={setup.membershipsCount} options={setup.memberships.map((membership) => ({ value: membership.user.id, label: membership.user.name }))} />
        <SearchableOptionSelect id={`office-${intake.id}`} name="conversionOfficeId" label="Office" emptyLabel="No office selected" kind="office" total={setup.officesCount} options={setup.offices.map((office) => ({ value: office.id, label: office.name }))} />
        <SearchableOptionSelect id={`area-${intake.id}`} name="practiceAreaId" label="Practice area" emptyLabel="No practice area selected" kind="practiceArea" total={setup.practiceAreasCount} options={setup.practiceAreas.map((area) => ({ value: area.id, label: area.name }))} />
        <Field id={`reason-${intake.id}`} name="conversionReason" label="Conversion reason" required minLength={10} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Button type="submit" className="min-h-11 whitespace-nowrap" disabled={pending}>{pending ? 'Converting…' : 'Create open matter'}</Button><div className="min-h-6 text-sm">{state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'text-foreground' : 'text-destructive'}>{state.message}</p> : null}</div></div>
    </form>
  )
}

function Field({ id, name, label, required = false, defaultValue, minLength }: { id: string; name: string; label: string; required?: boolean; defaultValue?: string; minLength?: number }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={name} className="min-h-11" required={required} defaultValue={defaultValue} minLength={minLength} /></div>
}

