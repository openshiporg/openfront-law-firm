/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · audience: legal staff · use: inspect bounded matter evidence · tone: technical/austere · genre: modern-minimal · macrostructure: Workbench · theme: Quiet */
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Braces,
  FileSearch,
  FlaskConical,
  Library,
  Scale,
  ShieldCheck,
} from 'lucide-react'

import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { cn } from '@/lib/utils'

export const legalAiDestinations = [
  { title: 'Matter assistant', description: 'Prepare a matter-scoped evidence set before any future model request.', href: '/dashboard/platform/ai', icon: Bot },
  { title: 'Review workbench', description: 'Inspect document, deadline, task, and audit evidence without generating conclusions.', href: '/dashboard/platform/ai/reviews', icon: FileSearch },
  { title: 'Knowledge', description: 'Browse authorized research, internal guidance, and contract records.', href: '/dashboard/platform/ai/knowledge', icon: Library },
  { title: 'Workflows', description: 'See bounded legal workflow definitions and their approval requirements.', href: '/dashboard/platform/ai/workflows', icon: Braces },
  { title: 'Providers', description: 'Review the fail-closed model and connector boundary.', href: '/dashboard/platform/ai/providers', icon: ShieldCheck },
  { title: 'Evaluation', description: 'Define evidence, citation, access, and refusal checks before enabling models.', href: '/dashboard/platform/ai/evaluation', icon: FlaskConical },
] as const

export function LegalAiPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <PracticePage title={title} description={description}>
      <div className="space-y-8">{children}</div>
    </PracticePage>
  )
}

export function LegalAiBoundaryNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className={cn('border-y border-border bg-muted/25 px-4 py-4', compact && 'py-3')}>
      <div className="flex items-start gap-3">
        <Scale className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="text-sm leading-6 text-muted-foreground">
          <p className="font-semibold text-foreground">Model execution unconfigured · does not provide legal advice or determine authority</p>
        </div>
      </div>
    </div>
  )
}

export function LegalAiNav() {
  return (
    <nav aria-label="Legal AI workbench" className="border-y border-border">
      <div className="grid min-w-0 sm:grid-cols-2 xl:grid-cols-3">
        {legalAiDestinations.map((item, index) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group grid min-h-28 min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-3 border-border px-4 py-4 outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                index % 2 === 0 ? 'sm:border-r' : '',
                index < 4 ? 'border-b' : '',
                index % 3 !== 2 ? 'xl:border-r' : 'xl:border-r-0',
                index < 3 ? 'xl:border-b' : 'xl:border-b-0',
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">{item.title}</span>
                
              </span>
              <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}



export function EmptyEvidence({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-28 items-center gap-3 border-y border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      <BookOpenCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}

export function EvidencePager({ label, page, pageCount, total, href, canContinue }: { label: string; page: number; pageCount: number | null; total: number | null; canContinue?: boolean; href: (page: number) => string }) {
  if (total === null || pageCount === null) return <nav aria-label={`${label} pages`} className="mt-3 flex flex-wrap items-center gap-4 text-xs"><p role="status">Full {label.toLowerCase()} inventory is unavailable; this is not an empty or complete result.</p><Link className="inline-flex min-h-11 items-center underline" href={href(page)}>Retry this page</Link>{page > 1 ? <Link className="inline-flex min-h-11 items-center underline" href={href(page - 1)}>Previous</Link> : null}{canContinue ? <Link className="inline-flex min-h-11 items-center underline" href={href(page + 1)}>Next page</Link> : null}</nav>
  if (pageCount <= 1) return <p className="mt-2 text-xs text-muted-foreground">{total.toLocaleString()} authorized</p>
  return (
    <nav aria-label={`${label} pages`} className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{total.toLocaleString()} authorized · page {page} of {pageCount}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Previous</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Previous</span>}
        {page < pageCount ? <Link href={href(page + 1)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Next</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Next</span>}
      </div>
    </nav>
  )
}

export function EvidenceSearch({ action, query, label }: { action: string; query: string; label: string }) {
  return (
    <form method="get" action={action} role="search" aria-label={label} className="flex max-w-xl gap-2">
      <input name="q" type="search" defaultValue={query} maxLength={100} aria-label={label} placeholder="Search" className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Search</button>
    </form>
  )
}
