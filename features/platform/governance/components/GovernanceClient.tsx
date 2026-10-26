'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { EmptyState, Notice, Panel, RowList, TitleLine, Track, fieldClass, labelClass, pillClass, pillDangerClass, pillPrimaryClass, statusLabel, textareaClass, trackItemClass } from '@/features/platform/components/ui'

import {
  createRetentionPolicy,
  placeHold,
  searchHoldTargets,
  transitionPolicy,
  type GovernanceActionState,
  type GovernanceSetup,
  type HoldTargetKind,
  type HoldTargetOption,
  type RetentionPolicyRow,
} from '../actions/governance'
import { useKeptForm } from '../../components/useKeptForm'

const initial: GovernanceActionState = { ok: false, message: '' }

const recordClasses: Array<[string, string]> = [
  ['matter', 'Matter'], ['document', 'Document'], ['communication', 'Communication'], ['billing', 'Billing'],
  ['contact', 'Contact'], ['audit', 'Audit'], ['other', 'Other'],
]
const triggers: Array<[string, string]> = [
  ['matter_closed', 'Matter closed'], ['document_archived', 'Document archived'], ['record_created', 'Record created'], ['manual', 'Manual'],
]
const label = (options: Array<[string, string]>, value: string) => options.find(([key]) => key === value)?.[1] ?? statusLabel(value)

