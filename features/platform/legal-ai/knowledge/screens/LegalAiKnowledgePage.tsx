import { ErrorBanner, Meta, MetaGrid, Panel, StatusDot } from '@/features/platform/components/ui'
import { getLegalAiKnowledge } from '@/features/platform/legal-ai/assistant/actions/getLegalAiWorkspace'
import { EvidencePager, EvidenceSearch, LegalAiBoundaryNotice, LegalAiNav, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'
import { DocumentEvidenceList } from '@/features/platform/legal-ai/documents/components/DocumentEvidenceList'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

export async function LegalAiKnowledgePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {}
  const result = await getLegalAiKnowledge(Number(first(params.page)) || 1, first(params.q))
  const documents = result.success ? result.data.documents : []
  const pageHref = (page: number) => `/dashboard/platform/ai/knowledge?${new URLSearchParams({ ...(result.success && result.data.query ? { q: result.data.query } : {}), page: String(page) }).toString()}`

  return (
    <LegalAiPage title="Authorized knowledge" description="Active research, internal and contract records visible to you. Document inventory, not a search index or statement of current law.">
      <LegalAiNav current="/dashboard/platform/ai/knowledge" />
      <LegalAiBoundaryNotice compact />
      <Panel bodyClassName="py-3">
        <MetaGrid className="sm:grid-cols-3 lg:grid-cols-3">
          <Meta label="Source inventory"><span className="inline-flex items-center gap-2"><StatusDot tone="emerald" />Authorized documents</span></Meta>
          <Meta label="Semantic index"><span className="inline-flex items-center gap-2"><StatusDot tone="zinc" />Unavailable</span></Meta>
          <Meta label="Search">Title only</Meta>
        </MetaGrid>
      </Panel>
      <EvidenceSearch action="/dashboard/platform/ai/knowledge" query={result.success ? result.data.query : ''} label="Search knowledge by title" />
      {!result.success ? <ErrorBanner title="Knowledge unavailable">{result.error}</ErrorBanner> : <div className="space-y-0"><DocumentEvidenceList documents={documents} /><EvidencePager label="Knowledge" {...result.data.page} href={pageHref} /></div>}
    </LegalAiPage>
  )
}
