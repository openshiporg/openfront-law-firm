import type { ReactNode } from 'react'
import { formatInstant, validTimeZone } from '@/features/platform/lib/datetime'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CalendarClock, CheckSquare2, History } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { CitationPolicy } from '@/features/platform/legal-ai/citations/components/CitationPolicy'
import { DocumentEvidenceList } from '@/features/platform/legal-ai/documents/components/DocumentEvidenceList'
import { getLegalAiMatterWorkspace } from '../actions/getLegalAiWorkspace'
import { EmptyEvidence, EvidencePager, LegalAiBoundaryNotice, LegalAiPage } from '../components/LegalAiSurface'
import type { LegalAiEvidencePages } from '../actions/getLegalAiWorkspace'

export async function LegalAiMatterPage({ matterId, pages = {} }: { matterId: string; pages?: LegalAiEvidencePages }) {
  const result = await getLegalAiMatterWorkspace(matterId, pages)

  if (!result.success) {
    return (
      <LegalAiPage title="Matter evidence unavailable" description="The requested matter was not returned within the current authorization scope.">
        <LegalAiBoundaryNotice compact />
        <div className="flex min-h-36 items-center gap-3 border-y border-destructive/30 px-4 py-6 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{result.error}</p>
        </div>
        <Link href="/dashboard/platform/ai" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to authorized matters
        </Link>
      </LegalAiPage>
    )
  }

  const { matter, documents, tasks, deadlines, auditEvents, notices } = result.data
  const matterZone = validTimeZone(matter.office?.timezone) ?? validTimeZone(matter.firm?.defaultTimezone) ?? 'UTC'
  const current = { documentPage: result.data.pages.documents.page, taskPage: result.data.pages.tasks.page, deadlinePage: result.data.pages.deadlines.page, auditPage: result.data.pages.auditEvents.page }
  const pageHref = (key: keyof LegalAiEvidencePages, anchor: string) => (page: number) => `/dashboard/platform/ai/matters/${encodeURIComponent(matter.id)}?${new URLSearchParams(Object.entries({ ...current, [key]: page }).map(([name, value]) => [name, String(value)])).toString()}#${anchor}`
  return (
    <LegalAiPage
      title={`${matter.matterNumber} · ${matter.title}`}
      description="A bounded, read-only evidence preparation view. It does not summarize, draft, predict, or determine legal authority."
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Link href="/dashboard/platform/ai" className="mr-2 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Legal AI
        </Link>
        <PracticeStatus status={matter.status} />
        <PracticeStatus status={matter.confidentiality} />
        <span className="truncate text-sm text-muted-foreground">{matter.client?.displayName || 'Client unavailable'}</span>
      </div>

      <LegalAiBoundaryNotice compact />
      

      <div id="evidence-documents" className="scroll-mt-20">
        {!documents.length && result.data.pages.documents.total === null ? <EmptyEvidence>Document inventory is unavailable. Retry this page.</EmptyEvidence> : <DocumentEvidenceList documents={documents} />}
        <EvidencePager label="Documents" {...result.data.pages.documents} href={pageHref('documentPage', 'evidence-documents')} />
      </div>

      <div className="grid min-w-0 gap-8 xl:grid-cols-2">
        <EvidenceList
          title="Tasks"
          icon={CheckSquare2}
          empty={result.data.pages.tasks.total === null ? "Task inventory is unavailable. Retry this page." : "No authorized tasks are available."}
          rows={tasks.map((task) => ({
            id: task.id,
            title: task.title,
            metadata: task.dueAt ? `Due ${formatInstant(task.dueAt, matterZone)}` : 'No due date',
            statuses: [task.status, task.priority],
          }))}
          pager={<EvidencePager label="Tasks" {...result.data.pages.tasks} href={pageHref('taskPage', 'evidence-tasks')} />}
          anchor="evidence-tasks"
        />
        <EvidenceList
          title="Deadlines"
          icon={CalendarClock}
          empty={result.data.pages.deadlines.total === null ? "Deadline inventory is unavailable. Retry this page." : "No authorized deadlines are available."}
          rows={deadlines.map((deadline) => ({
            id: deadline.id,
            title: deadline.title,
            metadata: deadline.dueAt ? `Due ${formatInstant(deadline.dueAt, validTimeZone(deadline.timezone) ?? matterZone)}` : 'No due date',
            statuses: [deadline.status, deadline.isVerified ? 'verified' : 'unverified'],
          }))}
          pager={<EvidencePager label="Deadlines" {...result.data.pages.deadlines} href={pageHref('deadlinePage', 'evidence-deadlines')} />}
          anchor="evidence-deadlines"
        />
      </div>

      <EvidenceList
        title="Recent matter audit evidence"
        icon={History}
        empty={result.data.pages.auditEvents.total === null ? "Audit inventory is unavailable. Retry this page." : "No authorized audit events are available."}
        rows={auditEvents.map((event) => ({
          id: event.id,
          title: event.eventType,
          metadata: `${event.category} · ${formatInstant(event.occurredAt, matterZone)}`,
          statuses: [event.outcome],
        }))}
        pager={<EvidencePager label="Audit evidence" {...result.data.pages.auditEvents} href={pageHref('auditPage', 'evidence-audit')} />}
        anchor="evidence-audit"
      />

      <CitationPolicy />

      <section className="border-y border-border bg-muted/20 px-4 py-4" aria-labelledby="scope-notices-heading">
        <h2 id="scope-notices-heading" className="text-sm font-bold text-foreground">Scope notices</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {notices.map((notice) => <li key={notice}>{notice}</li>)}
        </ul>
      </section>
    </LegalAiPage>
  )
}

function EvidenceList({
  title,
  icon: Icon,
  empty,
  rows,
  pager,
  anchor,
}: {
  title: string
  icon: typeof CheckSquare2
  empty: string
  rows: Array<{ id: string; title: string; metadata: string; statuses: string[] }>
  pager?: ReactNode
  anchor?: string
}) {
  return (
    <section id={anchor} className="min-w-0 scroll-mt-20 border-t border-border pt-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      {!rows.length ? (
        <div className="mt-4"><EmptyEvidence>{empty}</EmptyEvidence></div>
      ) : (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <article key={row.id} className="grid min-w-0 gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-foreground">{row.title}</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">{row.metadata}</p>
              </div>
              <div className="flex flex-wrap gap-2">{row.statuses.map((status) => <PracticeStatus key={status} status={status} />)}</div>
            </article>
          ))}
        </div>
      )}
      {pager}
    </section>
  )
}
