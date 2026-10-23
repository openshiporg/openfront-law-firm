import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ErrorBanner, Notice, RowList, TitleLine, statusLabel } from '@/features/platform/components/ui'
import { getLegalAiOverview } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { EmptyEvidence, LegalAiBoundaryNotice, LegalAiNav, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

export async function LegalAiReviewsPage() {
  const result = await getLegalAiOverview()
  const matters = result.success ? result.data.matters : []

  return (
    <LegalAiPage title="Review workbench" description="Authorized matters as review preparation sets. No extraction, classification or model output.">
      <LegalAiNav current="/dashboard/platform/ai/reviews" />
      <LegalAiBoundaryNotice compact />
      <Notice>Review sets are evidence preparation only; no AI review runs are stored.</Notice>
      {!result.success ? (
        <ErrorBanner title="Review sets unavailable">{result.error}</ErrorBanner>
      ) : matters.length === 0 ? (
        <EmptyEvidence>No matters available for review in the current authorization scope.</EmptyEvidence>
      ) : (
        <RowList label="Authorized review sets">
          {matters.map((matter) => (
            <li key={matter.id}>
              <Link
                href={`/dashboard/platform/ai/reviews/${encodeURIComponent(matter.id)}`}
                className="group grid min-w-0 gap-1 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <span className="min-w-0">
                  <TitleLine as="h2" status={matter.status} headingClassName="text-sm">{matter.title}</TitleLine>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 pl-4 text-xs text-muted-foreground">
                    <span className="font-mono">{matter.matterNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span>{statusLabel(matter.confidentiality)}</span>
                  </span>
                </span>
                <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground group-hover:text-foreground sm:inline-flex">
                  Open review <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </RowList>
      )}
    </LegalAiPage>
  )
}
