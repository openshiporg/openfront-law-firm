'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormSelect } from '@/components/ui/form-select'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  EmptyState,
  Pager,
  StatusDot,
  Track,
  fieldClass,
  labelClass,
  pillClass,
  pillPrimaryClass,
  statusLabel,
  statusTone,
  trackClass,
  trackItemClass,
} from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { loadConflictCheckDetail, manageConflictReview, searchConflictSources, type ConflictReviewSetup, type ConflictReviewSource, type ConflictReviewState } from '../actions/manageConflictReview'
import { shouldShowDispositionForm } from '../lib/conflictReviewState'
import { useKeptForm } from '../../components/useKeptForm'

export function ConflictReviewPanel({ setup, pageHrefs, timeZone }: { setup: ConflictReviewSetup; pageHrefs?: { previous: string | null; next: string | null }; timeZone: string }) {
  return (
    <section id="conflict-review" className="min-w-0 scroll-mt-20 space-y-3" aria-labelledby="manual-conflicts-heading">
      <h2 id="manual-conflicts-heading" className="flex min-w-0 items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
        <span className="truncate">Conflict review</span>
        <span className="lf-figures text-sm font-normal text-muted-foreground">{setup.total.toLocaleString()}</span>
      </h2>
      {!setup.conflictChecks.length ? <EmptyState title="No conflict checks awaiting work" /> : (
        <div className="space-y-4">
          {setup.conflictChecks.map((check) => <ConflictCheck key={check.id} check={check} setup={setup} timeZone={timeZone} />)}
        </div>
      )}
      {setup.pageCount > 1 && pageHrefs ? (
        <Pager label="Conflict review pages" previous={pageHrefs.previous} next={pageHrefs.next} summary={`Page ${setup.page} of ${setup.pageCount}`} />
      ) : null}
    </section>
  )
}

