import Link from 'next/link'
import { ArrowLeft, ArrowRight, CircleAlert, Settings2 } from 'lucide-react'

import { PracticeRowAction } from '@/features/platform/components/PracticeRowAction'
import { PracticeLoadError, PracticePage, PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { getPracticeWorkspace } from '@/features/platform/operations/actions'
import { getPlatformDrillIn } from './getPlatformDrillIn'
import { deskDetailKinds, deskTitle, type DeskKind } from './OperatingDesk'
import { ThreadReplyDraft } from './ThreadReplyDraft'

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
  return <PracticePage
    title={record.title}
    description={`${record.kind} in ${deskName}.`}
    trail={[{ label: deskName, href: deskHref }, { label: record.kind, href: deskHref }, { label: record.title }]}
    actions={<Link href="/dashboard/models" className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Settings2 className="h-4 w-4" aria-hidden="true" /> Configuration</Link>}
  >
    <div className="space-y-8">
      <nav aria-label="Platform record breadcrumb" className="overflow-x-auto border-b border-border pb-3"><ol className="flex min-w-max items-center gap-2 whitespace-nowrap text-sm"><li><Link href={deskHref} className="inline-flex items-center gap-2 font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{deskName}</Link></li><li aria-hidden="true" className="text-muted-foreground">/</li><li className="text-muted-foreground">{record.kind}</li></ol></nav>
      <div className="flex flex-wrap items-center gap-3">
        <PracticeStatus status={record.status} />
        <PracticeRowAction id={recordId} kind={actionKind} status={record.status} path={deskHref} canAct={canAct} />
      </div>
      <section aria-labelledby="record-facts" className="border-y border-border"><h2 id="record-facts" className="sr-only">Record facts</h2><dl className="grid min-w-0 sm:grid-cols-2 xl:grid-cols-3">{record.facts.map(([term, value]) => <div key={term} className="min-w-0 border-b border-r border-border px-4 py-4 last:border-r-0 xl:nth-[n+4]:border-b-0"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{term}</dt><dd className="mt-2 break-words text-sm font-semibold leading-5 text-foreground">{value}</dd></div>)}</dl></section>
      {record.related.length ? (
        <nav aria-label="Related records" className="flex flex-wrap gap-2">
          {record.related.map((link) => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">{link.label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>)}
        </nav>
      ) : null}
      {record.lists.map((list) => (
        <section key={list.title} aria-labelledby={`list-${list.title}`} className="space-y-3">
          <div className="flex items-end justify-between gap-3 border-b border-border pb-2"><h2 id={`list-${list.title}`} className="text-base font-bold text-foreground">{list.title}</h2><span className="font-mono text-xs text-muted-foreground">{list.total.toLocaleString()}</span></div>
          {list.rows.length ? (
            <ul className="divide-y divide-border border-b border-border">
              {list.rows.map((row, index) => (
                <li key={`${row.title}-${index}`} className="min-w-0 px-1 py-3">
                  {row.href ? <Link href={row.href} className="block text-sm font-semibold text-foreground underline-offset-4 hover:underline [overflow-wrap:anywhere]">{row.title}</Link> : <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{row.title}</p>}
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground [overflow-wrap:anywhere]">{row.meta}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>}
          {list.total > list.rows.length ? <p className="text-xs text-muted-foreground">Showing {list.rows.length.toLocaleString()} of {list.total.toLocaleString()}.</p> : null}
        </section>
      ))}
      {canDraftReply ? <ThreadReplyDraft threadId={recordId} subject={record.title} /> : null}
      <div role="note" className="flex items-start gap-3 border-y border-border bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><p>{record.notice}</p></div>
      <p className="text-xs leading-5 text-muted-foreground">Field-level configuration is available in the <Link href="/dashboard/models" className="font-semibold text-foreground underline-offset-4 hover:underline">data model explorer</Link>.</p>
    </div>
  </PracticePage>
}
