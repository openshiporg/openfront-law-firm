import Link from 'next/link'
import { FileText, Fingerprint } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import type { LegalAiEvidenceDocument } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { EmptyEvidence } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

export function DocumentEvidenceList({ documents }: { documents: LegalAiEvidenceDocument[] }) {
  if (!documents.length) {
    return <EmptyEvidence>No authorized document versions are available for this evidence set.</EmptyEvidence>
  }

  return (
    <section className="border-t border-border pt-4">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-base font-bold text-foreground">Document evidence</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Each document shows its current version’s name, type and checksum. Open a document for its full version history.
          </p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {documents.map((document) => (
          <article key={document.id} className="grid min-w-0 gap-3 px-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-bold text-foreground"><Link href={`/dashboard/platform/documents/document/${encodeURIComponent(document.id)}`} className="underline-offset-4 hover:underline">{document.title}</Link></h3>
                <PracticeStatus status={document.status} />
                <PracticeStatus status={document.confidentiality} />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {document.currentVersion
                  ? `v${document.currentVersion.versionNumber} · ${document.currentVersion.fileName} · ${document.currentVersion.mediaType}`
                  : 'No current version is attached'}
              </p>
              {document.matter ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  <Link href={`/dashboard/platform/matters/${encodeURIComponent(document.matter.id)}`} className="underline-offset-4 hover:underline">{document.matter.matterNumber} · {document.matter.title}</Link>
                </p>
              ) : null}
            </div>
            {document.currentVersion?.checksumSha256 ? (
              <div className="flex max-w-full items-center gap-2 font-mono text-xs text-muted-foreground" title={document.currentVersion.checksumSha256}>
                <Fingerprint className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="max-w-48 truncate">{document.currentVersion.checksumSha256}</span>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
