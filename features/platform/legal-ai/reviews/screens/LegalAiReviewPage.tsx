import Link from 'next/link'
import { ArrowLeft, CircleOff, Columns3 } from 'lucide-react'

import { DocumentEvidenceList } from '@/features/platform/legal-ai/documents/components/DocumentEvidenceList'
import { CitationPolicy } from '@/features/platform/legal-ai/citations/components/CitationPolicy'
import { getLegalAiMatterWorkspace } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { LegalAiBoundaryNotice, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

export async function LegalAiReviewPage({ reviewId }: { reviewId: string }) {
  // Launch-scope review IDs intentionally resolve to authorized Matter IDs. No
  // parallel review or matter store is implied until a controlled run model exists.
  const result = await getLegalAiMatterWorkspace(reviewId)
  if (!result.success) {
    return (
      <LegalAiPage title="Review unavailable" description="The requested review evidence set is outside the current authorization scope or does not exist.">
        <LegalAiBoundaryNotice compact />
        <p className="border-y border-destructive/30 px-4 py-6 text-sm text-destructive">{result.error}</p>
      </LegalAiPage>
    )
  }

  const { matter, documents } = result.data
  return (
    <LegalAiPage title={`Review · ${matter.matterNumber}`} description={matter.title}>
      <Link href="/dashboard/platform/ai/reviews" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Review sets
      </Link>
      <LegalAiBoundaryNotice compact />
      
      <div className="flex items-start gap-3 border-y border-border bg-muted/20 px-4 py-4">
        <Columns3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-foreground">Review table status</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">The documents you can review are listed below. Automated review columns and exports are not available because no AI model is connected.</p>
        </div>
      </div>
      <DocumentEvidenceList documents={documents} />
      <CitationPolicy />
      <div className="flex items-start gap-3 border-y border-border px-4 py-4 text-sm text-muted-foreground">
        <CircleOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>No generated cells, summaries, legal conclusions, or fabricated citations are shown.</p>
      </div>
    </LegalAiPage>
  )
}
