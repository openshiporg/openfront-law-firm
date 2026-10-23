import Link from 'next/link'
import { ArrowRight, LockKeyhole } from 'lucide-react'

import { ErrorBanner, RowList, Stats, StatusDot, TitleLine, statusLabel } from '@/features/platform/components/ui'
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
  const total = result.success ? result.data.page.total : null

  return (
    <LegalAiPage
      title="Legal AI workbench"
      description="Authorized matter evidence, reviews and workflow definitions. Model execution unavailable."
    >
      <LegalAiNav current="/dashboard/platform/ai" />
      <LegalAiBoundaryNotice />

      <Stats
        items={[
          ['Authorized matters', total === null ? '—' : total.toLocaleString()],
          ['Model execution', <span key="model" className="inline-flex items-center gap-2 text-base"><StatusDot tone="zinc" />Off</span>],
          ['Citation gate', <span key="cite" className="inline-flex items-center gap-2 text-base"><StatusDot tone="amber" />Required</span>],
          ['Human review', <span key="review" className="inline-flex items-center gap-2 text-base"><StatusDot tone="amber" />Required</span>],
        ]}
      />

      <section aria-labelledby="matter-evidence-heading" className="scroll-mt-20 space-y-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="matter-evidence-heading" className="flex items-baseline gap-2 text-base font-semibold tracking-tight text-foreground">
            Matter evidence sets
            {total !== null ? <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{total.toLocaleString()}</span> : null}
          </h2>
          <EvidenceSearch action="/dashboard/platform/ai" query={result.success ? result.data.query : ''} label="Search matters" />
        </div>

        {!result.success ? (
          <ErrorBanner title="Matter evidence unavailable">
            <span className="inline-flex items-center gap-2"><LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />{result.error || 'Not available in the current authorization scope.'}</span>
          </ErrorBanner>
        ) : matters.length === 0 ? (
          <EmptyEvidence>No active matters in the current authorization scope.</EmptyEvidence>
        ) : (
          <RowList label="Authorized matters">
            {matters.map((matter) => (
              <li key={matter.id}>
                <Link
                  href={`/dashboard/platform/ai/matters/${encodeURIComponent(matter.id)}`}
                  className="group grid min-w-0 gap-1 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                >
                  <span className="min-w-0">
                    <TitleLine as="h3" status={matter.status} headingClassName="text-sm">{matter.title}</TitleLine>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-4 text-xs text-muted-foreground">
                      <span className="font-mono">{matter.matterNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{matter.client?.displayName || 'Client unavailable'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{matter.responsibleAttorney?.name || 'Attorney unassigned'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{statusLabel(matter.confidentiality)}</span>
                    </span>
                  </span>
                  <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground group-hover:text-foreground sm:inline-flex">
                    Inspect evidence
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </RowList>
        )}
        {result.success ? <EvidencePager label="Matter evidence" {...result.data.page} href={pageHref} /> : null}
      </section>

    </LegalAiPage>
  )
}
