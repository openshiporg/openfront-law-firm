/* Law Firm platform primitives: flat toolbars, square-cornered buttons, underline tabs,
 * status marks in a status column, ledger tables with a manila head. Server-safe (no hooks).
 * Rust (--lf-rust) is reserved for the primary action and the current selection. */
import './practice.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--lf-rust)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background'

/** Toolbar row for related actions; it draws nothing itself. */
export const trackClass = 'inline-flex max-w-full flex-wrap items-center gap-1.5'

/** Toolbar item: `true` renders an outlined button, `false` a quiet text button. */
export function trackItemClass(active: boolean) {
  return cn(
    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
    focusRing,
    active ? 'border border-input bg-background text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
}

/** Secondary button. */
export const pillClass = cn('inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50', focusRing)
/** Primary button: the one rust action on a surface. */
export const pillPrimaryClass = cn('inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] bg-[var(--lf-rust)] px-3 text-sm font-medium text-[var(--lf-on-rust)] transition-colors hover:bg-[var(--lf-rust-hover)] disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground', focusRing)
/** Destructive button: outlined until used, kept apart from its neighbours by the caller. */
export const pillDangerClass = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-destructive/40 bg-background px-3 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:pointer-events-none disabled:opacity-50'

/** Text link styled as an action ("Search all", "Open"). */
export const actionLinkClass = cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[2px] text-sm font-medium text-[var(--lf-rust-ink)] underline-offset-4 hover:underline', focusRing)

/** Segmented choice: a joined row of square options; pair each label span with `segmentItemClass`. */
export const segmentClass = 'inline-flex max-w-full flex-wrap overflow-hidden rounded-[4px] border border-input bg-background'
export const segmentItemClass = 'inline-flex h-8 cursor-pointer items-center whitespace-nowrap px-3 text-sm text-muted-foreground transition-colors hover:text-foreground peer-checked:bg-[var(--lf-manila-strong)] peer-checked:font-medium peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-[var(--lf-rust)]/40'

/** Form controls and labels shared by platform forms. */
export const fieldClass = 'min-h-9 w-full min-w-0 rounded-[4px] border border-input bg-background px-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-[var(--lf-rust)] focus-visible:ring-2 focus-visible:ring-[var(--lf-rust)]/20 disabled:opacity-60 aria-invalid:border-destructive'
export const textareaClass = cn(fieldClass, 'min-h-24 resize-y py-2 leading-6')
export const labelClass = 'grid min-w-0 gap-1 text-xs font-medium text-muted-foreground [&>input]:text-foreground [&>select]:text-foreground [&>textarea]:text-foreground'

export type Tone = 'emerald' | 'sky' | 'amber' | 'violet' | 'rose' | 'zinc'

const markTones: Record<Tone, string> = {
  emerald: 'bg-emerald-600 dark:bg-emerald-500',
  sky: 'bg-sky-600 dark:bg-sky-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-600 dark:bg-violet-500',
  rose: 'bg-rose-600 dark:bg-rose-500',
  zinc: 'bg-zinc-400 dark:bg-zinc-500',
}

const RISK = ['overdue', 'missed', 'failed', 'blocked', 'conflict_found', 'suspended', 'rejected', 'declined', 'cancelled', 'canceled', 'void', 'voided', 'bounced', 'expired', 'revoked', 'disputed', 'no_show', 'error', 'dead_letter']
const PENDING = ['pending', 'draft', 'requested', 'submitted', 'in_review', 'review', 'awaiting', 'queued', 'screening', 'needs_review', 'partially_paid', 'partial', 'held', 'on_hold', 'hold', 'unverified', 'proposed', 'invited', 'onboarding', 'preparing', 'sent', 'scheduled', 'retrying']
const DONE = ['open', 'active', 'approved', 'issued', 'delivered', 'completed', 'cleared', 'paid', 'verified', 'posted', 'reconciled', 'published', 'accepted', 'connected', 'enabled', 'signed', 'converted', 'billed', 'closed_won']
const QUIET = ['closed', 'archived', 'released', 'disposed', 'inactive', 'disabled', 'superseded', 'withdrawn']

/** One mapping from a practice status to a tone, used in every status column. */
export function statusTone(status: string | null | undefined): Tone {
  const value = String(status ?? '').toLowerCase()
  if (RISK.includes(value)) return 'rose'
  if (DONE.includes(value)) return 'emerald'
  if (PENDING.includes(value)) return 'amber'
  if (QUIET.includes(value)) return 'zinc'
  if (value.includes('fail') || value.includes('overdue') || value.includes('conflict')) return 'rose'
  if (value.includes('pending') || value.includes('review') || value.includes('await')) return 'amber'
  return 'sky'
}

export function statusLabel(status: string | null | undefined) {
  const value = String(status ?? '').replaceAll('_', ' ').trim()
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown'
}

export function Track({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return <div role={label ? 'group' : undefined} aria-label={label} className={cn(trackClass, className)}>{children}</div>
}

/** Square status mark, like the coloured tab on a file jacket. */
export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-[1px]', markTones[tone], className)} />
}

/** Status cell content: mark plus label. */
export function StatusText({ status, className }: { status: string; className?: string }) {
  return <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground/80', className)}><StatusDot tone={statusTone(status)} />{statusLabel(status)}</span>
}

const fileNumberPattern = /^(\d{4}-\d{2,}[A-Z0-9-]*)(?:\s*·\s*)?(.*)$/

/** Splits a leading matter number ("2026-001 · Jordan Lee") from the rest of a line. */
export function splitFileNumber(text: string): { number: string | null; rest: string } {
  const match = fileNumberPattern.exec(text.trim())
  return match ? { number: match[1], rest: match[2] } : { number: null, rest: text }
}

/** Matter number as a typed file-jacket label: the platform's signature mark. */
export function FileLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('lf-figures inline-flex h-5 shrink-0 items-center rounded-[2px] border border-[var(--lf-manila-line)] bg-[var(--lf-manila)] px-1.5 font-mono text-[11px] font-medium leading-none tracking-tight text-[var(--lf-rust-ink)]', className)}>{children}</span>
}

