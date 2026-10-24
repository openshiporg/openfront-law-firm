import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Settings2 } from 'lucide-react'

import { PracticeRowAction } from '@/features/platform/components/PracticeRowAction'
import { PracticeLoadError, PracticePage, PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { EmptyState, Notice, Panel, Track, trackItemClass } from '@/features/platform/components/ui'
import { getPracticeWorkspace } from '@/features/platform/operations/actions'
import { getPlatformDrillIn } from './getPlatformDrillIn'
import { deskDetailKinds, deskTitle, type DeskKind } from './OperatingDesk'
import { ThreadReplyDraft } from './ThreadReplyDraft'
import { getDocumentVersions } from '@/features/platform/documents/actions/documentVersions'
import { DocumentVersionPanel } from '@/features/platform/documents/components/DocumentVersionPanel'
import { DocumentSignaturesPanel } from '@/features/platform/documents/components/DocumentSignaturesPanel'
import { ThreadRecipientsPanel } from '@/features/platform/communications/components/ThreadRecipientsPanel'
import { MessageDeliveriesPanel } from '@/features/platform/communications/components/MessageDeliveriesPanel'
import { getConsultationSchedule } from '@/features/platform/consultations/actions/getConsultationSchedule'
import { ConsultationSchedulePanel } from '@/features/platform/consultations/components/ConsultationSchedulePanel'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

// Queue kinds whose section-level action affordance applies to a drill-in record.
const queueKind: Record<string, string> = { 'Communication thread': 'Thread' }

export async function PlatformDrillInPage({ desk, kind, recordId }: { desk: Exclude<DeskKind, 'matters'>; kind: string; recordId: string }) {
  const deskName = deskTitle(desk)
  const deskHref = `/dashboard/platform/${desk}`
  // A drill-in only resolves kinds that belong to its desk, so a record can never render
  // under another domain's URL and navigation.
  if (!deskDetailKinds(desk).includes(kind)) {
    return <PracticePage title="Record unavailable" description="The requested platform record does not belong to this desk." trail={[{ label: deskName, href: deskHref }, { label: 'Record unavailable' }]}><PracticeLoadError message="This record is not available from this desk." /></PracticePage>
  }
  const [result, workspace] = await Promise.all([getPlatformDrillIn(kind, recordId), getPracticeWorkspace(desk)])
  if (!result.success) return <PracticePage title="Record unavailable" description="The requested platform record was not returned within the current authorization scope." trail={[{ label: deskName, href: deskHref }, { label: 'Record unavailable' }]}><PracticeLoadError message={result.error} /></PracticePage>
  const record = result.data
  // Transition controls follow the same permission the desk computed for this kind; the
  // controlled command still rechecks authority and lifecycle on submit.
  const actionKind = queueKind[record.kind] ?? record.kind
  const canActOn = (queueItemKind: string) => workspace.success
    ? workspace.data.sections.some((section) => section.items.some((item) => item.kind === queueItemKind && item.canAct))
    : false
  const canAct = canActOn(actionKind)
  // Reply drafts need communication-management permission, which the desk exposes on drafts.
  const canDraftReply = kind === 'thread' && canActOn('Message')
  const documentFiles = kind === 'document' ? await getDocumentVersions(recordId) : null
  const consultationSchedule = kind === 'consultation' && canAct ? await getConsultationSchedule(recordId) : null
  const firmTimeZone = consultationSchedule ? await getFirmTimeZone() : 'UTC'
  return <PracticePage
    title={record.title}
    description={`${record.kind} in ${deskName}.`}
    status={<PracticeStatus status={record.status} />}
    meta={record.kind}
    trail={[{ label: deskName, href: deskHref }, { label: record.kind, href: deskHref }, { label: record.title }]}
    actions={<>
      <PracticeRowAction id={recordId} kind={actionKind} status={record.status} path={deskHref} canAct={canAct} />
      <Track>
        <Link href={deskHref} className={trackItemClass(false)}><ArrowLeft className="size-4" aria-hidden="true" />{deskName}</Link>
        <Link href="/dashboard/models" className={trackItemClass(true)}><Settings2 className="size-4" aria-hidden="true" />Data model</Link>
      </Track>
    </>}
  >
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="record-facts" className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <h2 id="record-facts" className="sr-only">Record facts</h2>
          <dl className="grid min-w-0 gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
            {record.facts.map(([term, value]) => <div key={term} className="min-w-0 bg-card px-4 py-3"><dt className="text-xs text-muted-foreground">{term}</dt><dd className="mt-1 break-words text-sm font-medium leading-5 text-foreground">{value}</dd></div>)}
          </dl>
        </section>
        {consultationSchedule ? <ConsultationSchedulePanel consultation={consultationSchedule} timeZone={firmTimeZone} /> : null}
        {documentFiles ? <DocumentVersionPanel documentId={recordId} storage={documentFiles.storage} currentVersionId={documentFiles.currentVersionId} versions={documentFiles.versions} /> : null}
        {kind === 'document' ? <DocumentSignaturesPanel documentId={recordId} /> : null}
        {kind === 'thread' ? <ThreadRecipientsPanel threadId={recordId} /> : null}
        {kind === 'message' ? <MessageDeliveriesPanel messageId={recordId} /> : null}
        {record.lists.filter((list) => !(documentFiles && list.title === 'Version history')).map((list) => (
          <Panel key={list.title} title={<h2 id={`list-${list.title}`} className="flex items-baseline gap-2 text-sm font-semibold">{list.title}<span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{list.total.toLocaleString()}</span></h2>} bodyClassName="p-0">
            {list.rows.length ? (
              <ul className="divide-y divide-border">
                {list.rows.map((row, index) => (
                  <li key={`${row.title}-${index}`} className="min-w-0 px-4 py-3">
                    {row.href ? <Link href={row.href} className="block text-sm font-semibold text-foreground underline-offset-4 hover:underline [overflow-wrap:anywhere]">{row.title}</Link> : <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{row.title}</p>}
                    <p className="mt-0.5 whitespace-pre-line text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{row.meta}</p>
                  </li>
                ))}
              </ul>
            ) : <div className="p-4"><EmptyState title="Nothing recorded" /></div>}
            {list.total > list.rows.length ? <p className="border-t border-border px-4 py-2 text-xs tabular-nums text-muted-foreground">{list.rows.length.toLocaleString()} of {list.total.toLocaleString()}</p> : null}
          </Panel>
        ))}
        {canDraftReply ? <ThreadReplyDraft threadId={recordId} subject={record.title} /> : null}
      </div>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-4">
        {record.related.length ? (
          <Panel title="Related" bodyClassName="p-2">
            <nav aria-label="Related records" className="grid">
              {record.related.map((link) => <Link key={link.href} href={link.href} className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-muted">{link.label}<ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Link>)}
            </nav>
          </Panel>
        ) : null}
        <Notice>{record.notice}</Notice>
      </aside>
    </div>
  </PracticePage>
}
