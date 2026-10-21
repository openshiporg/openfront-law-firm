import { BookOpenCheck, DatabaseZap } from 'lucide-react'

import { getLegalAiKnowledge } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { EmptyEvidence, EvidencePager, EvidenceSearch, LegalAiBoundaryNotice, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'
import { DocumentEvidenceList } from '@/features/platform/legal-ai/documents/components/DocumentEvidenceList'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

export async function LegalAiKnowledgePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {}
  const result = await getLegalAiKnowledge(Number(first(params.page)) || 1, first(params.q))
  const documents = result.success ? result.data.documents : []
  const pageHref = (page: number) => `/dashboard/platform/ai/knowledge?${new URLSearchParams({ ...(result.success && result.data.query ? { q: result.data.query } : {}), page: String(page) }).toString()}`

  return (
    <LegalAiPage title="Authorized knowledge" description="Active research, internal, and contract records visible to you. This is a document inventory, not a search index or a statement of current law.">
      <LegalAiBoundaryNotice compact />
      <div className="grid gap-0 border-y border-border md:grid-cols-2">
        <section className="border-b border-border px-4 py-5 md:border-b-0 md:border-r">
          <BookOpenCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-foreground">Source inventory</h2>
          
        </section>
        <section className="px-4 py-5">
          <DatabaseZap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-foreground">Index status: unavailable</h2>
          
        </section>
      </div>
      <EvidenceSearch action="/dashboard/platform/ai/knowledge" query={result.success ? result.data.query : ''} label="Search knowledge by title" />
      {!result.success ? <EmptyEvidence>{result.error}</EmptyEvidence> : <><DocumentEvidenceList documents={documents} /><EvidencePager label="Knowledge" {...result.data.page} href={pageHref} /></>}
    </LegalAiPage>
  )
}
