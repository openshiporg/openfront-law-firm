import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { ErrorBanner, Notice, Panel, StatusDot, Track, trackItemClass } from '@/features/platform/components/ui'
import { DocumentEvidenceList } from '@/features/platform/legal-ai/documents/components/DocumentEvidenceList'
import { CitationPolicy } from '@/features/platform/legal-ai/citations/components/CitationPolicy'
import { getLegalAiMatterWorkspace } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { LegalAiBoundaryNotice, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

function BackToReviews() {
  return (
    <Track>
      <Link href="/dashboard/platform/ai/reviews" className={trackItemClass(true)}>
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Review sets
      </Link>
    </Track>
  )
}

export async function LegalAiReviewPage({ reviewId }: { reviewId: string }) {
  // Launch-scope review IDs intentionally resolve to authorized Matter IDs. No
  // parallel review or matter store is implied until a controlled run model exists.
  const result = await getLegalAiMatterWorkspace(reviewId)
  if (!result.success) {
    return (
      <LegalAiPage title="Review unavailable" description="The requested review evidence set is outside the current authorization scope or does not exist.">
        <BackToReviews />
        <LegalAiBoundaryNotice compact />
        <ErrorBanner title="Review unavailable">{result.error}</ErrorBanner>
      </LegalAiPage>
    )
  }

  const { matter, documents } = result.data
  return (
    <LegalAiPage title={`Review · ${matter.matterNumber}`} description={matter.title}>
      <BackToReviews />
      <LegalAiBoundaryNotice compact />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-3">
          <Notice>Automated review columns and exports unavailable: no AI model connected.</Notice>
          <DocumentEvidenceList documents={documents} />
        </div>
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-20" aria-label="Review gates">
          <Panel title="Review gate" bodyClassName="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-foreground"><StatusDot tone="amber" />Human review required</p>
            <p className="text-xs leading-5 text-muted-foreground">No generated cells, summaries, legal conclusions or citations shown.</p>
          </Panel>
          <CitationPolicy />
        </aside>
      </div>
    </LegalAiPage>
  )
}
