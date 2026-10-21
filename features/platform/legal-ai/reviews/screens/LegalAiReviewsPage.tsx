import Link from 'next/link'
import { ArrowRight, Columns3 } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { getLegalAiOverview } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { EmptyEvidence, LegalAiBoundaryNotice, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

export async function LegalAiReviewsPage() {
  const result = await getLegalAiOverview()
  const matters = result.success ? result.data.matters : []

  return (
    <LegalAiPage title="Review workbench" description="Open an authorized matter as a bounded review preparation set. No extraction, classification, or model output is represented as complete.">
      <LegalAiBoundaryNotice compact />
      {!result.success ? (
        <EmptyEvidence>{result.error}</EmptyEvidence>
      ) : matters.length === 0 ? (
        <EmptyEvidence>No matters are available for review in the current authorization scope.</EmptyEvidence>
      ) : (
        <section className="divide-y divide-border border-y border-border" aria-label="Authorized review sets">
          {matters.map((matter) => (
            <Link
              key={matter.id}
              href={`/dashboard/platform/ai/reviews/${encodeURIComponent(matter.id)}`}
              className="group grid min-w-0 gap-3 px-2 py-4 outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="hidden h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground sm:flex">
                <Columns3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap gap-2"><PracticeStatus status={matter.status} /><PracticeStatus status={matter.confidentiality} /></span>
                <span className="mt-1 block truncate text-sm font-bold text-foreground">{matter.matterNumber} · {matter.title}</span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">Evidence preparation; not a persisted AI review run</span>
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground">Open review <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" /></span>
            </Link>
          ))}
        </section>
      )}
    </LegalAiPage>
  )
}
