import Link from 'next/link'
import { ArrowRight, Clock3, Settings2 } from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import { PracticeRowAction } from '@/features/platform/components/PracticeRowAction'
import { PracticeLoadError, PracticePage, PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { WorkspaceRegisterView } from '@/features/platform/components/WorkspaceRegisterView'
import { formatInstant, isTimeSensitiveKind } from '@/features/platform/lib/datetime'
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
      actions={<Link href="/dashboard/models" className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Settings2 className="h-4 w-4" aria-hidden="true" /> Configuration</Link>}
    >
      {!response.success ? <PracticeLoadError message={response.error} /> : registerResult ? (
        registerResult.success
          ? <WorkspaceRegisterView register={registerResult.data} backHref={`/dashboard/platform/${desk}`} backLabel={definition.title} timeZone={timeZone} rowHref={(item) => deskItemHref(desk, item)} />
          : <PracticeLoadError message={registerResult.error} />
      ) : (
        <div className="space-y-8">
          <DeskCreatePanel desk={desk} timeZone={timeZone} />
          {desk === 'time-expenses' ? <LocalTimer /> : null}
          <div className="space-y-10">
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
          <Link href="/dashboard/models" className="inline-flex min-h-11 items-center text-sm font-semibold underline">Data model explorer</Link>
        </div>
      )}
    </PracticePage>
  )
}

function DeskLane({ desk, section, label, timeZone, paginationHrefs }: { desk: DeskKind; section: PracticeWorkspaceSection; label: string; timeZone: string; paginationHrefs?: { previous: string | null; next: string | null } }) {
  return (
    <section id={section.key} className="scroll-mt-20" aria-labelledby={`${section.key}-heading`}>
      <div className="flex min-w-0 items-end justify-between gap-4 border-b border-border pb-3">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><h2 id={`${section.key}-heading`} className="mt-1 text-lg font-bold tracking-tight text-foreground">{section.title}</h2></div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">{section.total.toLocaleString()}</span>
          {section.total ? <Link href={registerHref(desk, { view: section.key })} className="inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline-offset-4 hover:underline">Search all</Link> : null}
        </div>
      </div>
      {!section.items.length ? <div className="mt-4 border-y border-dashed border-border px-3 py-6 text-sm text-muted-foreground">No authorized records currently require attention.</div> : (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {section.items.map((item) => {
            const href = deskItemHref(desk, item)
            const heading = <>
              <span className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-bold text-foreground group-hover:underline group-hover:underline-offset-4">{item.title}</span>{href ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" /> : null}</span>
              <span className="mt-1 block truncate text-sm text-muted-foreground">{item.subtitle}</span>
            </>
            return <article key={`${item.kind}-${item.id}`} className="grid min-w-0 gap-3 px-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3">
              {href ? <Link href={href} className="group min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{heading}</Link> : <div className="min-w-0">{heading}</div>}
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground">{item.at ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> : null}{item.at ? formatInstant(item.at, timeZone, { includeTime: isTimeSensitiveKind(item.kind) }) : 'No date'}</span>
                <PracticeStatus status={item.status} />
                <PracticeRowAction id={item.id} kind={item.kind} status={item.status} path={`/dashboard/platform/${desk}`} canAct={item.canAct} />
              </div>
            </article>
          })}
        </div>
      )}
      {section.pagination && paginationHrefs ? (
        <nav aria-label={`${section.title} pages`} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="space-y-1 text-xs leading-5 text-muted-foreground">
            <p>
              {section.pagination.loadedCount
                ? `Showing ${section.pagination.firstItem.toLocaleString()}–${section.pagination.lastItem.toLocaleString()}`
                : 'No records returned on this page'} of {section.total.toLocaleString()} authorized records · page {section.pagination.page} of {section.pagination.pageCount}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {paginationHrefs.previous ? (
              <Link href={paginationHrefs.previous} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Previous</Link>
            ) : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Previous</span>}
            {paginationHrefs.next ? (
              <Link href={paginationHrefs.next} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Next</Link>
            ) : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Next</span>}
          </div>
        </nav>
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
  if (!viewer || viewer.status !== "active" || viewer.activeFirm?.status !== "active") return <p role="status">The timer is unavailable. Reload after signing in to your firm.</p>
  const scopeKey = `${viewer.id}:${viewer.activeFirm.id}`
  return <section className="border-y border-border bg-background px-4 py-5" aria-labelledby="local-timer-heading"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Timer capture</p><h2 id="local-timer-heading" className="mt-1 text-lg font-bold tracking-tight">Personal elapsed time</h2><LocalTimerClient key={scopeKey} scopeKey={scopeKey} /></section>
}

