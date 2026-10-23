import Link from 'next/link'
import { ArrowUpRight, Settings2 } from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import { PracticeLoadError, PracticePage, QueueRow, SectionJumps } from '@/features/platform/components/PracticeSurface'
import { EmptyState, Pager, Track, trackItemClass } from '@/features/platform/components/ui'
import { WorkspaceRegisterView } from '@/features/platform/components/WorkspaceRegisterView'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { platformDestinationTitle } from '@/features/platform/lib/navigation'
import { getPracticeWorkspace } from '@/features/platform/operations/actions'
import { getWorkspaceRegister } from '@/features/platform/operations/actions/getWorkspaceRegister'
import { registerHref, type RegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import type { PracticeOverviewQueueItem, PracticeWorkspaceSection } from '@/features/platform/operations/types'
import { DeskCreatePanel } from './DeskCreatePanel'
import { LocalTimerClient } from './TimerControl'

export type DeskKind = 'matters' | 'work' | 'documents' | 'communications' | 'time-expenses'

type DeskDefinition = {
  title: string
  description: string
  eyebrow: string
  notice: string
  sectionLabels: Record<string, string>
  detailKind: Record<string, string>
}

const desks: Record<DeskKind, DeskDefinition> = {
  matters: {
    title: 'Matters',
    description: 'Direct the active matter portfolio around accountable ownership, deadlines, access decisions, and next work.',
    eyebrow: 'Matter command',
    notice: 'Open a matter to review its authorized team, deadlines, work, documents, communications, and billing evidence. Ethical-wall decisions remain enforced at every drill-in.',
    sectionLabels: { active: 'Client · responsible attorney · matter state', walls: 'Matter · access decision · current state' },
    detailKind: { Matter: 'matter' },
  },
  work: {
    title: 'Calendar & tasks',
    description: 'Run verified deadlines, docket activity, consultations, and assigned work by owner and due state.',
    eyebrow: 'Work control',
    notice: 'Due dates are operational review data. Court-rule calculation, recurrence, reminders, filing acceptance, and calendar sync are not configured or implied.',
    sectionLabels: { consultations: 'Host · scheduled time · intake', docket: 'Matter · docket · verification', deadlines: 'Matter · verification · owner', tasks: 'Matter · priority · owner' },
    detailKind: { Consultation: 'consultation', 'Docket entry': 'docket-entry', Deadline: 'deadline', Task: 'task' },
  },
  documents: {
    title: 'Documents',
    description: 'Review document versions, signature handoffs, confidentiality, and retention or hold state without treating storage as configured.',
    eyebrow: 'Record control',
    notice: 'File storage, downloads, OCR, generation, and signature execution require configured providers. This desk preserves the authorized version, signature, and hold record only.',
    sectionLabels: { documents: 'Category · record state · latest update', signatures: 'Workflow state · application timestamp' },
    detailKind: { Document: 'document', 'Signature request': 'signature-request' },
  },
  communications: {
    title: 'Communications',
    description: 'Keep client threads, review-ready drafts, and delivery exceptions together with their matter scope.',
    eyebrow: 'Client delivery',
    notice: 'This desk records authorized thread and delivery state. Outbound or inbound email, SMS, and messaging workers are not represented as configured.',
    sectionLabels: { drafts: 'Matter · channel · controlled delivery', threads: 'Matter or intake · channel · activity', delivery: 'Channel · delivery state · attempts' },
    detailKind: { Message: 'message', Thread: 'thread', Delivery: 'delivery' },
  },
  'time-expenses': {
    title: 'Time & expenses',
    description: 'Capture time against a matter, then review ownership, billability, and lifecycle state before billing assembly.',
    eyebrow: 'WIP review',
    notice: 'The timer keeps its draft in this browser until you save it as a draft time entry. Submission, approval and billing remain separate controlled steps.',
    sectionLabels: { time: 'Matter · elapsed work · billability', expenses: 'Matter · amount · vendor or billability' },
    detailKind: { 'Time entry': 'time-entry', Expense: 'expense' },
  },
}

// Desk rows open the platform drill-in for their kind; a kind with no drill-in (for
// example an ethical-wall decision) renders as plain text instead of a link that would
// only reload the desk.
export function deskItemHref(desk: DeskKind, item: Pick<PracticeOverviewQueueItem, 'id' | 'kind'>) {
  if (desk === 'matters' && item.kind === 'Matter') return `/dashboard/platform/matters/${encodeURIComponent(item.id)}`
  const kind = desks[desk].detailKind[item.kind]
  return kind ? `/dashboard/platform/${desk}/${kind}/${encodeURIComponent(item.id)}` : null
}

export function deskDetailKinds(desk: DeskKind) {
  return Object.values(desks[desk].detailKind)
}

// Desk headings come from the sidebar destination so both always name the same place.
export function deskTitle(desk: DeskKind) {
  return platformDestinationTitle(`/dashboard/platform/${desk}`, desks[desk].title)
}

export async function OperatingDesk({
  desk,
  workPages,
  deliveryPage,
  documentPage,
  signaturePage,
  register,
}: {
  desk: DeskKind
  workPages?: { deadlines: number; tasks: number }
  deliveryPage?: number
  documentPage?: number
  signaturePage?: number
  register?: RegisterParams | null
}) {
  const definition = { ...desks[desk], title: deskTitle(desk) }
  const [response, timeZone] = await Promise.all([
    getPracticeWorkspace(desk, { ...workPages, delivery: deliveryPage, documents: documentPage, signatures: signaturePage }),
    getFirmTimeZone(),
  ])
  const registerSection = register && response.success ? response.data.sections.find((section) => section.key === register.view) : undefined
  const registerResult = register && registerSection
    ? await getWorkspaceRegister(desk, register, { title: registerSection.title, description: registerSection.description, canAct: registerSection.items[0]?.canAct ?? false })
    : null

  return (
    <PracticePage
      title={definition.title}
      description={definition.description}
      actions={<Track><Link href="/dashboard/models" className={trackItemClass(true)}><Settings2 className="size-4" aria-hidden="true" /> Data model</Link></Track>}
    >
      {!response.success ? <PracticeLoadError message={response.error} /> : registerResult ? (
        registerResult.success
          ? <WorkspaceRegisterView register={registerResult.data} backHref={`/dashboard/platform/${desk}`} backLabel={definition.title} timeZone={timeZone} rowHref={(item) => deskItemHref(desk, item)} />
          : <PracticeLoadError message={registerResult.error} />
      ) : (
        <div className="space-y-6">
          <SectionJumps sections={response.data.sections.map((section) => ({ key: section.key, title: section.title, total: section.total }))} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <DeskCreatePanel desk={desk} timeZone={timeZone} />
            {desk === 'time-expenses' ? <LocalTimer /> : null}
          </div>
          <div className="space-y-6">
            {response.data.sections.map((section) => (
              <DeskLane
                key={section.key}
                desk={desk}
                section={section}
                label={definition.sectionLabels[section.key] ?? 'Scope · state · activity'}
                timeZone={timeZone}
                paginationHrefs={getPaginationHrefs(desk, section, response.data.sections)}
              />
            ))}
          </div>
        </div>
      )}
    </PracticePage>
  )
}

function DeskLane({ desk, section, label, timeZone, paginationHrefs }: { desk: DeskKind; section: PracticeWorkspaceSection; label: string; timeZone: string; paginationHrefs?: { previous: string | null; next: string | null } }) {
  return (
    <section id={section.key} className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-labelledby={`${section.key}-heading`}>
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={`${section.key}-heading`} className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-foreground">
            <span className="truncate">{section.title}</span>
            <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{section.total.toLocaleString()}</span>
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
        </div>
        {section.total ? <Track><Link href={registerHref(desk, { view: section.key })} className={trackItemClass(true)}>Search all <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></Track> : null}
      </header>
      {!section.items.length ? <div className="p-4"><EmptyState title={`No ${section.title.toLowerCase()}`} /></div> : (
        <ul className="divide-y divide-border">
          {section.items.map((item) => (
            <QueueRow key={`${item.kind}-${item.id}`} item={item} href={deskItemHref(desk, item)} actionPath={`/dashboard/platform/${desk}`} timeZone={timeZone} />
          ))}
        </ul>
      )}
      {section.pagination && paginationHrefs ? (
        <div className="border-t border-border px-4 py-3">
          <Pager
            label={`${section.title} pages`}
            previous={paginationHrefs.previous}
            next={paginationHrefs.next}
            summary={section.pagination.loadedCount
              ? `${section.pagination.firstItem.toLocaleString()}–${section.pagination.lastItem.toLocaleString()} of ${section.total.toLocaleString()} · page ${section.pagination.page} of ${section.pagination.pageCount}`
              : `0 of ${section.total.toLocaleString()} · page ${section.pagination.page} of ${section.pagination.pageCount}`}
          />
        </div>
      ) : null}
    </section>
  )
}

function getPaginationHrefs(desk: DeskKind, section: PracticeWorkspaceSection, sections: PracticeWorkspaceSection[]) {
  if (!section.pagination) return undefined
  if (desk === 'work') return getWorkPageHrefs(section, sections)
  if (desk === 'communications' && section.key === 'delivery') return getDeliveryPageHrefs(section)
  if (desk === 'documents') return getDocumentDeskPageHrefs(section, sections)
  return undefined
}

function getDocumentDeskPageHrefs(section: PracticeWorkspaceSection, sections: PracticeWorkspaceSection[]) {
  if (!section.pagination || !['documents', 'signatures'].includes(section.key)) return undefined
  const documentPage = sections.find((candidate) => candidate.key === 'documents')?.pagination?.page ?? 1
  const signaturePage = sections.find((candidate) => candidate.key === 'signatures')?.pagination?.page ?? 1
  const href = (page: number) => {
    const params = new URLSearchParams({
      documentPage: String(section.key === 'documents' ? page : documentPage),
      signaturePage: String(section.key === 'signatures' ? page : signaturePage),
    })
    return `/dashboard/platform/documents?${params.toString()}#${section.key}`
  }
  return {
    previous: section.pagination.hasPrevious ? href(section.pagination.page - 1) : null,
    next: section.pagination.hasNext ? href(section.pagination.page + 1) : null,
  }
}

function getDeliveryPageHrefs(section: PracticeWorkspaceSection) {
  if (!section.pagination) return undefined
  const href = (page: number) => `/dashboard/platform/communications?deliveryPage=${page}#delivery`
  return {
    previous: section.pagination.hasPrevious ? href(section.pagination.page - 1) : null,
    next: section.pagination.hasNext ? href(section.pagination.page + 1) : null,
  }
}

function getWorkPageHrefs(section: PracticeWorkspaceSection, sections: PracticeWorkspaceSection[]) {
  if (!section.pagination || !['deadlines', 'tasks'].includes(section.key)) return undefined
  const deadlinePage = sections.find((candidate) => candidate.key === 'deadlines')?.pagination?.page ?? 1
  const taskPage = sections.find((candidate) => candidate.key === 'tasks')?.pagination?.page ?? 1
  const href = (page: number) => {
    const params = new URLSearchParams({
      deadlinePage: String(section.key === 'deadlines' ? page : deadlinePage),
      taskPage: String(section.key === 'tasks' ? page : taskPage),
    })
    return `/dashboard/platform/work?${params.toString()}#${section.key}`
  }
  return {
    previous: section.pagination.hasPrevious ? href(section.pagination.page - 1) : null,
    next: section.pagination.hasNext ? href(section.pagination.page + 1) : null,
  }
}

async function LocalTimer() {
  const response = await keystoneClient<{ authenticatedItem: { id: string; status: string; activeFirm: { id: string; status: string } | null } | null }>(`query TimerScope { authenticatedItem { ... on User { id status activeFirm { id status } } } }`)
  const viewer = response.success ? response.data.authenticatedItem : null
  if (!viewer || viewer.status !== "active" || viewer.activeFirm?.status !== "active") return <p role="status" className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">Timer unavailable. Sign in to your firm and reload.</p>
  const scopeKey = `${viewer.id}:${viewer.activeFirm.id}`
  return <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-labelledby="local-timer-heading"><header className="border-b border-border px-4 py-3"><h2 id="local-timer-heading" className="text-sm font-semibold">Timer</h2></header><div className="p-4"><LocalTimerClient key={scopeKey} scopeKey={scopeKey} /></div></section>
}
