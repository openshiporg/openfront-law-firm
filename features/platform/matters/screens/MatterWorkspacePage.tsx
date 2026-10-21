/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · audience: matter team · use: inspect one authorized matter and its daily work · tone: technical/austere · genre: modern-minimal · macrostructure: Matter register · theme: Quiet */
import Link from 'next/link'
import { ArrowLeft, BrainCircuit } from 'lucide-react'

import { PracticePage, PracticeStatus } from '@/features/platform/components/PracticeSurface'
import type { WorkQueuePageInfo } from '@/features/platform/operations/lib/workQueuePagination'
import { getMatterWorkspace } from '../actions/getMatterWorkspace'

export async function MatterWorkspacePage({ matterId, teamPage = 1, partyPage = 1, communicationPage = 1, deadlinePage = 1, taskPage = 1, documentPage = 1, invoicePage = 1 }: { matterId: string; teamPage?: number; partyPage?: number; communicationPage?: number; deadlinePage?: number; taskPage?: number; documentPage?: number; invoicePage?: number }) {
  const result = await getMatterWorkspace(matterId, { teamPage, partyPage, communicationPage, deadlinePage, taskPage, documentPage, invoicePage })
  if (!result.success) {
    return <PracticePage title="Matter unavailable" description="The requested matter was not returned within the current authorization scope." trail={[{ label: 'Matters', href: '/dashboard/platform/matters' }, { label: 'Matter unavailable' }]}><p role="alert" className="border-y border-destructive/30 px-4 py-6 text-sm text-destructive">{result.error}</p></PracticePage>
  }
  const { matter, sections } = result.data
  return (
    <PracticePage title={`${matter.matterNumber} · ${matter.title}`} description="Authorized matter workspace for team, parties, work, documents, communications, and billing evidence." trail={[{ label: 'Matters', href: '/dashboard/platform/matters' }, { label: matter.matterNumber }]}>
      <div className="space-y-8">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link href="/dashboard/platform/matters" className="mr-2 inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Matters</Link>
          <PracticeStatus status={matter.status} />
          <PracticeStatus status={matter.confidentiality} />
          <Link href={`/dashboard/platform/ai/matters/${encodeURIComponent(matter.id)}`} className="ml-auto inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground underline-offset-4 hover:underline"><BrainCircuit className="h-4 w-4" aria-hidden="true" /> AI evidence</Link>
        </div>

        <section className="grid border-y border-border sm:grid-cols-2 xl:grid-cols-4" aria-label="Matter identity">
          {[
            ['Client', matter.client?.displayName || 'Unavailable'],
            ['Responsible attorney', matter.responsibleAttorney?.name || 'Unassigned'],
            ['Office', matter.office?.name || 'No office'],
            ['Practice area', matter.practiceArea?.name || 'No practice area'],
          ].map(([label, value]) => <div key={label} className="min-w-0 border-b border-r border-border px-4 py-4 last:border-r-0 xl:border-b-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p></div>)}
        </section>


        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.key} id={section.key} className="scroll-mt-20" aria-labelledby={`${section.key}-heading`}>
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Matter register</p><h2 id={`${section.key}-heading`} className="mt-1 text-lg font-bold tracking-tight text-foreground">{section.title}</h2></div><span className="font-mono text-xs text-muted-foreground">{section.pagination ? `${(section.total ?? 0).toLocaleString()} authorized` : `${section.rows.length} shown`}</span></div>
              {!section.rows.length ? <p className="mt-4 border-y border-dashed border-border px-3 py-6 text-sm text-muted-foreground">No authorized {section.title.toLowerCase()} records are available.</p> : (
                <div className="mt-4 divide-y divide-border border-y border-border">
                  {section.rows.map((row) => <article key={row.id} className="grid min-w-0 gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-foreground">{row.href ? <Link href={row.href} className="underline-offset-4 hover:underline">{row.title}</Link> : row.title}</h3><p className="mt-1 truncate text-sm text-muted-foreground">{row.meta}</p></div><PracticeStatus status={row.status} /></article>)}
                </div>
              )}
              {(section.key === 'team' || section.key === 'parties' || section.key === 'communications' || section.key === 'deadlines' || section.key === 'tasks' || section.key === 'documents' || section.key === 'invoices') && section.pagination ? <MatterWorkspacePagination sectionKey={section.key} matterId={matter.id} total={section.total ?? 0} pagination={section.pagination} teamPage={teamPage} partyPage={partyPage} communicationPage={communicationPage} deadlinePage={deadlinePage} taskPage={taskPage} documentPage={documentPage} invoicePage={invoicePage} /> : null}
            </section>
          ))}
        </div>

        <Link href={`/dashboard/matters/${encodeURIComponent(matter.id)}`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">Field configuration (data model explorer)</Link>
      </div>
    </PracticePage>
  )
}

function MatterWorkspacePagination({ sectionKey, matterId, total, pagination, teamPage, partyPage, communicationPage, deadlinePage, taskPage, documentPage, invoicePage }: {
  sectionKey: 'team' | 'parties' | 'communications' | 'deadlines' | 'tasks' | 'documents' | 'invoices'
  matterId: string
  total: number
  pagination: WorkQueuePageInfo
  teamPage: number
  partyPage: number
  communicationPage: number
  deadlinePage: number
  taskPage: number
  documentPage: number
  invoicePage: number
}) {
  const href = (page: number) => {
    const params = new URLSearchParams({
      teamPage: String(sectionKey === 'team' ? page : teamPage),
      partyPage: String(sectionKey === 'parties' ? page : partyPage),
      communicationPage: String(sectionKey === 'communications' ? page : communicationPage),
      deadlinePage: String(sectionKey === 'deadlines' ? page : deadlinePage),
      taskPage: String(sectionKey === 'tasks' ? page : taskPage),
      documentPage: String(sectionKey === 'documents' ? page : documentPage),
      invoicePage: String(sectionKey === 'invoices' ? page : invoicePage),
    })
    return `/dashboard/platform/matters/${encodeURIComponent(matterId)}?${params.toString()}#${sectionKey}`
  }
  const registerLabel = sectionKey === 'team' ? 'Matter team' : sectionKey === 'parties' ? 'Matter parties' : sectionKey === 'communications' ? 'Matter communications' : sectionKey === 'deadlines' ? 'Matter deadlines' : sectionKey === 'tasks' ? 'Matter tasks' : sectionKey === 'documents' ? 'Matter documents' : 'Matter invoices'
  const recordLabel = sectionKey === 'team' ? 'active team assignments' : sectionKey === 'parties' ? 'active party relationships' : sectionKey === 'communications' ? 'matter communication threads' : sectionKey === 'deadlines' ? 'matter deadlines' : sectionKey === 'tasks' ? 'matter tasks' : sectionKey === 'documents' ? 'matter documents' : 'matter invoices'
  return (
    <nav aria-label={`${registerLabel} register pages`} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <div className="space-y-1 text-xs leading-5 text-muted-foreground">
        <p>{pagination.loadedCount ? `Showing ${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}` : 'No records returned on this page'} of {total.toLocaleString()} authorized {recordLabel} · page {pagination.page} of {pagination.pageCount}.</p>
      </div>
      <div className="flex items-center gap-2">
        {pagination.hasPrevious ? <Link href={href(pagination.page - 1)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Previous</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Previous</span>}
        {pagination.hasNext ? <Link href={href(pagination.page + 1)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Next</span>}
      </div>
    </nav>
  )
}
