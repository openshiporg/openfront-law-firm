/* Law Firm platform primitives: recessed tracks with raised pills, title-line
 * status dots, ledger panels and quiet stats. Server-safe (no hooks). */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Recessed track; children are raised pills (links, buttons or button forms). */
export const trackClass = 'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] [scrollbar-width:none] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]'

export function trackItemClass(active: boolean) {
  return cn(
    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-[background-color,color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
    active ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground',
  )
}

/** Raised pill for in-page buttons that sit in a recessed track. */
export const pillClass = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-background px-3.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-black/5 outline-none transition-[box-shadow,background-color] hover:ring-black/15 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-zinc-800 dark:ring-white/10 dark:hover:bg-zinc-700'
export const pillPrimaryClass = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-foreground px-3.5 text-sm font-medium text-background shadow-sm outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
export const pillDangerClass = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-background px-3.5 text-sm font-medium text-destructive shadow-sm ring-1 ring-destructive/25 outline-none hover:ring-destructive/40 focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:pointer-events-none disabled:opacity-50 dark:bg-zinc-800'

/** Form controls and labels shared by platform forms. */
export const fieldClass = 'min-h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 aria-invalid:border-destructive'
export const textareaClass = cn(fieldClass, 'min-h-24 resize-y py-2 leading-6')
export const labelClass = 'grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground [&>input]:text-foreground [&>select]:text-foreground [&>textarea]:text-foreground'

export type Tone = 'emerald' | 'sky' | 'amber' | 'violet' | 'rose' | 'zinc'

const dotTones: Record<Tone, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  zinc: 'bg-zinc-400',
}

const RISK = ['overdue', 'missed', 'failed', 'blocked', 'conflict_found', 'suspended', 'rejected', 'declined', 'cancelled', 'canceled', 'void', 'voided', 'bounced', 'expired', 'revoked', 'disputed', 'no_show', 'error', 'dead_letter']
const PENDING = ['pending', 'draft', 'requested', 'submitted', 'in_review', 'review', 'awaiting', 'queued', 'screening', 'needs_review', 'partially_paid', 'partial', 'held', 'on_hold', 'hold', 'unverified', 'proposed', 'invited', 'onboarding', 'preparing', 'sent', 'scheduled', 'retrying']
const DONE = ['open', 'active', 'approved', 'issued', 'delivered', 'completed', 'cleared', 'paid', 'verified', 'posted', 'reconciled', 'published', 'accepted', 'connected', 'enabled', 'signed', 'converted', 'billed', 'closed_won']
const QUIET = ['closed', 'archived', 'released', 'disposed', 'inactive', 'disabled', 'superseded', 'withdrawn']

/** One mapping from a practice status to a dot tone, used on every title line. */
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

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full ring-2 ring-background', dotTones[tone], className)} />
}

/** Inline status: dot plus label, for the end of a title line. */
export function StatusText({ status, className }: { status: string; className?: string }) {
  return <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground', className)}><StatusDot tone={statusTone(status)} />{statusLabel(status)}</span>
}

/** Title with its status dot on the same line; the status text follows the title. */
export function TitleLine({ as: Heading = 'h2', status, tone, children, className, headingClassName }: { as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'; status?: string | null; tone?: Tone; children: ReactNode; className?: string; headingClassName?: string }) {
  const dot = tone ?? (status ? statusTone(status) : undefined)
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {dot ? <StatusDot tone={dot} /> : null}
      <Heading className={cn('min-w-0 truncate font-semibold text-foreground', headingClassName)}>{children}</Heading>
      {status ? <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">{statusLabel(status)}</span> : null}
    </div>
  )
}

export function Panel({ title, actions, children, className, bodyClassName, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cn('min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card shadow-xs', className)}>
      {title || actions ? (
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          {typeof title === 'string' ? <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h2> : title}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Stats({ items, className }: { items: Array<[string, ReactNode]>; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]', className)}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 bg-card px-4 py-3">
          <dt className="truncate text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center', className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children}
    </div>
  )
}

export function ErrorBanner({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-0.5 text-destructive/90' : undefined}>{children}</div>
    </div>
  )
}

/** Notice for a configured limitation; one line, no tips. */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return <p role="note" className={cn('rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground', className)}>{children}</p>
}

export function SectionHeader({ id, title, count, actions }: { id?: string; title: ReactNode; count?: number; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 id={id} className="flex min-w-0 items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
        <span className="truncate">{title}</span>
        {typeof count === 'number' ? <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{count.toLocaleString()}</span> : null}
      </h2>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Previous / next in a recessed track. Disabled ends render as inert pills. */
export function Pager({ label, previous, next, summary }: { label: string; previous?: string | null; next?: string | null; summary?: ReactNode }) {
  if (!previous && !next && !summary) return null
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      {summary ? <p className="text-xs tabular-nums text-muted-foreground">{summary}</p> : <span />}
      {previous || next ? (
        <Track>
          {previous ? <Link href={previous} className={trackItemClass(true)}>Previous</Link> : <span aria-disabled="true" className={cn(trackItemClass(false), 'opacity-50')}>Previous</span>}
          {next ? <Link href={next} className={trackItemClass(true)}>Next</Link> : <span aria-disabled="true" className={cn(trackItemClass(false), 'opacity-50')}>Next</span>}
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

/** Ledger list: hairline-separated rows inside a rounded card. */
export function RowList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return <ul aria-label={label} className={cn('divide-y divide-border overflow-hidden rounded-xl border border-border bg-card', className)}>{children}</ul>
}
