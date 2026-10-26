import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import { PracticeLoadError, PracticePage, RecordSection, RecordTable, SectionJumps } from '@/features/platform/components/PracticeSurface'
import { Pager, Track, actionLinkClass, pillClass, pillPrimaryClass } from '@/features/platform/components/ui'
import { WorkspaceRegisterView } from '@/features/platform/components/WorkspaceRegisterView'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { platformDestinationTitle } from '@/features/platform/lib/navigation'
import { getPracticeWorkspace } from '@/features/platform/operations/actions'
import { getWorkspaceRegister } from '@/features/platform/operations/actions/getWorkspaceRegister'
import { registerHref, type RegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import type { PracticeOverviewQueueItem, PracticeWorkspaceSection } from '@/features/platform/operations/types'
import { sectionEmptyCopy } from '@/features/platform/lib/emptyCopy'
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
      actions={desk === 'matters' ? (
        <Track label="Open a matter">
          <Link href="/dashboard/platform/intake#intake-conversion" className={pillClass}>From a cleared intake</Link>
          <Link href="/dashboard/platform/intake#new-intake-heading" className={pillPrimaryClass}><Plus className="size-4" aria-hidden="true" />Start client intake</Link>
        </Track>
      ) : undefined}
    >
      {!response.success ? <PracticeLoadError message={response.error} /> : registerResult ? (
        registerResult.success
          ? <WorkspaceRegisterView register={registerResult.data} backHref={`/dashboard/platform/${desk}`} backLabel={definition.title} timeZone={timeZone} rowHref={(item) => deskItemHref(desk, item)} />
          : <PracticeLoadError message={registerResult.error} />
      ) : (
        <div className="space-y-8 pb-24 sm:pb-0">
          <SectionJumps sections={[
            ...(desk === 'time-expenses' ? [{ key: 'capture', title: 'Capture' }] : []),
            ...response.data.sections.map((section) => ({ key: section.key, title: section.title, total: section.total })),
            ...(desk !== 'time-expenses' && desk !== 'matters' ? [{ key: 'capture', title: 'New' }] : []),
          ]} />
          {desk === 'time-expenses' ? (
            <div id="capture" className="grid scroll-mt-28 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <LocalTimer />
              <DeskCreatePanel desk={desk} timeZone={timeZone} />
            </div>
          ) : null}
          {response.data.sections.map((section) => (
            <DeskLane
              key={section.key}
              desk={desk}
              section={section}
              timeZone={timeZone}
              paginationHrefs={getPaginationHrefs(desk, section, response.data.sections)}
            />
          ))}
          {desk !== 'time-expenses' && desk !== 'matters' ? <div id="capture" className="scroll-mt-28"><DeskCreatePanel desk={desk} timeZone={timeZone} /></div> : null}
        </div>
      )}
    </PracticePage>
  )
}

function DeskLane({ desk, section, timeZone, paginationHrefs }: { desk: DeskKind; section: PracticeWorkspaceSection; timeZone: string; paginationHrefs?: { previous: string | null; next: string | null } }) {
  const kinds = new Set(section.items.map((item) => item.kind))
  return (
    <RecordSection
      id={section.key}
      title={section.title}
      count={section.total}
      empty={!section.items.length}
      actions={section.total ? <Link href={registerHref(desk, { view: section.key })} className={actionLinkClass}>Search all<ArrowRight className="size-3.5" aria-hidden="true" /></Link> : undefined}
      footer={section.pagination && paginationHrefs && section.total > 0 ? (
        <Pager
          label={`${section.title} pages`}
          previous={paginationHrefs.previous}
          next={paginationHrefs.next}
          summary={`${section.pagination.firstItem.toLocaleString()}–${section.pagination.lastItem.toLocaleString()} of ${section.total.toLocaleString()}`}
        />
      ) : undefined}
    >
      <RecordTable items={section.items} rowHref={(item) => deskItemHref(desk, item)} actionPath={`/dashboard/platform/${desk}`} timeZone={timeZone} anchor={section.key} empty={sectionEmptyCopy(section.key)} showKind={kinds.size > 1} label={section.title} />
    </RecordSection>
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
  if (!viewer || viewer.status !== "active" || viewer.activeFirm?.status !== "active") return <p role="status" className="rounded-[6px] border border-border px-4 py-4 text-sm text-muted-foreground">Timer unavailable. Sign in to your firm and reload.</p>
  const scopeKey = `${viewer.id}:${viewer.activeFirm.id}`
  return <section className="min-w-0 overflow-hidden rounded-[6px] border border-border bg-card" aria-labelledby="local-timer-heading"><header className="border-b border-border bg-[var(--lf-manila)] px-4 py-2.5"><h2 id="local-timer-heading" className="text-sm font-semibold">Timer</h2></header><div className="p-4"><LocalTimerClient key={scopeKey} scopeKey={scopeKey} /></div></section>
}
