import Link from 'next/link'
import { FileText, Fingerprint } from 'lucide-react'

import { RowList, SectionHeader, TitleLine, statusLabel } from '@/features/platform/components/ui'
import type { LegalAiEvidenceDocument } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { EmptyEvidence } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

export function DocumentEvidenceList({ documents }: { documents: LegalAiEvidenceDocument[] }) {
  if (!documents.length) {
    return <EmptyEvidence>No authorized document versions in this evidence set.</EmptyEvidence>
  }

  return (
    <section className="min-w-0 space-y-3">
      <SectionHeader
        title={<span className="inline-flex items-center gap-2"><FileText className="size-4 text-muted-foreground" aria-hidden="true" />Document evidence</span>}
      />
      <RowList>
        {documents.map((document) => (
          <li key={document.id} className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <div className="min-w-0">
              <TitleLine as="h3" status={document.status} headingClassName="text-sm">
                <Link href={`/dashboard/platform/documents/document/${encodeURIComponent(document.id)}`} className="underline-offset-4 hover:underline">{document.title}</Link>
              </TitleLine>
              <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-4 text-xs text-muted-foreground">
                {document.currentVersion ? (
                  <>
                    <span className="font-mono">v{document.currentVersion.versionNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span className="min-w-0 truncate">{document.currentVersion.fileName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{document.currentVersion.mediaType}</span>
                  </>
                ) : <span className="text-amber-700 dark:text-amber-400">No current version attached</span>}
                <span aria-hidden="true">·</span>
                <span>{statusLabel(document.confidentiality)}</span>
              </p>
              {document.matter ? (
                <p className="mt-1 truncate pl-4 text-xs text-muted-foreground">
                  <Link href={`/dashboard/platform/matters/${encodeURIComponent(document.matter.id)}`} className="underline-offset-4 hover:text-foreground hover:underline">{document.matter.matterNumber} · {document.matter.title}</Link>
                </p>
              ) : null}
            </div>
            {document.currentVersion?.checksumSha256 ? (
              <div className="ml-4 inline-flex max-w-full items-center gap-1.5 justify-self-start rounded-[4px] bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground sm:ml-0 sm:justify-self-end" title={document.currentVersion.checksumSha256}>
                <Fingerprint className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">SHA-256 </span>
                <span className="max-w-40 truncate">{document.currentVersion.checksumSha256}</span>
              </div>
            ) : null}
          </li>
        ))}
      </RowList>
    </section>
  )
}
