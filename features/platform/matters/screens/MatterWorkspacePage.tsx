import Link from 'next/link'
import { ArrowLeft, BrainCircuit, Gavel, ReceiptText, Settings2 } from 'lucide-react'

import { PracticePage, PracticeStatus, SectionJumps } from '@/features/platform/components/PracticeSurface'
import { EmptyState, ErrorBanner, FileLabel, Pager, Panel, StatusText, Track, statusLabel, trackItemClass } from '@/features/platform/components/ui'
import type { WorkQueuePageInfo } from '@/features/platform/operations/lib/workQueuePagination'
import { getMatterWorkspace } from '../actions/getMatterWorkspace'
import { DeskCreatePanel } from '@/features/platform/desks/DeskCreatePanel'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { PracticeRowAction } from '@/features/platform/components/PracticeRowAction'
import { getMatterAdministration } from '../actions/getMatterAdministration'
import { ConfidentialityPanel, EthicalWallsPanel, MatterTeamPanel, StatusHistoryList } from '../components/MatterAdministrationPanels'

export async function MatterWorkspacePage({ matterId, teamPage = 1, partyPage = 1, communicationPage = 1, deadlinePage = 1, taskPage = 1, documentPage = 1, invoicePage = 1 }: { matterId: string; teamPage?: number; partyPage?: number; communicationPage?: number; deadlinePage?: number; taskPage?: number; documentPage?: number; invoicePage?: number }) {
  const [result, timeZone, admin] = await Promise.all([getMatterWorkspace(matterId, { teamPage, partyPage, communicationPage, deadlinePage, taskPage, documentPage, invoicePage }), getFirmTimeZone(), getMatterAdministration(matterId)])
  if (!result.success) {
    return <PracticePage title="Matter unavailable" description="The requested matter was not returned within the current authorization scope." trail={[{ label: 'Matters', href: '/dashboard/platform/matters' }, { label: 'Matter unavailable' }]}><ErrorBanner>{result.error}</ErrorBanner></PracticePage>
  }
  const { matter } = result.data
  // The team-access panel replaces the read-only team register when the viewer can read it.
  const sections = admin.team ? result.data.sections.filter((section) => section.key !== 'team') : result.data.sections
  // Obligations first (deadlines, tasks), then the file's records, then who is on it.
  const sectionOrder = ['deadlines', 'tasks', 'documents', 'communications', 'invoices', 'parties', 'team']
  const orderedSections = [...sections].sort((a, b) => (sectionOrder.indexOf(a.key) + 1 || 99) - (sectionOrder.indexOf(b.key) + 1 || 99))
  return (
    <PracticePage
      title={matter.title}
      description="Authorized matter workspace for team, parties, work, documents, communications, and billing evidence."
      status={<PracticeStatus status={matter.status} />}
      meta={<span className="flex flex-wrap items-center gap-2"><FileLabel>{matter.matterNumber}</FileLabel><span>{matter.client?.displayName || 'Client unavailable'}</span><span aria-hidden="true">·</span><span>{statusLabel(matter.confidentiality)}</span></span>}
      trail={[{ label: 'Matters', href: '/dashboard/platform/matters' }, { label: matter.matterNumber }]}
      actions={<>
      <PracticeRowAction id={matter.id} kind="Matter" status={matter.status} path={`/dashboard/platform/matters/${encodeURIComponent(matter.id)}`} canAct={admin.canActOnMatter} timeZone={timeZone} />
      <Track>
        <Link href="/dashboard/platform/matters" className={trackItemClass(false)}><ArrowLeft className="size-4" aria-hidden="true" />Matters</Link>
        <Link href={`/dashboard/matters/${encodeURIComponent(matter.id)}`} className={trackItemClass(false)}><Settings2 className="size-4" aria-hidden="true" />Fields</Link>
        <Link href={`/dashboard/platform/ai/matters/${encodeURIComponent(matter.id)}`} className={trackItemClass(true)}><BrainCircuit className="size-4" aria-hidden="true" />AI evidence</Link>
        <Link href="/dashboard/platform/billing#draft-invoice" className={trackItemClass(true)}><ReceiptText className="size-4" aria-hidden="true" />Bill</Link>
      </Track>
      </>}
    >
      <div className="space-y-6">
        <SectionJumps sections={orderedSections.map((section) => ({ key: section.key, title: section.title, total: section.pagination ? section.total ?? 0 : section.rows.length }))} />
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0 space-y-8">
            {['open', 'on_hold', 'closing'].includes(matter.status) ? <DeskCreatePanel desk="matters" timeZone={timeZone} matter={{ id: matter.id, label: `${matter.matterNumber} · ${matter.title}` }} /> : null}
            {orderedSections.map((section) => {
              const count = section.pagination ? section.total ?? 0 : section.rows.length
              return (
                <section key={section.key} id={section.key} className="min-w-0 scroll-mt-28" aria-labelledby={`${section.key}-heading`}>
                  <header className="mb-2 flex min-w-0 items-baseline gap-2">
                    <h2 id={`${section.key}-heading`} className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-foreground">{section.title}</h2>
                    <span className="lf-figures text-sm text-muted-foreground">{count.toLocaleString()}</span>
                  </header>
                  <div className="min-w-0 overflow-hidden rounded-[6px] border border-border bg-card">
                    {!section.rows.length ? <EmptyState className="px-4 py-3" title={`No ${section.title.toLowerCase()}`} /> : (
                      <ul className="divide-y divide-border">
                        {section.rows.map((row) => <li key={row.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5 hover:bg-muted/40">
                          <div className="min-w-0">
                            <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{row.href ? <Link href={row.href} className="underline-offset-4 hover:text-[var(--lf-rust-ink)] hover:underline">{row.title}</Link> : row.title}</h3>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.meta}</p>
                          </div>
                          <StatusText status={row.status} />
                        </li>)}
                      </ul>
                    )}
                    {(section.key === 'team' || section.key === 'parties' || section.key === 'communications' || section.key === 'deadlines' || section.key === 'tasks' || section.key === 'documents' || section.key === 'invoices') && section.pagination ? <MatterWorkspacePagination sectionKey={section.key} matterId={matter.id} total={section.total ?? 0} pagination={section.pagination} teamPage={teamPage} partyPage={partyPage} communicationPage={communicationPage} deadlinePage={deadlinePage} taskPage={taskPage} documentPage={documentPage} invoicePage={invoicePage} /> : null}
                  </div>
                </section>
              )
            })}
          </div>

          <aside aria-label="Matter file" className="min-w-0 space-y-6 xl:sticky xl:top-14">
            <dl className="divide-y divide-border overflow-hidden rounded-[6px] border border-border bg-[var(--lf-manila)]" aria-label="Matter identity">
              {[
                ['Client', matter.client?.displayName || 'Unavailable'],
                ['Responsible attorney', matter.responsibleAttorney?.name || 'Unassigned'],
                ['Office', matter.office?.name || 'No office'],
                ['Practice area', matter.practiceArea?.name || 'No practice area'],
              ].map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[9rem_minmax(0,1fr)] gap-3 px-4 py-2.5"><dt className="truncate text-xs text-muted-foreground">{label}</dt><dd className="truncate text-sm font-medium text-foreground">{value}</dd></div>)}
            </dl>
            <Panel
              id="dockets"
              title={<h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-foreground"><span className="truncate">Dockets</span><span className="lf-figures text-xs font-normal text-muted-foreground">{(admin.dockets?.length ?? 0).toLocaleString()}</span></h2>}
              actions={<Link href="/dashboard/platform/dockets" className={trackItemClass(false)}><Gavel className="size-3.5" aria-hidden="true" />Courts &amp; dockets</Link>}
              bodyClassName="p-0"
            >
              {!admin.dockets ? <EmptyState className="px-4 py-3" title="Dockets are unavailable to your role" /> : admin.dockets.length ? (
                <ul className="divide-y divide-border">
                  {admin.dockets.map((docket) => <li key={docket.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <h3 className="min-w-0 truncate font-mono text-sm font-medium text-foreground"><Link href={`/dashboard/platform/dockets/${encodeURIComponent(docket.id)}`} className="underline-offset-4 hover:underline">{docket.docketNumber}</Link></h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{[docket.title, docket.court?.name].filter(Boolean).join(' · ')}</p>
                    </div>
                    <StatusText status={docket.status} />
                  </li>)}
                </ul>
              ) : <EmptyState className="px-4 py-3" title="No dockets" />}
            </Panel>
            <MatterTeamPanel matterId={matter.id} team={admin.team} />
            <ConfidentialityPanel matterId={matter.id} confidentiality={matter.confidentiality} />
            <EthicalWallsPanel matterId={matter.id} walls={admin.walls} />
            <StatusHistoryList history={admin.history} timeZone={timeZone} />
          </aside>
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