/** Title with its status on the same line. */
export function TitleLine({ as: Heading = 'h2', status, tone, children, className, headingClassName }: { as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'; status?: string | null; tone?: Tone; children: ReactNode; className?: string; headingClassName?: string }) {
  const mark = tone ?? (status ? statusTone(status) : undefined)
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Heading className={cn('min-w-0 truncate font-semibold text-foreground', headingClassName)}>{children}</Heading>
      {status ? <StatusText status={status} /> : mark ? <StatusDot tone={mark} /> : null}
    </div>
  )
}

/** Section with a heading row above a bordered body. Hierarchy comes from the heading, not a card. */
export function Panel({ title, actions, children, className, bodyClassName, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cn('min-w-0 scroll-mt-28 overflow-hidden rounded-[6px] border border-border bg-card', className)}>
      {title || actions ? (
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--lf-manila)] px-4 py-2.5">
          {typeof title === 'string' ? <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h2> : title}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Obligation counts as a ruled strip of figures. Zero reads quiet; any count reads in ink. */
export function Stats({ items, className }: { items: Array<[string, ReactNode]>; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 border-y border-border sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]', className)}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 border-border px-4 py-3 first:pl-0 sm:border-l sm:first:border-l-0">
          <dt className="truncate text-xs text-muted-foreground">{label}</dt>
          <dd className={cn('lf-figures mt-1 truncate text-xl font-semibold tracking-tight', value === 0 || value === '0' ? 'text-muted-foreground/70' : 'text-foreground')}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Empty result: one quiet line, never a box inside a box. */
export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm', className)}>
      <p className="text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

export function ErrorBanner({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="alert" className="rounded-[4px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-0.5 text-destructive/90' : undefined}>{children}</div>
    </div>
  )
}

/** Notice for a configured limitation; one line, no tips. */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return <p role="note" className={cn('border-l border-[var(--lf-manila-line)] py-0.5 pl-3 text-xs leading-5 text-muted-foreground', className)}>{children}</p>
}

export function SectionHeader({ id, title, count, actions }: { id?: string; title: ReactNode; count?: number; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <h2 id={id} className="flex min-w-0 items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
        <span className="truncate">{title}</span>
        {typeof count === 'number' ? <span className="lf-figures text-sm font-normal text-muted-foreground">{count.toLocaleString()}</span> : null}
      </h2>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Previous / next. Disabled ends render as inert buttons. */
export function Pager({ label, previous, next, summary }: { label: string; previous?: string | null; next?: string | null; summary?: ReactNode }) {
  if (!previous && !next && !summary) return null
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      {summary ? <p className="lf-figures text-xs text-muted-foreground">{summary}</p> : <span />}
      {previous || next ? (
        <Track>
          {previous ? <Link href={previous} className={trackItemClass(true)}>Previous</Link> : <span aria-disabled="true" className={cn(trackItemClass(true), 'opacity-40')}>Previous</span>}
          {next ? <Link href={next} className={trackItemClass(true)}>Next</Link> : <span aria-disabled="true" className={cn(trackItemClass(true), 'opacity-40')}>Next</span>}
        </Track>
      ) : null}
    </nav>
  )
}

export function Meta({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

export function MetaGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4', className)}>{children}</dl>
}

/** Ledger list: hairline-separated rows inside a square-cornered frame. */
export function RowList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return <ul aria-label={label} className={cn('divide-y divide-border overflow-hidden rounded-[6px] border border-border bg-card', className)}>{children}</ul>
}
