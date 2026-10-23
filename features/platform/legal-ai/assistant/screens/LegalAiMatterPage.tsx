import type { ReactNode } from 'react'
import { formatInstant, validTimeZone } from '@/features/platform/lib/datetime'
import Link from 'next/link'
import { ArrowLeft, CalendarClock, CheckSquare2, History } from 'lucide-react'

import { ErrorBanner, Meta, MetaGrid, Panel, RowList, StatusText, TitleLine, Track, statusLabel, trackItemClass } from '@/features/platform/components/ui'
import { CitationPolicy } from '@/features/platform/legal-ai/citations/components/CitationPolicy'
import { DocumentEvidenceList } from '@/features/platform/legal-ai/documents/components/DocumentEvidenceList'
import { getLegalAiMatterWorkspace } from '../actions/getLegalAiWorkspace'
import { EmptyEvidence, EvidencePager, LegalAiBoundaryNotice, LegalAiPage } from '../components/LegalAiSurface'
import type { LegalAiEvidencePages } from '../actions/getLegalAiWorkspace'

function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Track>
      <Link href={href} className={trackItemClass(true)}>
        <ArrowLeft className="size-3.5" aria-hidden="true" /> {children}
      </Link>
    </Track>
  )
}

export async function LegalAiMatterPage({ matterId, pages = {} }: { matterId: string; pages?: LegalAiEvidencePages }) {
  const result = await getLegalAiMatterWorkspace(matterId, pages)

  if (!result.success) {
    return (
      <LegalAiPage title="Matter evidence unavailable" description="The requested matter was not returned within the current authorization scope.">
        <BackLink href="/dashboard/platform/ai">Authorized matters</BackLink>
        <LegalAiBoundaryNotice compact />
        <ErrorBanner title="Matter evidence unavailable">{result.error}</ErrorBanner>
      </LegalAiPage>
    )
  }

  const { matter, documents, tasks, deadlines, auditEvents, notices } = result.data
  const matterZone = validTimeZone(matter.office?.timezone) ?? validTimeZone(matter.firm?.defaultTimezone) ?? 'UTC'
  const current = { documentPage: result.data.pages.documents.page, taskPage: result.data.pages.tasks.page, deadlinePage: result.data.pages.deadlines.page, auditPage: result.data.pages.auditEvents.page }
  const pageHref = (key: keyof LegalAiEvidencePages, anchor: string) => (page: number) => `/dashboard/platform/ai/matters/${encodeURIComponent(matter.id)}?${new URLSearchParams(Object.entries({ ...current, [key]: page }).map(([name, value]) => [name, String(value)])).toString()}#${anchor}`
  const count = (total: number | null) => (total === null ? '—' : total.toLocaleString())
  return (
    <LegalAiPage
      title={`${matter.matterNumber} · ${matter.title}`}
      description="Read-only evidence set. Does not summarize, draft, predict or determine legal authority."
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <BackLink href="/dashboard/platform/ai">Legal AI</BackLink>
        <TitleLine as="p" status={matter.status} headingClassName="text-sm">{matter.client?.displayName || 'Client unavailable'}</TitleLine>
      </div>

      <LegalAiBoundaryNotice compact />

      <Panel bodyClassName="py-3">
        <MetaGrid>
          <Meta label="Confidentiality">{statusLabel(matter.confidentiality)}</Meta>
          <Meta label="Documents">{count(result.data.pages.documents.total)}</Meta>
          <Meta label="Tasks">{count(result.data.pages.tasks.total)}</Meta>
          <Meta label="Deadlines">{count(result.data.pages.deadlines.total)}</Meta>
        </MetaGrid>
      </Panel>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <div id="evidence-documents" className="scroll-mt-20">
            {!documents.length && result.data.pages.documents.total === null ? <EmptyEvidence>Document inventory unavailable. Retry this page.</EmptyEvidence> : <DocumentEvidenceList documents={documents} />}
            <EvidencePager label="Documents" {...result.data.pages.documents} href={pageHref('documentPage', 'evidence-documents')} />
          </div>

          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <EvidenceList
              title="Tasks"
              icon={CheckSquare2}
              empty={result.data.pages.tasks.total === null ? "Task inventory unavailable. Retry this page." : "No authorized tasks."}
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
              empty={result.data.pages.deadlines.total === null ? "Deadline inventory unavailable. Retry this page." : "No authorized deadlines."}
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
            title="Audit trail"
            icon={History}
            empty={result.data.pages.auditEvents.total === null ? "Audit inventory unavailable. Retry this page." : "No authorized audit events."}
            rows={auditEvents.map((event) => ({
              id: event.id,
              title: event.eventType,
              metadata: `${event.category} · ${formatInstant(event.occurredAt, matterZone)}`,
              statuses: [event.outcome],
            }))}
            pager={<EvidencePager label="Audit evidence" {...result.data.pages.auditEvents} href={pageHref('auditPage', 'evidence-audit')} />}
            anchor="evidence-audit"
          />
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-20" aria-label="Review gates">
          <CitationPolicy />
          <Panel title={<h2 id="scope-notices-heading" className="text-sm font-semibold text-foreground">Scope notices</h2>} bodyClassName="p-0">
            {notices.length ? (
              <ul aria-labelledby="scope-notices-heading" className="divide-y divide-border">
                {notices.map((notice) => <li key={notice} className="px-4 py-2.5 text-xs leading-5 text-muted-foreground">{notice}</li>)}
              </ul>
            ) : <p className="px-4 py-3 text-xs text-muted-foreground">None</p>}
          </Panel>
        </aside>
      </div>
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
    <section id={anchor} className="min-w-0 scroll-mt-20 space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h2>
      {!rows.length ? (
        <EmptyEvidence>{empty}</EmptyEvidence>
      ) : (
        <RowList>
          {rows.map((row) => {
            const [primary, ...rest] = row.statuses
            return (
              <li key={row.id} className="min-w-0 px-4 py-3">
                <TitleLine as="h3" status={primary} headingClassName="text-sm">{row.title}</TitleLine>
                <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-xs text-muted-foreground">
                  <span className="truncate">{row.metadata}</span>
                  {rest.map((status) => <StatusText key={status} status={status} />)}
                </p>
              </li>
            )
          })}
        </RowList>
      )}
      {pager}
    </section>
  )
}
