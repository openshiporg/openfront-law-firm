import Link from 'next/link'
import { ArrowLeft, BriefcaseBusiness } from 'lucide-react'

import { PracticeLoadError, PracticePage, PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { Meta, MetaGrid, Panel, Track, trackItemClass } from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

import { getDocketDetail } from '../actions/getDockets'
import { DocketDeadlines, DocketStatusControl, EntryTimeline, RecordEntryForm } from '../components/DocketForms'

const trail = [{ label: 'Courts & dockets', href: '/dashboard/platform/dockets' }]

export async function DocketDetailPage({ params }: { params: Promise<{ docketId: string }> }) {
  const { docketId } = await params
  const [result, timeZone] = await Promise.all([getDocketDetail(docketId), getFirmTimeZone()])
  if (!result.success) return <PracticePage title="Docket unavailable" description="Docket unavailable" trail={[...trail, { label: 'Docket unavailable' }]}><PracticeLoadError message={result.error} /></PracticePage>
  const { docket, versions } = result.data
  const open = docket.status !== 'closed'
  return (
    <PracticePage
      title={docket.docketNumber}
      description={docket.title ?? 'Docket'}
      status={<PracticeStatus status={docket.status} />}
      meta={docket.title}
      trail={[...trail, { label: docket.docketNumber }]}
      actions={<>
        <DocketStatusControl docketId={docket.id} status={docket.status} />
        <Track>
          <Link href="/dashboard/platform/dockets" className={trackItemClass(false)}><ArrowLeft className="size-4" aria-hidden="true" />Dockets</Link>
          {docket.matter ? <Link href={`/dashboard/platform/matters/${encodeURIComponent(docket.matter.id)}`} className={trackItemClass(false)}><BriefcaseBusiness className="size-4" aria-hidden="true" />Matter</Link> : null}
        </Track>
      </>}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <Panel>
            <MetaGrid>
              <Meta label="Court">{docket.court?.name ?? 'Unavailable'}</Meta>
              <Meta label="Matter">{docket.matter ? `${docket.matter.matterNumber ?? ''} · ${docket.matter.title ?? ''}` : 'Unavailable'}</Meta>
              <Meta label="Filed">{formatInstant(docket.filedAt, timeZone, { includeTime: false })}</Meta>
              {docket.closedAt ? <Meta label="Closed">{formatInstant(docket.closedAt, timeZone, { includeTime: false })}</Meta> : null}
            </MetaGrid>
          </Panel>
          {open ? <RecordEntryForm docketId={docket.id} timeZone={timeZone} versions={versions} /> : null}
          <EntryTimeline docketId={docket.id} entries={docket.entries} timeZone={timeZone} canRecord />
        </div>
        <DocketDeadlines docketId={docket.id} deadlines={docket.deadlines} timeZone={timeZone} canAdd={Boolean(docket.matter)} />
      </div>
    </PracticePage>
  )
}