function Message({ state }: { state: GovernanceActionState }) {
  if (!state.message) return null
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

function useRefreshingAction(action: (previous: GovernanceActionState, formData: FormData) => Promise<GovernanceActionState>, onOk?: () => void) {
  const router = useRouter()
  return useActionState(async (previous: GovernanceActionState, formData: FormData) => {
    const result = await action(previous, formData)
    if (result.ok) { onOk?.(); router.refresh() }
    return result
  }, initial)
}

function NewPolicyForm({ practiceAreas, onDone }: { practiceAreas: GovernanceSetup['practiceAreas']; onDone: () => void }) {
  const [state, run, pending] = useRefreshingAction(createRetentionPolicy, onDone)
  const runForm = useKeptForm(run, state)
  return (
    <form {...runForm} className="min-w-0 rounded-[6px] border border-border">
      <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">New retention policy</legend>
        <label className={labelClass}>Name<input name="name" required minLength={2} maxLength={200} autoComplete="off" className={fieldClass} /></label>
        <label className={labelClass}>Code<input name="code" required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,63}" autoComplete="off" className={cn(fieldClass, 'font-mono')} /></label>
        <div className={labelClass}>
          <label htmlFor="policy-record-class">Record class</label>
          <FormSelect id="policy-record-class" name="recordClass" required defaultValue="matter" className={cn(fieldClass, 'text-foreground')}>
            {recordClasses.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </FormSelect>
        </div>
        <div className={labelClass}>
          <label htmlFor="policy-trigger">Trigger</label>
          <FormSelect id="policy-trigger" name="trigger" required defaultValue="matter_closed" className={cn(fieldClass, 'text-foreground')}>
            {triggers.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </FormSelect>
        </div>
        <label className={labelClass}>Retention days<input name="retentionDays" required inputMode="numeric" pattern="\d{1,6}" autoComplete="off" className={cn(fieldClass, 'text-right font-mono tabular-nums')} /></label>
        <div className={labelClass}>
          <label htmlFor="policy-practice-area">Practice area</label>
          <FormSelect id="policy-practice-area" name="practiceAreaId" defaultValue="" aria-label="practice area" className={cn(fieldClass, 'text-foreground')}>
            <option value="">All practice areas</option>
            {practiceAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </FormSelect>
        </div>
        <label className={cn(labelClass, 'sm:col-span-2')}>Jurisdiction reference<input name="jurisdictionReference" maxLength={1000} autoComplete="off" className={fieldClass} /></label>
        <label className={cn(labelClass, 'sm:col-span-2')}>Description<textarea name="description" maxLength={4000} rows={3} className={textareaClass} /></label>
        <Notice className="sm:col-span-2">Policy terms lock once the policy is activated.</Notice>
      </fieldset>
      <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
        <Track><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Creating…' : 'Create draft policy'}</button></Track>
        <Message state={state} />
      </footer>
    </form>
  )
}

function PolicyTransitions({ policy }: { policy: RetentionPolicyRow }) {
  const [target, setTarget] = useState<'active' | 'retired' | null>(null)
  const [state, run, pending] = useRefreshingAction(transitionPolicy, () => setTarget(null))
  const runForm = useKeptForm(run, state)
  const options: Array<'active' | 'retired'> = policy.status === 'draft' ? ['active', 'retired'] : policy.status === 'active' ? ['retired'] : []
  if (!options.length) return null
  return (
    <div className="grid min-w-0 gap-2">
      <Track label={`Change ${policy.name}`}>
        {options.map((value) => (
          <button key={value} type="button" aria-pressed={target === value} className={value === 'retired' ? pillDangerClass : target === value ? pillPrimaryClass : pillClass} onClick={() => setTarget(target === value ? null : value)}>
            {value === 'active' ? 'Activate' : 'Retire'}
          </button>
        ))}
      </Track>
      {target ? (
        <form {...runForm} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="policyId" value={policy.id} />
          <input type="hidden" name="toStatus" value={target} />
          <label className={cn(labelClass, 'flex-1')}>Reason<input name="reason" required minLength={5} maxLength={2000} autoComplete="off" className={fieldClass} /></label>
          <Track><button type="submit" className={target === 'retired' ? pillDangerClass : pillPrimaryClass} disabled={pending}>{pending ? 'Saving…' : target === 'active' ? 'Confirm activation' : 'Confirm retirement'}</button></Track>
        </form>
      ) : null}
      <Message state={state} />
    </div>
  )
}

export function RetentionPolicyManager({ setup }: { setup: GovernanceSetup }) {
  const [creating, setCreating] = useState(false)
  return (
    <Panel
      id="retention-policies"
      title="Retention policies"
      actions={<Track><button type="button" className={creating ? pillClass : pillPrimaryClass} aria-expanded={creating} onClick={() => setCreating((value) => !value)}>{creating ? 'Close' : 'New policy'}</button></Track>}
    >
      <div className="grid min-w-0 gap-4">
        {creating ? <NewPolicyForm practiceAreas={setup.practiceAreas} onDone={() => setCreating(false)} /> : null}
        {setup.policies.length === 0 ? <EmptyState title="No retention policies" /> : (
          <RowList label="Retention policies">
            {setup.policies.map((policy) => (
              <li key={policy.id} className="grid min-w-0 gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <TitleLine as="h3" status={policy.status} headingClassName="text-sm">{policy.name}</TitleLine>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{policy.code}</span>
                </div>
                <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {label(recordClasses, policy.recordClass)} · {label(triggers, policy.trigger)} + {policy.retentionDays.toLocaleString()} days · {policy.practiceArea?.name ?? 'All practice areas'} · {policy.documentsCount} documents · {policy.holdsCount} holds
                  {policy.jurisdictionReference ? ` · ${policy.jurisdictionReference}` : ''}
                </p>
                {policy.description ? <p className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">{policy.description}</p> : null}
                <PolicyTransitions policy={policy} />
              </li>
            ))}
          </RowList>
        )}
      </div>
    </Panel>
  )
}

const targetKinds: Array<[HoldTargetKind, string]> = [['matter', 'Matter'], ['document', 'Document'], ['contact', 'Contact']]

function TargetPicker({ kind }: { kind: HoldTargetKind }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<HoldTargetOption[]>([])
  const [value, setValue] = useState('')
  const [message, setMessage] = useState('')
  const [searching, startSearch] = useTransition()
  const revision = useRef(0)

  function search(text: string) {
    const current = ++revision.current
    setMessage('')
    startSearch(async () => {
      const result = await searchHoldTargets(kind, text)
      if (current !== revision.current) return
      if (!result.success) { setMessage(result.error); return }
      setOptions((previous) => {
        const selected = previous.filter((option) => option.value === value)
        return [...new Map([...selected, ...result.data].map((option) => [option.value, option])).values()]
      })
      if (!result.data.length) setMessage('No match')
    })
  }

  // The picker remounts per target type (keyed by kind), so the first page loads once.
  useEffect(() => {
    const current = ++revision.current
    startSearch(async () => {
      const result = await searchHoldTargets(kind, '')
      if (current !== revision.current) return
      if (!result.success) { setMessage(result.error); return }
      setOptions(result.data)
    })
  }, [kind])

  const title = targetKinds.find(([key]) => key === kind)?.[1] ?? 'Target'
  return (
    <div className="grid min-w-0 gap-1.5 sm:col-span-2">
      <label htmlFor="hold-target" className="text-xs font-medium text-muted-foreground">{title}</label>
      <FormSelect id="hold-target" name="targetId" required value={value} onValueChange={setValue} className={fieldClass}>
        <option value="" disabled>{searching && !options.length ? 'Loading…' : `Select ${title.toLowerCase()}`}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </FormSelect>
      <div className="flex min-w-0 items-center gap-2">
        <input
          aria-label={`Search ${title.toLowerCase()}s`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(query) } }}
          maxLength={100}
          placeholder="Search"
          className={cn(fieldClass, 'rounded-[4px]')}
        />
        <Track className="shrink-0">
          <button type="button" className={trackItemClass(true)} onClick={() => search(query)} disabled={searching}><Search className="size-3.5" aria-hidden="true" />Find</button>
        </Track>
      </div>
      {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}

export function LegalHoldForm({ policies }: { policies: Array<{ id: string; label: string }> }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<HoldTargetKind>('matter')
  const [formKey, setFormKey] = useState(0)
  const [state, run, pending] = useRefreshingAction(placeHold, () => setFormKey((value) => value + 1))
  const runForm = useKeptForm(run, state)
  return (
    <Panel
      id="place-hold"
      title="Legal hold"
      actions={<Track><button type="button" className={open ? pillClass : pillPrimaryClass} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Close' : 'Place legal hold'}</button></Track>}
    >
      {open ? (
        <form key={formKey} {...runForm} className="grid min-w-0 gap-4">
          <input type="hidden" name="targetKind" value={kind} />
          <div className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Hold covers</span>
            <Track label="Hold target type">
              {targetKinds.map(([value, text]) => (
                <button key={value} type="button" aria-pressed={kind === value} className={trackItemClass(kind === value)} onClick={() => setKind(value)}>{text}</button>
              ))}
            </Track>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <TargetPicker key={kind} kind={kind} />
            <div className={cn(labelClass, 'sm:col-span-2')}>
              <label htmlFor="hold-policy">Policy</label>
              <FormSelect id="hold-policy" name="policyId" defaultValue="" aria-label="policy" className={cn(fieldClass, 'text-foreground')}>
                <option value="">No policy</option>
                {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.label}</option>)}
              </FormSelect>
            </div>
            <label className={cn(labelClass, 'sm:col-span-2')}>Name<input name="name" required minLength={3} maxLength={300} autoComplete="off" className={fieldClass} /></label>
            <label className={cn(labelClass, 'sm:col-span-2')}>Reason<textarea name="reason" required minLength={10} maxLength={4000} rows={3} className={textareaClass} /></label>
            <label className={cn(labelClass, 'sm:col-span-2')}>Authority reference<input name="authorityReference" maxLength={1000} autoComplete="off" placeholder="Litigation, subpoena or regulator reference" className={fieldClass} /></label>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Track><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Placing…' : 'Place hold'}</button></Track>
            <Message state={state} />
          </div>
        </form>
      ) : (
        state.message ? <Message state={state} /> : <p className="text-sm text-muted-foreground">Active holds are listed below.</p>
      )}
    </Panel>
  )
}
