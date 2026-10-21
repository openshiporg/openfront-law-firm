import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, CircleOff, LockKeyhole } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { getLegalAiOverview } from '../actions/getLegalAiWorkspace'
import {
  EmptyEvidence,
  EvidencePager,
  EvidenceSearch,
  LegalAiBoundaryNotice,
  LegalAiNav,
  LegalAiPage,
} from '../components/LegalAiSurface'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

export async function LegalAiHomePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {}
  const result = await getLegalAiOverview(Number(first(params.page)) || 1, first(params.q))
  const matters = result.success ? result.data.matters : []
  const pageHref = (page: number) => `/dashboard/platform/ai?${new URLSearchParams({ ...(result.success && result.data.query ? { q: result.data.query } : {}), page: String(page) }).toString()}#matter-evidence-heading`

  return (
    <LegalAiPage
      title="Legal AI workbench"
      description="Prepare authorized matter evidence, reviews, and controlled workflow definitions. Model execution is deliberately unavailable."
    >
      <LegalAiBoundaryNotice />
      <LegalAiNav />

      <section aria-labelledby="matter-evidence-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Authorized scope</p>
            <h2 id="matter-evidence-heading" className="mt-1 text-xl font-bold tracking-tight text-foreground">Matter evidence sets</h2>
            
          </div>
          <EvidenceSearch action="/dashboard/platform/ai" query={result.success ? result.data.query : ''} label="Search matters" />
        </div>

        {!result.success ? (
          <div className="mt-4 flex min-h-28 items-center gap-3 border-y border-destructive/30 px-4 py-6 text-sm text-destructive">
            <LockKeyhole className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{result.error || 'Matter evidence is unavailable in the current authorization scope.'}</p>
          </div>
        ) : matters.length === 0 ? (
          <div className="mt-4"><EmptyEvidence>No active matters are available in the current authorization scope.</EmptyEvidence></div>
        ) : (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {matters.map((matter) => (
              <Link
                key={matter.id}
                href={`/dashboard/platform/ai/matters/${encodeURIComponent(matter.id)}`}
                className="group grid min-w-0 gap-3 px-2 py-4 outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="hidden h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground sm:flex">
                  <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{matter.matterNumber}</span>
                    <PracticeStatus status={matter.status} />
                    <PracticeStatus status={matter.confidentiality} />
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-foreground">{matter.title}</span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {matter.client?.displayName || 'Client unavailable'} · {matter.responsibleAttorney?.name || 'Attorney unassigned'}
                  </span>
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground">
                  Inspect evidence
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        )}
        {result.success ? <EvidencePager label="Matter evidence" {...result.data.page} href={pageHref} /> : null}
      </section>

      <section className="border-y border-border bg-muted/20 px-4 py-5">
        <div className="flex items-start gap-3">
          <CircleOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Execution status: unavailable · Model execution is not configured</h2>
            
          </div>
        </div>
      </section>
    </LegalAiPage>
  )
}
