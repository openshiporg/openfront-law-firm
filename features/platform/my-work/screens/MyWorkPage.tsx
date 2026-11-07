import Link from 'next/link'
import type { ReactNode } from 'react'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { EmptyState, FileLabel, StatusText, actionLinkClass } from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

/**
 * An attorney's own desk: the consultations they host, conflict checks they asked for
 * or review, the matters they are on, their tasks, deadlines and time. Every query runs
 * as the signed-in person, so Keystone's role and matter-access filters decide what
 * appears; a section the role cannot read says so instead of failing the page.
 */

type Me = { id: string; name: string | null; email: string | null }
type Row = { id: string; href: string | null; title: ReactNode; meta: ReactNode; status?: string | null; when?: string | null }
type Section = { id: string; title: string; rows: Row[] | null; empty: string; all?: { href: string; label: string } }

const openConsultations = ['requested', 'scheduled']
const openChecks = ['requested', 'running', 'review_required']
const closedMatters = ['closed', 'declined']
const openTasks = ['open', 'in_progress', 'blocked']
const openDeadlines = ['draft', 'pending']

async function me(): Promise<Me | null> {
  const response = await keystoneClient<{ authenticatedItem: Me | null }>(`query MyWorkViewer { authenticatedItem { ... on User { id name email } } }`)
  return response.success ? response.data.authenticatedItem : null
}

async function rows<T>(query: string, variables: Record<string, unknown>, key: string, map: (item: T) => Row): Promise<Row[] | null> {
  const response = await keystoneClient<Record<string, T[] | null>>(query, variables)
  if (!response.success || !response.data[key]) return null
  return (response.data[key] as T[]).map(map)
}

const path = (desk: string, kind: string, id: string) => `/dashboard/platform/${desk}/${kind}/${encodeURIComponent(id)}`

