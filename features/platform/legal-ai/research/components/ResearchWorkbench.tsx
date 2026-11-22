'use client'

/* Matter research desk: find authority on the official free sources, attach it (the
 * server reads it from the publisher), and write notes whose every statement links to
 * the exact retrieved paragraph. A statement without a paragraph reads "unsupported". */
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookMarked, ExternalLink, FileText, Gavel, Landmark, Quote, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Panel, RowList, Track, fieldClass, labelClass, pillClass, pillPrimaryClass, textareaClass } from '@/features/platform/components/ui'
import { parseNoteBody } from '@/features/keystone/lib/legal-sources/parse'

import {
  attachAuthority,
  saveNote,
  searchAuthority,
  type AttachState,
  type NoteState,
  type ResearchNoteRecord,
  type ResearchParagraph,
  type ResearchSource,
  type SearchState,
} from '../actions/research'

const providerName: Record<string, string> = {
  maine_statutes: 'Maine Legislature',
  ecfr: 'eCFR',
  maine_law_court: 'Maine Judicial Branch',
  courtlistener: 'CourtListener',
}

const kindIcon = { statute: Landmark, regulation: BookMarked, judgment: Gavel } as const

type CitedParagraph = ResearchParagraph & { source: ResearchSource }
type Draft = { noteId: string; title: string; body: string }

const paragraphDomId = (id: string) => `para-${id}`

function dateLabel(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })
}

function Message({ ok, text }: { ok: boolean; text?: string }) {
  if (!text) return null
  return <p role={ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', ok ? 'text-foreground' : 'text-destructive')}>{text}</p>
}

/** Opens the source holding the paragraph named in the URL hash and brings it into view. */
function useHashFocus() {
  useEffect(() => {
    const focus = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id.startsWith('para-')) return
      const element = document.getElementById(id)
      if (!element) return
      const details = element.closest('details')
      if (details && !details.open) details.open = true
      requestAnimationFrame(() => element.scrollIntoView({ block: 'center' }))
    }
    focus()
    window.addEventListener('hashchange', focus)
    return () => window.removeEventListener('hashchange', focus)
  }, [])
}

