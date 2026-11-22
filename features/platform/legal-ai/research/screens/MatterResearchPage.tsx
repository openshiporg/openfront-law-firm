import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { ErrorBanner, FileLabel, Track, trackItemClass } from '@/features/platform/components/ui'

import { getMatterResearch } from '../actions/research'
import { ResearchWorkbench } from '../components/ResearchWorkbench'

type MatterHead = { id: string; matterNumber: string; title: string; client?: { displayName?: string | null } | null }

export async function MatterResearchPage({ params }: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await params
  const id = decodeURIComponent(matterId).trim()
  if (!id || id.length > 200) notFound()
  const [head, research, viewer] = await Promise.all([
    keystoneClient<{ matter: MatterHead | null }>(`query ResearchMatter($id: ID!) { matter(where: { id: $id }) { id matterNumber title client { displayName } } }`, { id }),
    getMatterResearch(id),
    keystoneClient<{ authenticatedItem: { role?: { permissions?: string[] | null } | null } | null }>(`query ResearchViewer { authenticatedItem { ... on User { role { permissions } } } }`),
  ])
  if (head.success && !head.data.matter) notFound()
  const matter = head.success ? head.data.matter : null
  const granted = viewer.success ? viewer.data.authenticatedItem?.role?.permissions ?? [] : []
  const canManage = granted.includes('canManageDocuments')
  const trail = [{ label: 'Matters', href: '/dashboard/platform/matters' }, ...(matter ? [{ label: matter.matterNumber, href: `/dashboard/platform/matters/${encodeURIComponent(matter.id)}` }] : []), { label: 'Research' }]
  return (
    <PracticePage
      title={matter ? `Research · ${matter.title}` : 'Research'}
      description="Statutes, regulations and judgments read from their official publishers, with notes that cite the exact paragraph."
      meta={matter ? <span className="flex flex-wrap items-center gap-2"><FileLabel>{matter.matterNumber}</FileLabel><span>{matter.client?.displayName || 'Client unavailable'}</span></span> : undefined}
      trail={trail}
      actions={matter ? <Track><Link href={`/dashboard/platform/matters/${encodeURIComponent(matter.id)}`} className={trackItemClass(false)}><ArrowLeft className="size-4" aria-hidden="true" />Matter</Link></Track> : undefined}
    >
      {!head.success ? <ErrorBanner title="Matter unavailable">{head.error}</ErrorBanner> : !research.success ? (
        <ErrorBanner title="Research unavailable">{research.error}</ErrorBanner>
      ) : (
        <ResearchWorkbench matterId={id} sources={research.data.sources} notes={research.data.notes} canManage={canManage} />
      )}
    </PracticePage>
  )
}
