'use client'

import { useActionState, useState, useTransition } from 'react'
import Link from 'next/link'
import { FormSelect } from '@/components/ui/form-select'
import { Search, SearchCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { loadConflictCheckDetail, manageConflictReview, searchConflictSources, type ConflictReviewSetup, type ConflictReviewSource, type ConflictReviewState } from '../actions/manageConflictReview'
import { shouldShowDispositionForm } from '../lib/conflictReviewState'

export function ConflictReviewPanel({ setup, pageHrefs }: { setup: ConflictReviewSetup; pageHrefs?: { previous: string | null; next: string | null } }) {
  return (
    <section id="conflict-review" className="scroll-mt-20 border-y border-border py-5" aria-labelledby="manual-conflicts-heading">
      <div className="flex items-start gap-3 px-1"><SearchCheck className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" /><div><h2 id="manual-conflicts-heading" className="text-base font-bold text-foreground">Conflict review · {setup.total.toLocaleString()}</h2><p className="mt-1 text-sm text-muted-foreground">Manual source review</p></div></div>
      {!setup.conflictChecks.length ? <p className="mt-4 border-y border-dashed border-border px-3 py-6 text-sm text-muted-foreground">No conflict check is awaiting work.</p> : (
        <div className="mt-5 divide-y divide-border border-y border-border">
          {setup.conflictChecks.map((check) => <ConflictCheck key={check.id} check={check} setup={setup} />)}
        </div>
      )}
      {setup.pageCount > 1 && pageHrefs ? (
        <nav aria-label="Conflict review pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">Page {setup.page} of {setup.pageCount}</p>
          <div className="flex gap-2">
            {pageHrefs.previous ? <Link href={pageHrefs.previous} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Previous</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Previous</span>}
            {pageHrefs.next ? <Link href={pageHrefs.next} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Next</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Next</span>}
          </div>
        </nav>
      ) : null}
    </section>
  )
}

function ConflictCheck({ check, setup }: { check: ConflictReviewSetup['conflictChecks'][number]; setup: ConflictReviewSetup }) {
  const [state, action, pending] = useActionState<ConflictReviewState, FormData>(manageConflictReview, { ok: false, message: '' })
  const [extraTerms, setExtraTerms] = useState<ConflictReviewSetup['conflictChecks'][number]['terms']>([])
  const [extraMatches, setExtraMatches] = useState<ConflictReviewSetup['conflictChecks'][number]['matches']>([])
  const [sourceQuery, setSourceQuery] = useState('')
  const [sources, setSources] = useState<ConflictReviewSource[] | null>(null)
  const [detailError, setDetailError] = useState('')
  const [loading, startLoading] = useTransition()
  const terms = [...check.terms, ...extraTerms]
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
  return (
    <article id={`conflict-${check.id}`} className="space-y-4 px-2 py-5">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{check.checkNumber}</span><PracticeStatus status={check.status} /><h3 className="min-w-0 truncate text-sm font-bold text-foreground">{check.intake ? `${check.intake.intakeNumber} · ${check.intake.title}` : check.matter ? `${check.matter.matterNumber} · ${check.matter.title}` : check.checkNumber}</h3></div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {setup.canRun && check.status !== 'review_required' ? (
          <>
            <form action={action} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
              <input type="hidden" name="operation" value="term" /><input type="hidden" name="checkId" value={check.id} />
              <Field id={`term-${check.id}`} name="term" label="Additional search term" />
              <Select id={`term-type-${check.id}`} name="termType" label="Type" options={[['person', 'Person'], ['organization', 'Organization'], ['alias', 'Alias'], ['matter', 'Matter'], ['other', 'Other']]} />
              <Button type="submit" variant="outline" className="min-h-11 whitespace-nowrap" disabled={pending}>Add term</Button>
            </form>
            <div className="grid gap-3 border-t border-border pt-3">
              <div className="space-y-2">
                <Label htmlFor={`source-search-${check.id}`}>Find a contact or matter</Label>
                <div className="flex gap-2">
                  <Input id={`source-search-${check.id}`} value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findSources() } }} maxLength={100} className="min-h-11" />
                  <Button type="button" variant="outline" className="min-h-11" onClick={findSources} disabled={loading || !sourceQuery.trim()}><Search className="h-4 w-4" aria-hidden="true" />Find</Button>
                </div>
              </div>
              {sources ? (
                sources.length ? (
                  <form action={action} className="grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="operation" value="match" /><input type="hidden" name="checkId" value={check.id} />
                    <Select id={`source-${check.id}`} name="source" label="Current source" options={sources.map(source => [`${source.kind}:${source.id}`, `${source.kind} · ${source.label}`])} />
                    <Select id={`match-type-${check.id}`} name="matchType" label="Match kind" options={[["manual", "Manual"], ["exact_name", "Exact name"], ["alias", "Alias"], ["fuzzy_name", "Similar name"], ["related_party", "Related party"]]} />
                    <Button type="submit" variant="outline" disabled={pending}>Link source candidate</Button>
                  </form>
                ) : <p className="text-sm text-muted-foreground">No authorized contact or matter matches “{sourceQuery}”.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="font-semibold text-foreground">Terms · {check.termsCount.toLocaleString()}</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">{terms.map((term) => <li key={term.id} className="truncate">{term.term} · {term.termType}</li>)}</ul>
          {terms.length < check.termsCount ? <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => loadMore('terms')} disabled={loading}>Show more terms ({(check.termsCount - terms.length).toLocaleString()} more)</Button> : null}
        </div>
        <div>
          <p className="font-semibold text-foreground">Candidates · {check.matchesCount.toLocaleString()}</p>
          <div className="mt-2 space-y-3">
            {matches.map((match) => {
              const latestDisposition = match.latestDisposition?.[0]
              const source = match.matchedContact ? { label: match.matchedContact.displayName, href: `/dashboard/contacts/${match.matchedContact.id}` } : match.matchedMatter ? { label: `${match.matchedMatter.matterNumber} · ${match.matchedMatter.title}`, href: `/dashboard/platform/matters/${match.matchedMatter.id}` } : match.matchedMatterParty ? { label: 'Linked matter party', href: `/dashboard/matter-parties/${match.matchedMatterParty.id}` } : null
              const canContinueReview = setup.canResolve && !!source && shouldShowDispositionForm(check.status, match)
              return (
                <div key={match.id} className="space-y-3 border-t border-border pt-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-foreground">{match.matchType.replaceAll('_', ' ')}</p>
                    {source ? <Link href={source.href} className="inline-flex min-h-11 items-center underline">{source.label}</Link> : <p className="text-muted-foreground">Source unavailable</p>}
                    {match.dispositionsCount > 0 ? (
                      <>
                        <p className="text-muted-foreground">Disposition history · {match.dispositionsCount} recorded; showing latest</p>
                        {latestDisposition ? (
                          <>
                            <p className="text-muted-foreground">
                              Latest: {formatDispositionOutcome(latestDisposition.outcome)} · {formatDecisionDate(latestDisposition.decidedAt)}
                            </p>
                            <p className="text-muted-foreground">
                              {latestDisposition.outcome === 'needs_more_information'
                                ? 'Further review required.'
                                : 'Final disposition recorded.'}
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">Disposition unavailable under current source access.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">No disposition recorded · {match.status.replaceAll('_', ' ')}</p>
                    )}
                  </div>
                  {canContinueReview ? <DispositionForm checkId={check.id} match={match} action={action} pending={pending} /> : null}
                </div>
              )
            })}
            {matches.length < check.matchesCount ? <Button type="button" variant="outline" className="min-h-11" onClick={() => loadMore('matches')} disabled={loading}>Show more candidates ({(check.matchesCount - matches.length).toLocaleString()} more)</Button> : null}
          </div>
        </div>
      </div>
      {detailError ? <p role="alert" className="text-sm text-destructive">{detailError}</p> : null}
      {setup.canRun && check.status === 'requested' ? <form action={action}><input type="hidden" name="operation" value="transition" /><input type="hidden" name="checkId" value={check.id} /><input type="hidden" name="toStatus" value="running" /><Button type="submit" variant="outline" disabled={pending}>Start manual review</Button></form> : null}
      {setup.canRun && check.status === 'running' ? <form action={action} className="grid gap-3 border-t pt-3"><input type="hidden" name="operation" value="transition" /><input type="hidden" name="checkId" value={check.id} /><input type="hidden" name="toStatus" value="review_required" /><Field id={`completed-${check.id}`} name="summary" label="Completed review summary" minLength={10} /><Button type="submit" disabled={pending} className="justify-self-start">Send to final review</Button></form> : null}
      {setup.canResolve && check.status === 'review_required' ? <form action={action} className="grid gap-3 border-t pt-3"><input type="hidden" name="operation" value="finalize" /><input type="hidden" name="checkId" value={check.id} /><Select id={`final-${check.id}`} name="outcome" label="Review outcome" options={[["cleared", "Cleared"], ["conflict_found", "Conflict found"]]} /><Field id={`summary-${check.id}`} name="summary" label="Final review summary" minLength={10} /><Button type="submit" disabled={pending} className="justify-self-start">Record final review</Button></form> : null}
      <div className="min-h-6 text-sm">{state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'text-foreground' : 'text-destructive'}>{state.message}</p> : null}</div>
    </article>
  )
}

function DispositionForm({ checkId, match, action, pending }: { checkId: string; match: ConflictReviewSetup['conflictChecks'][number]['matches'][number]; action: (payload: FormData) => void; pending: boolean }) {
  return <form action={action} className="grid gap-2 border-t border-border pt-3"><input type="hidden" name="operation" value="disposition" /><input type="hidden" name="checkId" value={checkId} /><input type="hidden" name="matchId" value={match.id} /><p className="truncate font-semibold text-foreground">{match.dispositionsCount > 0 ? 'Follow-up decision' : 'First decision'}</p><Select id={`outcome-${match.id}`} name="outcome" label="Disposition" options={[['clear', 'Clear'], ['conflict', 'Conflict'], ['needs_more_information', 'Needs more information'], ['approved_exception', 'Approved exception']]} /><Field id={`rationale-${match.id}`} name="rationale" label="Rationale" minLength={10} /><Button type="submit" variant="outline" className="min-h-11 whitespace-nowrap justify-self-start" disabled={pending}>Record disposition</Button></form>
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

function formatDecisionDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'date unavailable' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function Field({ id, name, label, minLength }: { id: string; name: string; label: string; minLength?: number }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={name} className="min-h-11" required minLength={minLength} /></div> }
function Select({ id, name, label, options }: { id: string; name: string; label: string; options: string[][] }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><FormSelect id={id} name={name} className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</FormSelect></div> }
