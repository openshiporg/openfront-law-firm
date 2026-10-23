/* Legal AI workbench: a supervised research desk. Evidence first, citation and
 * review gates visible, model execution shown as an explicit state. */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BookOpenCheck, Bot, Braces, FileSearch, FlaskConical, Library, Scale, Search, ShieldCheck } from 'lucide-react'

import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { Track, fieldClass, pillClass, trackItemClass } from '@/features/platform/components/ui'
import { cn } from '@/lib/utils'

export const legalAiDestinations = [
  { title: 'Matter assistant', description: 'Matter-scoped evidence sets.', href: '/dashboard/platform/ai', icon: Bot },
  { title: 'Review workbench', description: 'Document, deadline, task and audit evidence.', href: '/dashboard/platform/ai/reviews', icon: FileSearch },
  { title: 'Knowledge', description: 'Authorized research, guidance and contract records.', href: '/dashboard/platform/ai/knowledge', icon: Library },
  { title: 'Workflows', description: 'Workflow definitions and approval requirements.', href: '/dashboard/platform/ai/workflows', icon: Braces },
  { title: 'Providers', description: 'Model and connector boundary.', href: '/dashboard/platform/ai/providers', icon: ShieldCheck },
  { title: 'Evaluation', description: 'Evidence, citation, access and refusal gates.', href: '/dashboard/platform/ai/evaluation', icon: FlaskConical },
] as const

export function LegalAiPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <PracticePage title={title} description={description}>
      <div className="min-w-0 space-y-6">{children}</div>
    </PracticePage>
  )
}

export function LegalAiBoundaryNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 text-xs font-medium text-foreground',
        compact ? 'py-2' : 'py-2.5',
      )}
    >
      <Scale className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span className="min-w-0">Model execution not configured · Not legal advice · Does not determine authority · Human review required</span>
    </div>
  )
}

/** Workbench sections as a recessed track. `current` marks the active section. */
export function LegalAiNav({ current }: { current?: string } = {}) {
  return (
    <nav aria-label="Legal AI workbench" className="min-w-0">
      <Track className="flex w-full sm:inline-flex sm:w-auto">
        {legalAiDestinations.map((item) => {
          const Icon = item.icon
          const active = current === item.href
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={trackItemClass(active)}>
              <Icon className="size-3.5" aria-hidden="true" />
              {item.title}
            </Link>
          )
        })}
      </Track>
    </nav>
  )
}

export function EmptyEvidence({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <BookOpenCheck className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm font-medium text-foreground">{children}</p>
    </div>
  )
}

export function EvidencePager({ label, page, pageCount, total, href, canContinue }: { label: string; page: number; pageCount: number | null; total: number | null; canContinue?: boolean; href: (page: number) => string }) {
  if (total === null || pageCount === null) {
    return (
      <nav aria-label={`${label} pages`} className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-amber-500" />
          {label} inventory unavailable · not an empty or complete result
        </p>
        <Track>
          <Link className={trackItemClass(true)} href={href(page)}>Retry</Link>
          {page > 1 ? <Link className={trackItemClass(false)} href={href(page - 1)}>Previous</Link> : null}
          {canContinue ? <Link className={trackItemClass(false)} href={href(page + 1)}>Next page</Link> : null}
        </Track>
      </nav>
    )
  }
  if (pageCount <= 1) return <p className="mt-3 text-xs tabular-nums text-muted-foreground">{total.toLocaleString()} authorized</p>
  return (
    <nav aria-label={`${label} pages`} className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs tabular-nums text-muted-foreground">{total.toLocaleString()} authorized · page {page} of {pageCount}</p>
      <Track>
        {page > 1 ? <Link href={href(page - 1)} className={trackItemClass(true)}>Previous</Link> : <span aria-disabled="true" className={cn(trackItemClass(false), 'opacity-50')}>Previous</span>}
        {page < pageCount ? <Link href={href(page + 1)} className={trackItemClass(true)}>Next</Link> : <span aria-disabled="true" className={cn(trackItemClass(false), 'opacity-50')}>Next</span>}
      </Track>
    </nav>
  )
}

export function EvidenceSearch({ action, query, label }: { action: string; query: string; label: string }) {
  return (
    <form method="get" action={action} role="search" aria-label={label} className="flex w-full min-w-0 items-center gap-2 sm:max-w-md">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input name="q" type="search" defaultValue={query} maxLength={100} aria-label={label} placeholder="Search" className={cn(fieldClass, 'pl-9')} />
      </div>
      <Track>
        <button type="submit" className={pillClass}>Search</button>
      </Track>
    </form>
  )
}