function ConflictCheck({ check, setup, timeZone }: { check: ConflictReviewSetup['conflictChecks'][number]; setup: ConflictReviewSetup; timeZone: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ConflictReviewState, FormData>(manageConflictReview, { ok: false, message: '' })
  const actionForm = useKeptForm(action, state)
  const [outcome, setOutcome] = useState('')
  const [extraTerms, setExtraTerms] = useState<ConflictReviewSetup['conflictChecks'][number]['terms']>([])
  const [extraMatches, setExtraMatches] = useState<ConflictReviewSetup['conflictChecks'][number]['matches']>([])
  const [sourceQuery, setSourceQuery] = useState('')
  const [sources, setSources] = useState<ConflictReviewSource[] | null>(null)
  const [detailError, setDetailError] = useState('')
  const [loading, startLoading] = useTransition()
  // A successful command changes server state: reload this check from the server so the
  // card shows its new status at once. Loaded continuation pages are dropped with it.
  // The command's own result (new status, added term) shows immediately; the server
  // copy replaces it when the refresh lands.
  const [statusOverride, setStatusOverride] = useState<string | null>(null)
  const [appliedState, setAppliedState] = useState(state)
  if (appliedState !== state) {
    setAppliedState(state)
    if (state.ok) {
      setStatusOverride(state.status ?? null)
      setExtraTerms(state.term ? [state.term] : [])
      setExtraMatches([])
    }
  }
  const [serverStatus, setServerStatus] = useState(check.status)
  if (serverStatus !== check.status) {
    setServerStatus(check.status)
    setStatusOverride(null)
  }
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])
  const status = statusOverride ?? check.status
  const terms = [...new Map([...check.terms, ...extraTerms].map((term) => [term.id, term])).values()]
  const matches = [...check.matches, ...extraMatches]

  function loadMore(part: 'terms' | 'matches') {
    setDetailError('')
    startLoading(async () => {
      const result = await loadConflictCheckDetail(check.id, part, part === 'terms' ? terms.length : matches.length)
      if (!result.success) return setDetailError(result.error)
      if (part === 'terms') setExtraTerms((current) => [...current, ...(result.terms ?? [])])
      else setExtraMatches((current) => [...current, ...(result.matches ?? [])])
    })
  }

  function findSources() {
    setDetailError('')
    startLoading(async () => {
      const result = await searchConflictSources(sourceQuery)
      if (result.success) setSources(result.data)
      else setDetailError(result.error)
    })
  }
  const heading = check.intake ? `${check.intake.intakeNumber} · ${check.intake.title}` : check.matter ? `${check.matter.matterNumber} · ${check.matter.title}` : check.checkNumber
  return (
    <article id={`conflict-${check.id}`} className="min-w-0 scroll-mt-20 overflow-hidden rounded-[6px] border border-border bg-card">
      <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 bg-[var(--lf-manila)]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <StatusDot tone={statusTone(status)} />
          <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{heading}</h3>
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">{statusLabel(status)}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{check.checkNumber}</span>
      </header>

      {detailError || state.message ? (
        <div className="space-y-1 border-b border-border px-4 py-3 text-sm">
          {detailError ? <p role="alert" className="text-destructive">{detailError}</p> : null}
          {state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'text-foreground' : 'text-destructive'}>{state.message}</p> : null}
        </div>
      ) : null}

      {setup.canRun && status !== 'review_required' ? (
        <div className="grid min-w-0 gap-4 border-b border-border bg-muted/30 px-4 py-4 xl:grid-cols-2">
          <form {...actionForm} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
            <input type="hidden" name="operation" value="term" /><input type="hidden" name="checkId" value={check.id} />
            <Field id={`term-${check.id}`} name="term" label="Search term" />
            <Select id={`term-type-${check.id}`} name="termType" label="Type" options={[['person', 'Person'], ['organization', 'Organization'], ['alias', 'Alias'], ['matter', 'Matter'], ['other', 'Other']]} />
            <Track className="justify-self-start sm:col-span-2"><button type="submit" className={pillClass} disabled={pending}>Add term</button></Track>
          </form>
          <div className="grid min-w-0 content-start gap-3">
            <div className={labelClass}>
              <label htmlFor={`source-search-${check.id}`}>Contact or matter</label>
              <div className="flex min-w-0 items-center gap-2">
                <input id={`source-search-${check.id}`} value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findSources() } }} maxLength={100} className={cn(fieldClass, 'text-foreground')} />
                <Track className="shrink-0 overflow-visible"><button type="button" className={pillClass} onClick={findSources} disabled={loading || !sourceQuery.trim()}><Search className="size-3.5" aria-hidden="true" />Find</button></Track>
              </div>
            </div>
            {sources ? (
              sources.length ? (
                <form {...actionForm} className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <input type="hidden" name="operation" value="match" /><input type="hidden" name="checkId" value={check.id} />
                  <Select id={`source-${check.id}`} name="source" label="Source" options={sources.map(source => [`${source.kind}:${source.id}`, `${source.kind} · ${source.label}`])} />
                  <Select id={`match-type-${check.id}`} name="matchType" label="Match kind" options={[["manual", "Manual"], ["exact_name", "Exact name"], ["alias", "Alias"], ["fuzzy_name", "Similar name"], ["related_party", "Related party"]]} />
                  <Track className="justify-self-start sm:col-span-2"><button type="submit" className={pillClass} disabled={pending}>Link candidate</button></Track>
                </form>
              ) : <p className="break-words text-sm text-muted-foreground">No contact or matter matches “{sourceQuery}”</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 md:grid-cols-2 md:divide-x md:divide-border">
        <div className="min-w-0 px-4 py-4">
          <ColumnHeading label="Terms" count={check.termsCount} />
          {terms.length ? (
            <ul className="mt-2 divide-y divide-border text-sm">
              {terms.map((term) => (
                <li key={term.id} className="flex min-w-0 items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-foreground">{term.term}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{term.termType}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">None</p>}
          {terms.length < check.termsCount ? <Track className="mt-3"><button type="button" className={pillClass} onClick={() => loadMore('terms')} disabled={loading}>{(check.termsCount - terms.length).toLocaleString()} more terms</button></Track> : null}
        </div>
        <div className="min-w-0 border-t border-border px-4 py-4 md:border-t-0">
          <ColumnHeading label="Candidates" count={check.matchesCount} />
          {matches.length ? (
            <ul className="mt-2 divide-y divide-border">
              {matches.map((match) => {
                const latestDisposition = match.latestDisposition?.[0]
                const source = match.matchedContact ? { label: match.matchedContact.displayName, href: `/dashboard/contacts/${match.matchedContact.id}` } : match.matchedMatter ? { label: `${match.matchedMatter.matterNumber} · ${match.matchedMatter.title}`, href: `/dashboard/platform/matters/${match.matchedMatter.id}` } : match.matchedMatterParty ? { label: 'Linked matter party', href: `/dashboard/matter-parties/${match.matchedMatterParty.id}` } : null
                const canContinueReview = setup.canResolve && !!source && shouldShowDispositionForm(status, match)
                return (
                  <li key={match.id} className="min-w-0 space-y-2 py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusDot tone={statusTone(match.status)} />
                      {source ? <Link href={source.href} className="min-w-0 truncate font-medium text-foreground underline-offset-4 hover:underline">{source.label}</Link> : <span className="min-w-0 truncate text-muted-foreground">Source unavailable</span>}
                      <span className="shrink-0 text-xs capitalize text-muted-foreground">{match.matchType.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {match.dispositionsCount > 0
                        ? latestDisposition
                          ? <>{formatDispositionOutcome(latestDisposition.outcome)} · {formatInstant(latestDisposition.decidedAt, timeZone, { missing: 'date unavailable' })} · {latestDisposition.outcome === 'needs_more_information' ? 'Further review required' : 'Final'} · {match.dispositionsCount} recorded</>
                          : <>Disposition unavailable under current source access · {match.dispositionsCount} recorded</>
                        : <>No disposition · {match.status.replaceAll('_', ' ')}</>}
                    </p>
                    {canContinueReview ? <DispositionForm checkId={check.id} match={match} form={actionForm} pending={pending} /> : null}
                  </li>
                )
              })}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">None</p>}
          {matches.length < check.matchesCount ? <Track className="mt-3"><button type="button" className={pillClass} onClick={() => loadMore('matches')} disabled={loading}>{(check.matchesCount - matches.length).toLocaleString()} more candidates</button></Track> : null}
        </div>
      </div>

      {setup.canRun && status === 'requested' ? (
        <form {...actionForm} className="border-t border-border px-4 py-3">
          <input type="hidden" name="operation" value="transition" /><input type="hidden" name="checkId" value={check.id} /><input type="hidden" name="toStatus" value="running" />
          <Track><button type="submit" className={pillPrimaryClass} disabled={pending}>Start manual review</button></Track>
        </form>
      ) : null}
      {setup.canRun && status === 'running' ? (
        <form {...actionForm} className="grid gap-3 border-t border-border px-4 py-4">
          <input type="hidden" name="operation" value="transition" /><input type="hidden" name="checkId" value={check.id} /><input type="hidden" name="toStatus" value="review_required" />
          <Field id={`completed-${check.id}`} name="summary" label="Review summary" />
          <Track className="justify-self-start"><button type="submit" className={pillPrimaryClass} disabled={pending}>Send to final review</button></Track>
        </form>
      ) : null}
      {setup.canResolve && status === 'review_required' ? (
        <form {...actionForm} className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
          <input type="hidden" name="operation" value="finalize" /><input type="hidden" name="checkId" value={check.id} />
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Outcome</legend>
            <div role="radiogroup" aria-required="true" className={trackClass}>
              {([['cleared', 'Cleared'], ['conflict_found', 'Conflict found']] as const).map(([value, text]) => (
                <label key={value} className={cn(trackItemClass(outcome === value), 'cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50')}>
                  <input type="radio" name="outcome" value={value} required checked={outcome === value} onChange={() => setOutcome(value)} className="sr-only" />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id={`summary-${check.id}`} name="summary" label="Final summary" />
          <Track className="justify-self-start sm:col-span-2"><button type="submit" className={pillPrimaryClass} disabled={pending || !outcome}>Record final review</button></Track>
        </form>
      ) : null}
    </article>
  )
}

function ColumnHeading({ label, count }: { label: string; count: number }) {
  return (
    <h4 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}<span className="font-mono font-normal tabular-nums">{count.toLocaleString()}</span>
    </h4>
  )
}

function DispositionForm({ checkId, match, form, pending }: { checkId: string; match: ConflictReviewSetup['conflictChecks'][number]['matches'][number]; form: ReturnType<typeof useKeptForm>; pending: boolean }) {
  return (
    <form {...form} className="grid min-w-0 gap-3 rounded-[4px] border border-border bg-background p-3">
      <input type="hidden" name="operation" value="disposition" /><input type="hidden" name="checkId" value={checkId} /><input type="hidden" name="matchId" value={match.id} />
      <p className="truncate text-xs font-semibold text-foreground">{match.dispositionsCount > 0 ? 'Follow-up decision' : 'First decision'}</p>
      <Select id={`outcome-${match.id}`} name="outcome" label="Disposition" options={[['clear', 'Clear'], ['conflict', 'Conflict'], ['needs_more_information', 'Needs more information'], ['approved_exception', 'Approved exception']]} />
      <Field id={`rationale-${match.id}`} name="rationale" label="Rationale" />
      <Track className="justify-self-start"><button type="submit" className={pillClass} disabled={pending}>Record disposition</button></Track>
    </form>
  )
}

const dispositionLabels: Record<string, string> = {
  clear: 'Clear',
  conflict: 'Conflict',
  needs_more_information: 'Needs more information',
  approved_exception: 'Approved exception',
}

function formatDispositionOutcome(outcome: string) {
  return dispositionLabels[outcome] ?? 'Disposition recorded'
}

function Field({ id, name, label }: { id: string; name: string; label: string }) {
  return <label htmlFor={id} className={labelClass}>{label}<input id={id} name={name} className={fieldClass} required /></label>
}

function Select({ id, name, label, options }: { id: string; name: string; label: string; options: string[][] }) {
  return (
    <div className={labelClass}>
      <label htmlFor={id}>{label}</label>
      <FormSelect id={id} name={name} className={cn(fieldClass, 'text-foreground')}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</FormSelect>
    </div>
  )
}
