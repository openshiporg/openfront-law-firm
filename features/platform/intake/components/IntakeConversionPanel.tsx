'use client'

import { useActionState } from 'react'

import { EmptyState, Pager, Track, fieldClass, labelClass, pillPrimaryClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { convertIntake, type IntakeSetup, type IntakeStartState } from '../actions/startIntake'

export function IntakeConversionPanel({ setup, pageHrefs }: { setup: IntakeSetup; pageHrefs?: { previous: string | null; next: string | null } }) {
  return (
    <section id="intake-conversion" className="min-w-0 scroll-mt-20 space-y-3" aria-labelledby="conversion-heading">
      <h2 id="conversion-heading" className="flex min-w-0 items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
        <span className="truncate">Open matter from cleared intake</span>
        <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{setup.decisionIntakesCount.toLocaleString()}</span>
      </h2>
      {!setup.decisionIntakes.length ? <EmptyState title="No intake ready for conversion" /> : (
        <div className="space-y-4">
          {setup.decisionIntakes.map((intake) => <ConversionForm key={intake.id} intake={intake} setup={setup} />)}
        </div>
      )}
      {setup.decisionPageCount > 1 && pageHrefs ? (
        <Pager label="Decision-stage intake pages" previous={pageHrefs.previous} next={pageHrefs.next} summary={`Page ${setup.decisionPage} of ${setup.decisionPageCount}`} />
      ) : null}
    </section>
  )
}

function ConversionForm({ intake, setup }: { intake: IntakeSetup['decisionIntakes'][number]; setup: IntakeSetup }) {
  const [state, action, pending] = useActionState<IntakeStartState, FormData>(convertIntake, { ok: false, message: '' })
  return (
    <form action={action} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <input type="hidden" name="intakeId" value={intake.id} />
      <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{intake.title}</h3>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{intake.primaryContact.displayName}</span>
        <span className="font-mono text-xs text-muted-foreground">{intake.intakeNumber}</span>
      </header>
      <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field id={`number-${intake.id}`} name="matterNumber" label="Matter number" required />
        <Field id={`title-${intake.id}`} name="matterTitle" label="Matter title" required defaultValue={intake.title} />
        <SearchableOptionSelect id={`attorney-${intake.id}`} name="responsibleAttorneyId" label="Responsible attorney" required kind="member" total={setup.membershipsCount} options={setup.memberships.map((membership) => ({ value: membership.user.id, label: membership.user.name }))} />
        <SearchableOptionSelect id={`office-${intake.id}`} name="conversionOfficeId" label="Office" emptyLabel="No office selected" kind="office" total={setup.officesCount} options={setup.offices.map((office) => ({ value: office.id, label: office.name }))} />
        <SearchableOptionSelect id={`area-${intake.id}`} name="practiceAreaId" label="Practice area" emptyLabel="No practice area selected" kind="practiceArea" total={setup.practiceAreasCount} options={setup.practiceAreas.map((area) => ({ value: area.id, label: area.name }))} />
        <Field id={`reason-${intake.id}`} name="conversionReason" label="Conversion reason" required minLength={10} />
      </div>
      <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
        <Track><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Converting…' : 'Create open matter'}</button></Track>
        {state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'min-w-0 break-words text-sm text-foreground' : 'min-w-0 break-words text-sm text-destructive'}>{state.message}</p> : null}
      </footer>
    </form>
  )
}

function Field({ id, name, label, required = false, defaultValue, minLength }: { id: string; name: string; label: string; required?: boolean; defaultValue?: string; minLength?: number }) {
  return <label htmlFor={id} className={labelClass}>{label}<input id={id} name={name} className={fieldClass} required={required} defaultValue={defaultValue} minLength={minLength} /></label>
}