export function ResearchWorkbench({ matterId, sources, notes, canManage }: { matterId: string; sources: ResearchSource[]; notes: ResearchNoteRecord[]; canManage: boolean }) {
  useHashFocus()
  const paragraphs = useMemo(() => {
    const map = new Map<string, CitedParagraph>()
    for (const source of sources) for (const paragraph of source.paragraphs) map.set(paragraph.id, { ...paragraph, source })
    return map
  }, [sources])
  const editor = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState<Draft>({ noteId: '', title: '', body: '' })

  const cite = (id: string) => {
    const area = editor.current
    const token = ` [[cite:${id}]]`
    const start = area ? area.selectionStart ?? draft.body.length : draft.body.length
    const end = area ? area.selectionEnd ?? start : start
    setDraft((current) => ({ ...current, body: `${current.body.slice(0, start)}${token}${current.body.slice(end)}` }))
    if (area) {
      requestAnimationFrame(() => {
        area.focus()
        area.setSelectionRange(start + token.length, start + token.length)
        area.scrollIntoView({ block: 'center' })
      })
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      {canManage ? <AuthoritySearch matterId={matterId} attached={sources} /> : null}

      <section aria-labelledby="authorities-heading" className="min-w-0 space-y-3">
        <h2 id="authorities-heading" className="flex items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
          Authorities on this matter <span className="lf-figures text-sm font-normal text-muted-foreground">{sources.length}</span>
        </h2>
        {!sources.length ? (
          <p className="text-sm text-muted-foreground">No authority retrieved yet. Search by citation; the text is read from the official publisher.</p>
        ) : (
          <div className="min-w-0 space-y-3">
            {sources.map((source) => <SourceBlock key={source.id} source={source} onCite={canManage ? cite : undefined} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="notes-heading" className="min-w-0 space-y-3">
        <h2 id="notes-heading" className="flex items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
          Research notes <span className="lf-figures text-sm font-normal text-muted-foreground">{notes.length}</span>
        </h2>
        {notes.map((note) => (
          <NoteView
            key={note.id}
            note={note}
            paragraphs={paragraphs}
            onEdit={canManage ? () => {
              setDraft({ noteId: note.id, title: note.title, body: note.body })
              requestAnimationFrame(() => editor.current?.scrollIntoView({ block: 'center' }))
            } : undefined}
          />
        ))}
        {canManage ? <NoteEditor matterId={matterId} draft={draft} setDraft={setDraft} editor={editor} paragraphs={paragraphs} hasSources={sources.length > 0} /> : null}
      </section>
    </div>
  )
}

function AuthoritySearch({ matterId, attached }: { matterId: string; attached: ResearchSource[] }) {
  const router = useRouter()
  const [search, runSearch, searching] = useActionState<SearchState, FormData>(searchAuthority, { query: '', candidates: [], notices: [] })
  const [attach, runAttach, attaching] = useActionState<AttachState, FormData>(async (previous, formData) => {
    const result = await attachAuthority(previous, formData)
    if (result.ok) router.refresh()
    return result
  }, { ok: true, message: '' })
  const attachedCitations = new Set(attached.map((source) => source.citation))
  return (
    <Panel
      title={<h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground"><Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Find official authority</h2>}
      bodyClassName="space-y-3"
    >
      <form action={runSearch} role="search" aria-label="Search official legal sources" className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <input
          name="q"
          type="search"
          defaultValue={search.query}
          maxLength={120}
          aria-label="Citation or case name"
          placeholder="19-A M.R.S. § 1657 · 2024 ME 9 · 45 CFR 309.105"
          className={cn(fieldClass, 'sm:flex-1')}
        />
        <Track><button type="submit" className={pillPrimaryClass} disabled={searching}>{searching ? 'Searching…' : 'Search'}</button></Track>
      </form>
      <p className="text-xs leading-5 text-muted-foreground">Maine Revised Statutes (Maine Legislature), Maine Law Court opinions (Maine Judicial Branch) and the Code of Federal Regulations (eCFR). The text is read from the publisher when you attach it.</p>
      {search.error ? <p role="alert" className="text-sm text-destructive">{search.error}</p> : null}
      {search.notices.map((notice) => <p key={notice} className="text-xs text-muted-foreground">{notice}</p>)}
      {search.candidates.length ? (
        <RowList label="Official sources found">
          {search.candidates.map((candidate) => {
            const Icon = kindIcon[candidate.kind as keyof typeof kindIcon] ?? FileText
            const already = attachedCitations.has(candidate.citation)
            return (
              <li key={`${candidate.provider}:${candidate.reference}`} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 break-words">{candidate.citation}</span>
                  </p>
                  {candidate.title && candidate.title !== candidate.citation ? <p className="mt-0.5 break-words pl-6 text-xs text-foreground/80">{candidate.title}</p> : null}
                  <p className="mt-0.5 break-words pl-6 text-xs text-muted-foreground">{providerName[candidate.provider]} · {candidate.detail}</p>
                </div>
                <form action={runAttach} className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                  <input type="hidden" name="matterId" value={matterId} />
                  <input type="hidden" name="provider" value={candidate.provider} />
                  <input type="hidden" name="reference" value={candidate.reference} />
                  <a href={candidate.officialUrl} target="_blank" rel="noreferrer" className={pillClass}>Official<ExternalLink className="size-3.5" aria-hidden="true" /></a>
                  <button type="submit" className={pillPrimaryClass} disabled={attaching}>{attaching ? 'Reading…' : already ? 'Re-read' : 'Attach'}</button>
                </form>
              </li>
            )
          })}
        </RowList>
      ) : null}
      <Message ok={attach.ok} text={attach.message} />
    </Panel>
  )
}

function SourceBlock({ source, onCite }: { source: ResearchSource; onCite?: (id: string) => void }) {
  const Icon = kindIcon[source.kind as keyof typeof kindIcon] ?? FileText
  const meta = [
    source.court || null,
    source.decidedOn ? `Decided ${source.decidedOn}` : null,
    source.sourceAsOf ? `Publisher data as of ${source.sourceAsOf}` : null,
    `Retrieved ${dateLabel(source.retrievedAt)}${source.retrievedBy?.name ? ` by ${source.retrievedBy.name}` : ''}`,
  ].filter(Boolean)
  return (
    <details id={`source-${source.id}`} className="group min-w-0 overflow-hidden rounded-[6px] border border-border bg-card">
      <summary className="flex min-w-0 cursor-pointer list-none items-start gap-3 bg-[var(--lf-manila)] px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-foreground">{source.citation}</span>
          {source.kind !== 'judgment' ? <span className="mt-0.5 block break-words text-xs text-foreground/80">{source.title}</span> : null}
          <span className="mt-0.5 block break-words text-xs text-muted-foreground">{providerName[source.provider]} · {source.jurisdiction} · {source.paragraphCount} paragraphs</span>
        </span>
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-xs font-medium text-muted-foreground group-open:hidden">Read</span>
        <span aria-hidden="true" className="mt-0.5 hidden shrink-0 text-xs font-medium text-muted-foreground group-open:inline">Close</span>
      </summary>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <a href={source.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
          Official text<ExternalLink className="size-3" aria-hidden="true" />
        </a>
        {meta.map((item) => <span key={item}>{item}</span>)}
        <span className="font-mono" title={`SHA-256 of the retrieved paragraphs: ${source.contentSha256}`}>sha256 {source.contentSha256.slice(0, 12)}</span>
      </div>
      <ol className="min-w-0 divide-y divide-border border-t border-border">
        {source.paragraphs.map((paragraph) => (
          <li
            key={paragraph.id}
            id={paragraphDomId(paragraph.id)}
            className="grid min-w-0 scroll-mt-24 grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 target:bg-amber-400/15 target:shadow-[inset_3px_0_0_rgb(217_119_6)] sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
          >
            <a href={`#${paragraphDomId(paragraph.id)}`} className="break-words pt-0.5 font-mono text-[11px] leading-5 text-muted-foreground hover:text-foreground">{paragraph.label}</a>
            <p className="min-w-0 break-words text-sm leading-6 text-foreground">{paragraph.text}</p>
            {onCite ? (
              <div className="col-start-2 pt-1.5 sm:col-start-3 sm:pt-0">
                <button type="button" onClick={() => onCite(paragraph.id)} className={cn(pillClass, 'h-7 px-2 text-xs')} aria-label={`Cite ${source.citation}, ${paragraph.label}`}>
                  <Quote className="size-3" aria-hidden="true" />Cite
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

function shortCite(paragraph: CitedParagraph) {
  const source = paragraph.source
  if (source.kind === 'judgment') {
    const official = source.citation.match(/(\d{4} ME \d+)$/)?.[1] ?? source.citation.split(',')[0]
    return `${official}, ${paragraph.label}`
  }
  return `${source.citation.replace(/§.*$/, '').trim()} ${paragraph.label}`
}

/** A note, sentence by sentence. A cited sentence links to each paragraph behind it; a
 * sentence with none is marked unsupported and is never shown as cited. */
function NoteBody({ body, paragraphs }: { body: string; paragraphs: Map<string, CitedParagraph> }) {
  const blocks = parseNoteBody(body)
  return (
    <div className="min-w-0 space-y-3">
      {blocks.map((block, index) => block.kind === 'heading' ? (
        <h4 key={index} className="text-sm font-semibold text-foreground">{block.text}</h4>
      ) : (
        <p key={index} className="min-w-0 break-words text-sm leading-7 text-foreground">
          {block.sentences.map((sentence, position) => {
            const cited = sentence.citations.map((id) => paragraphs.get(id)).filter((item): item is CitedParagraph => Boolean(item))
            return (
              <span key={position}>
                {position ? ' ' : ''}
                {cited.length ? sentence.text : (
                  <span className="underline decoration-amber-600/70 decoration-dotted underline-offset-4">
                    {sentence.text}
                    <span className="ml-1 inline-block rounded-[3px] border border-amber-500/40 bg-amber-500/10 px-1 align-[1px] text-[10px] font-medium uppercase leading-4 tracking-wide text-amber-800 dark:text-amber-300">Unsupported</span>
                  </span>
                )}
                {cited.map((paragraph) => (
                  <a
                    key={paragraph.id}
                    href={`#${paragraphDomId(paragraph.id)}`}
                    title={`${paragraph.source.citation}, ${paragraph.label}: ${paragraph.text.slice(0, 240)}`}
                    className="ml-1 inline rounded-[3px] border border-border bg-[var(--lf-manila)] px-1.5 py-px align-[1px] font-mono text-[11px] leading-5 text-foreground [box-decoration-break:clone] hover:border-foreground/40"
                  >
                    {shortCite(paragraph)}
                  </a>
                ))}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}

function NoteView({ note, paragraphs, onEdit }: { note: ResearchNoteRecord; paragraphs: Map<string, CitedParagraph>; onEdit?: () => void }) {
  const unsupported = note.claimCount - note.supportedCount
  return (
    <article id={`note-${note.id}`} className="min-w-0 overflow-hidden rounded-[6px] border border-border bg-card">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--lf-manila)] px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-foreground">{note.title}</h3>
          <p className="text-xs text-muted-foreground">
            {note.author?.name ?? 'Staff'} · {dateLabel(note.updatedAt)} · revision {note.revision} · {note.supportedCount} of {note.claimCount} statements cited
            {unsupported ? <span className="text-amber-800 dark:text-amber-300"> · {unsupported} unsupported</span> : null}
          </p>
        </div>
        {onEdit ? <Track><button type="button" className={pillClass} onClick={onEdit}>Edit</button></Track> : null}
      </header>
      <div className="px-4 py-3"><NoteBody body={note.body} paragraphs={paragraphs} /></div>
    </article>
  )
}

function NoteEditor({ matterId, draft, setDraft, editor, paragraphs, hasSources }: {
  matterId: string
  draft: Draft
  setDraft: (update: Draft | ((current: Draft) => Draft)) => void
  editor: React.RefObject<HTMLTextAreaElement | null>
  paragraphs: Map<string, CitedParagraph>
  hasSources: boolean
}) {
  const router = useRouter()
  const [state, run, pending] = useActionState<NoteState, FormData>(async (previous, formData) => {
    const result = await saveNote(previous, formData)
    if (result.ok) {
      setDraft({ noteId: '', title: '', body: '' })
      router.refresh()
    }
    return result
  }, { ok: true, message: '' })
  return (
    <Panel title={draft.noteId ? 'Edit research note' : 'New research note'} bodyClassName="space-y-3">
      <form action={run} className="min-w-0 space-y-3">
        <input type="hidden" name="matterId" value={matterId} />
        <input type="hidden" name="noteId" value={draft.noteId} />
        <label className={labelClass}>
          Title
          <input name="title" required minLength={3} maxLength={200} value={draft.title} onChange={(event) => { const title = event.target.value; setDraft((current) => ({ ...current, title })) }} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Note
          <textarea
            ref={editor}
            name="body"
            required
            rows={8}
            value={draft.body}
            onChange={(event) => { const body = event.target.value; setDraft((current) => ({ ...current, body })) }}
            className={textareaClass}
            placeholder={hasSources ? 'Write a statement, then press Cite on the paragraph that supports it.' : 'Attach an authority first, then cite its paragraphs.'}
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">Press Cite beside a paragraph to link the statement you are writing to it. A statement with no cited paragraph is kept and marked unsupported. Start a line with # for a heading.</p>
        {draft.body.trim() ? (
          <div className="min-w-0 rounded-[4px] border border-dashed border-border px-3 py-2.5">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
            <NoteBody body={draft.body} paragraphs={paragraphs} />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Track><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Saving…' : draft.noteId ? 'Save revision' : 'Save note'}</button></Track>
          {draft.noteId ? <Track><button type="button" className={pillClass} onClick={() => setDraft({ noteId: '', title: '', body: '' })}>Cancel</button></Track> : null}
        </div>
        <Message ok={state.ok} text={state.message} />
      </form>
    </Panel>
  )
}