export async function MyWorkPage() {
  const [viewer, timeZone] = await Promise.all([me(), getFirmTimeZone()])
  if (!viewer) {
    return <PracticePage title="My work" description="Your consultations, matters and work."><EmptyState title="Sign in again to see your work." /></PracticePage>
  }
  const id = viewer.id
  const at = (value: string | null | undefined) => formatInstant(value, timeZone)
  const day = (value: string | null | undefined) => formatInstant(value, timeZone, { includeTime: false })

  const [consultations, checks, matters, tasks, deadlines, time, documents] = await Promise.all([
    rows<{ id: string; serviceTitle: string | null; status: string; startsAt: string | null; intake: { intakeNumber: string | null; title: string | null } | null }>(
      `query MyConsultations($id: ID!, $open: [ConsultationStatusType!]) { consultations(where: { host: { id: { equals: $id } }, status: { in: $open } }, orderBy: [{ startsAt: asc }], take: 25) { id serviceTitle status startsAt intake { intakeNumber title } } }`,
      { id, open: openConsultations }, 'consultations',
      (c) => ({ id: c.id, href: path('work', 'consultation', c.id), title: c.serviceTitle || 'Consultation', meta: c.intake?.intakeNumber ?? 'Intake', status: c.status, when: at(c.startsAt) }),
    ),
    rows<{ id: string; checkNumber: string | null; status: string; createdAt: string | null; intake: { title: string | null } | null; matter: { matterNumber: string | null } | null }>(
      `query MyConflictChecks($id: ID!, $open: [ConflictCheckStatusType!]) { conflictChecks(where: { status: { in: $open }, OR: [{ requestedBy: { id: { equals: $id } } }, { reviewedBy: { id: { equals: $id } } }] }, orderBy: [{ createdAt: asc }], take: 25) { id checkNumber status createdAt intake { title } matter { matterNumber } } }`,
      { id, open: openChecks }, 'conflictChecks',
      (c) => ({ id: c.id, href: '/dashboard/platform/intake#conflict-review', title: c.intake?.title || c.matter?.matterNumber || 'Conflict check', meta: c.checkNumber, status: c.status, when: day(c.createdAt) }),
    ),
    rows<{ id: string; matterNumber: string | null; title: string | null; status: string; confidentiality: string | null; client: { displayName: string | null } | null }>(
      `query MyMatters($id: ID!, $closed: [MatterStatusType!]) { matters(where: { status: { notIn: $closed }, OR: [{ responsibleAttorney: { id: { equals: $id } } }, { teamMembers: { some: { user: { id: { equals: $id } }, status: { equals: active } } } }] }, orderBy: [{ matterNumber: asc }], take: 50) { id matterNumber title status confidentiality client { displayName } } }`,
      { id, closed: closedMatters }, 'matters',
      (m) => ({ id: m.id, href: `/dashboard/platform/matters/${encodeURIComponent(m.id)}`, title: <><FileLabel>{m.matterNumber}</FileLabel> {m.title}</>, meta: <>{m.client?.displayName || 'Client'}{m.confidentiality === 'restricted' ? ' · Restricted' : ''}</>, status: m.status }),
    ),
    rows<{ id: string; title: string | null; status: string; dueAt: string | null; matter: { matterNumber: string | null } | null }>(
      `query MyTasks($id: ID!, $open: [LegalTaskStatusType!]) { legalTasks(where: { assignedTo: { id: { equals: $id } }, status: { in: $open } }, orderBy: [{ dueAt: asc }], take: 25) { id title status dueAt matter { matterNumber } } }`,
      { id, open: openTasks }, 'legalTasks',
      (t) => ({ id: t.id, href: path('work', 'task', t.id), title: t.title || 'Task', meta: t.matter?.matterNumber ?? 'No matter', status: t.status, when: t.dueAt ? `Due ${day(t.dueAt)}` : null }),
    ),
    rows<{ id: string; title: string | null; status: string; dueAt: string | null; matter: { matterNumber: string | null } | null }>(
      `query MyDeadlines($id: ID!, $open: [DeadlineStatusType!]) { deadlines(where: { assignedTo: { id: { equals: $id } }, status: { in: $open } }, orderBy: [{ dueAt: asc }], take: 25) { id title status dueAt matter { matterNumber } } }`,
      { id, open: openDeadlines }, 'deadlines',
      (d) => ({ id: d.id, href: path('work', 'deadline', d.id), title: d.title || 'Deadline', meta: d.matter?.matterNumber ?? 'No matter', status: d.status, when: at(d.dueAt) }),
    ),
    rows<{ id: string; description: string | null; status: string; workDate: string | null; durationMinutes: number | null; matter: { matterNumber: string | null } | null }>(
      `query MyTime($id: ID!) { timeEntries(where: { user: { id: { equals: $id } } }, orderBy: [{ workDate: desc }], take: 10) { id description status workDate durationMinutes matter { matterNumber } } }`,
      { id }, 'timeEntries',
      (t) => ({ id: t.id, href: path('time-expenses', 'time-entry', t.id), title: t.description || 'Time entry', meta: <>{t.matter?.matterNumber ?? 'No matter'} · <span className="lf-figures">{((t.durationMinutes ?? 0) / 60).toFixed(1)} h</span></>, status: t.status, when: day(t.workDate) }),
    ),
    rows<{ id: string; title: string | null; status: string; updatedAt: string | null; matter: { matterNumber: string | null } | null }>(
      `query MyDocuments($id: ID!) { documents(where: { matter: { OR: [{ responsibleAttorney: { id: { equals: $id } } }, { teamMembers: { some: { user: { id: { equals: $id } }, status: { equals: active } } } }] } }, orderBy: [{ updatedAt: desc }], take: 10) { id title status updatedAt matter { matterNumber } } }`,
      { id }, 'documents',
      (d) => ({ id: d.id, href: path('documents', 'document', d.id), title: d.title || 'Document', meta: d.matter?.matterNumber ?? 'No matter', status: d.status, when: day(d.updatedAt) }),
    ),
  ])

  const sections: Section[] = [
    { id: 'my-consultations', title: 'Consultations I host', rows: consultations, empty: 'No consultations waiting on you.', all: { href: '/dashboard/platform/work', label: 'Calendar & tasks' } },
    { id: 'my-conflicts', title: 'Conflict checks', rows: checks, empty: 'No open conflict checks you requested or review.', all: { href: '/dashboard/platform/intake#conflict-review', label: 'Conflict review' } },
    { id: 'my-matters', title: 'My matters', rows: matters, empty: 'You are not on any open matter.', all: { href: '/dashboard/platform/matters', label: 'All matters you can see' } },
    { id: 'my-tasks', title: 'Tasks', rows: tasks, empty: 'No open tasks assigned to you.' },
    { id: 'my-deadlines', title: 'Deadlines', rows: deadlines, empty: 'No pending deadlines assigned to you.' },
    { id: 'my-time', title: 'Recent time', rows: time, empty: 'No time recorded yet.', all: { href: '/dashboard/platform/time-expenses', label: 'Time & expenses' } },
    { id: 'my-documents', title: 'Documents on my matters', rows: documents, empty: 'No documents on your matters yet.', all: { href: '/dashboard/platform/documents', label: 'Documents' } },
  ]
  const waiting = (consultations?.length ?? 0) + (checks?.length ?? 0) + (tasks?.length ?? 0) + (deadlines?.length ?? 0)

  return (
    <PracticePage
      title="My work"
      description="Your consultations, conflict checks, matters, tasks and time."
      meta={<>{viewer.name || viewer.email} · <span className="lf-figures">{waiting}</span> {waiting === 1 ? 'item needs' : 'items need'} you</>}
    >
      <div className="grid items-start gap-x-8 gap-y-10 xl:grid-cols-2">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-heading`} className="min-w-0">
            <header className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`${section.id}-heading`} className="flex min-w-0 items-baseline gap-2 text-[15px] font-semibold tracking-tight text-foreground">
                {section.title}
                {section.rows ? <span className="lf-figures text-sm font-normal text-muted-foreground">{section.rows.length}</span> : null}
              </h2>
              {section.all && section.rows ? <Link href={section.all.href} className={actionLinkClass}>{section.all.label}</Link> : null}
            </header>
            {section.rows === null ? (
              <EmptyState className="border-t border-border" title="Your role does not include this." />
            ) : section.rows.length === 0 ? (
              <EmptyState className="border-t border-border" title={section.empty} />
            ) : (
              <ul className="divide-y divide-border rounded-[6px] border border-border bg-card">
                {section.rows.map((row) => {
                  const body = (
                    <>
                      <span className="min-w-0">
                        <span className="block min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{row.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">{row.meta}{row.when ? <> · <span className="lf-figures">{row.when}</span></> : null}</span>
                      </span>
                      {row.status ? <StatusText status={row.status} /> : null}
                    </>
                  )
                  return (
                    <li key={row.id}>
                      {row.href ? (
                        <Link href={row.href} className="flex min-h-11 min-w-0 items-center justify-between gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-[var(--lf-manila)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lf-rust)]/40">{body}</Link>
                      ) : <div className="flex min-h-11 min-w-0 items-center justify-between gap-3 px-4 py-2.5">{body}</div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </PracticePage>
  )
}
