import Link from 'next/link'
import { ArrowLeft, BrainCircuit, ReceiptText, Settings2 } from 'lucide-react'

import { PracticePage, PracticeStatus, SectionJumps } from '@/features/platform/components/PracticeSurface'
import { EmptyState, ErrorBanner, Pager, StatusDot, Track, statusLabel, statusTone, trackItemClass } from '@/features/platform/components/ui'
import type { WorkQueuePageInfo } from '@/features/platform/operations/lib/workQueuePagination'
import { getMatterWorkspace } from '../actions/getMatterWorkspace'
import { DeskCreatePanel } from '@/features/platform/desks/DeskCreatePanel'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

export async function MatterWorkspacePage({ matterId, teamPage = 1, partyPage = 1, communicationPage = 1, deadlinePage = 1, taskPage = 1, documentPage = 1, invoicePage = 1 }: { matterId: string; teamPage?: number; partyPage?: number; communicationPage?: number; deadlinePage?: number; taskPage?: number; documentPage?: number; invoicePage?: number }) {
  const [result, timeZone] = await Promise.all([getMatterWorkspace(matterId, { teamPage, partyPage, communicationPage, deadlinePage, taskPage, documentPage, invoicePage }), getFirmTimeZone()])
  if (!result.success) {
    return <PracticePage title="Matter unavailable" description="The requested matter was not returned within the current authorization scope." trail={[{ label: 'Matters', href: '/dashboard/platform/matters' }, { label: 'Matter unavailable' }]}><ErrorBanner>{result.error}</ErrorBanner></PracticePage>
  }
  const { matter, sections } = result.data
  return (
    <PracticePage
      title={matter.title}
      description="Authorized matter workspace for team, parties, work, documents, communications, and billing evidence."
      status={<PracticeStatus status={matter.status} />}
      meta={<span className="font-mono text-xs">{matter.matterNumber} · {statusLabel(matter.confidentiality)}</span>}
      trail={[{ label: 'Matters', href: '/dashboard/platform/matters' }, { label: matter.matterNumber }]}
      actions={<Track>
        <Link href="/dashboard/platform/matters" className={trackItemClass(false)}><ArrowLeft className="size-4" aria-hidden="true" />Matters</Link>
        <Link href={`/dashboard/matters/${encodeURIComponent(matter.id)}`} className={trackItemClass(false)}><Settings2 className="size-4" aria-hidden="true" />Fields</Link>
        <Link href="/dashboard/platform/billing" className={trackItemClass(false)}><ReceiptText className="size-4" aria-hidden="true" />Bill</Link>
        <Link href={`/dashboard/platform/ai/matters/${encodeURIComponent(matter.id)}`} className={trackItemClass(true)}><BrainCircuit className="size-4" aria-hidden="true" />AI evidence</Link>
      </Track>}
    >
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border xl:grid-cols-4" aria-label="Matter identity">
          {[
            ['Client', matter.client?.displayName || 'Unavailable'],
            ['Responsible attorney', matter.responsibleAttorney?.name || 'Unassigned'],
            ['Office', matter.office?.name || 'No office'],
            ['Practice area', matter.practiceArea?.name || 'No practice area'],
          ].map(([label, value]) => <div key={label} className="min-w-0 bg-card px-4 py-3"><dt className="truncate text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-sm font-semibold text-foreground">{value}</dd></div>)}
        </dl>

        {['open', 'on_hold', 'closing'].includes(matter.status) ? <DeskCreatePanel desk="matters" timeZone={timeZone} matter={{ id: matter.id, label: `${matter.matterNumber} · ${matter.title}` }} /> : null}

        <SectionJumps sections={sections.map((section) => ({ key: section.key, title: section.title, total: section.pagination ? section.total ?? 0 : section.rows.length }))} />

        <div className="grid items-start gap-6 xl:grid-cols-2">
          {sections.map((section) => (
            <section key={section.key} id={section.key} className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-labelledby={`${section.key}-heading`}>
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 id={`${section.key}-heading`} className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-foreground"><span className="truncate">{section.title}</span><span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{(section.pagination ? section.total ?? 0 : section.rows.length).toLocaleString()}</span></h2>
              </header>
              {!section.rows.length ? <div className="p-4"><EmptyState title={`No ${section.title.toLowerCase()}`} /></div> : (
                <ul className="divide-y divide-border">
                  {section.rows.map((row) => <li key={row.id} className="min-w-0 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusDot tone={statusTone(row.status)} />
                      <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{row.href ? <Link href={row.href} className="underline-offset-4 hover:underline">{row.title}</Link> : row.title}</h3>
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(row.status)}</span>
                    </div>
                    <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{row.meta}</p>
                  </li>)}
                </ul>
              )}
              {(section.key === 'team' || section.key === 'parties' || section.key === 'communications' || section.key === 'deadlines' || section.key === 'tasks' || section.key === 'documents' || section.key === 'invoices') && section.pagination ? <MatterWorkspacePagination sectionKey={section.key} matterId={matter.id} total={section.total ?? 0} pagination={section.pagination} teamPage={teamPage} partyPage={partyPage} communicationPage={communicationPage} deadlinePage={deadlinePage} taskPage={taskPage} documentPage={documentPage} invoicePage={invoicePage} /> : null}
            </section>
          ))}
        </div>
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
    <div className="border-t border-border px-4 py-3">
      <Pager
        label={`${registerLabel} register pages`}
        previous={pagination.hasPrevious ? href(pagination.page - 1) : null}
        next={pagination.hasNext ? href(pagination.page + 1) : null}
        summary={`${pagination.loadedCount ? `${pagination.firstItem.toLocaleString()}–${pagination.lastItem.toLocaleString()}` : '0'} of ${total.toLocaleString()} ${recordLabel} · page ${pagination.page} of ${pagination.pageCount}`}
      />
    </div>
  )
}
