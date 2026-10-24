import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { EmptyState, ErrorBanner, Meta, MetaGrid, Panel, RowList, StatusText, TitleLine, Track, pillClass } from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { formatMoneyLabel } from '@/features/platform/lib/money'

import { getRetainerDetail } from '../actions/retainers'
import { basisPointsLabel, feeStructureLabel } from '../lib/retainerOptions'
import { RetainerTransitions } from '../components/RetainerTransitions'

const BASE = '/dashboard/platform/retainers'

export async function RetainerDetailPage({ params }: { params: Promise<{ retainerId: string }> }) {
  const { retainerId } = await params
  const response = await getRetainerDetail(retainerId)
  if (!response.success && response.notFound) notFound()
  if (!response.success) {
    return (
      <PracticePage title="Retainer agreement" description="Fee agreement" trail={[{ label: 'Retainers', href: BASE }, { label: 'Agreement' }]}>
        <ErrorBanner title="Agreement unavailable">{response.error}</ErrorBanner>
      </PracticePage>
    )
  }
  const { retainer, documentVersions, timeZone } = response.data
  const money = (value: number | null) => value === null || value === undefined ? 'None' : formatMoneyLabel(value, retainer.currencyCode)
  const date = (value: string | null) => formatInstant(value, timeZone, { includeTime: false, missing: '—' })

  return (
    <PracticePage
      title={retainer.agreementNumber}
      description="Fee agreement"
      trail={[{ label: 'Retainers', href: BASE }, { label: retainer.agreementNumber }]}
      status={<StatusText status={retainer.status} />}
      meta={`${retainer.client?.displayName ?? 'Client'} · ${retainer.matter ? `${retainer.matter.matterNumber}${retainer.matter.title ? ` · ${retainer.matter.title}` : ''}` : 'Matter'}`}
      actions={
        <Track>
          <Link href={BASE} className={pillClass}>All retainers</Link>
          {retainer.matter ? <Link href={`/dashboard/platform/matters/${retainer.matter.id}`} className={pillClass}>Matter</Link> : null}
        </Track>
      }
    >
      <div className="grid min-w-0 gap-6 pb-24">
        <RetainerTransitions
          retainerId={retainer.id}
          status={retainer.status}
          documentVersions={documentVersions}
          needsLedger={(retainer.initialRetainerMinor ?? 0) > 0 && !retainer.trustLedgerAccount}
        />

        <Panel title="Terms">
          <MetaGrid>
            <Meta label="Fee structure">{feeStructureLabel(retainer.feeStructure)}</Meta>
            <Meta label="Currency">{retainer.currencyCode}</Meta>
            <Meta label="Initial retainer">{money(retainer.initialRetainerMinor)}</Meta>
            <Meta label="Evergreen threshold">{money(retainer.evergreenThresholdMinor)}</Meta>
            <Meta label="Replenishment amount">{money(retainer.replenishmentAmountMinor)}</Meta>
            <Meta label="Contingency">{basisPointsLabel(retainer.contingencyBasisPoints)}</Meta>
            <Meta label="Rate card">{retainer.rateCard?.name ?? 'None'}</Meta>
            <Meta label="Trust ledger">{retainer.trustLedgerAccount?.ledgerNumber ?? 'None'}</Meta>
            <Meta label="Signed version">
              {retainer.signedDocumentVersion?.document
                ? <Link href={`/dashboard/platform/documents/document/${retainer.signedDocumentVersion.document.id}`} className="underline underline-offset-4">{`${retainer.signedDocumentVersion.document.title ?? 'Document'} · v${retainer.signedDocumentVersion.versionNumber}`}</Link>
                : retainer.signedDocumentVersion ? `v${retainer.signedDocumentVersion.versionNumber}` : 'None'}
            </Meta>
          </MetaGrid>
          {retainer.termsSummary ? <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm leading-6 text-foreground">{retainer.termsSummary}</p> : null}
        </Panel>

        <Panel title="Timeline">
          <MetaGrid>
            <Meta label="Prepared">{date(retainer.createdAt)}</Meta>
            <Meta label="Sent">{date(retainer.sentAt)}</Meta>
            <Meta label="Accepted">{date(retainer.acceptedAt)}</Meta>
            <Meta label="Effective">{date(retainer.effectiveAt)}</Meta>
            <Meta label="Terminated">{date(retainer.terminatedAt)}</Meta>
          </MetaGrid>
        </Panel>

        <section className="grid min-w-0 gap-3" aria-labelledby="retainer-invoices">
          <h2 id="retainer-invoices" className="text-base font-semibold tracking-tight text-foreground">Linked invoices</h2>
          {retainer.invoices.length === 0 ? <EmptyState title="No invoices linked to this agreement" /> : (
            <RowList label="Linked invoices">
              {retainer.invoices.map((invoice) => (
                <li key={invoice.id} className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <TitleLine as="h3" status={invoice.status} headingClassName="text-sm">{invoice.invoiceNumber}</TitleLine>
                  <div className="flex shrink-0 flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">{formatMoneyLabel(invoice.totalMinor, invoice.currencyCode)} total</span>
                    <span className="font-mono tabular-nums">{formatMoneyLabel(invoice.balanceDueMinor, invoice.currencyCode)} due</span>
                    <span>{invoice.dueAt ? `Due ${date(invoice.dueAt)}` : invoice.issuedAt ? `Issued ${date(invoice.issuedAt)}` : 'Not issued'}</span>
                  </div>
                </li>
              ))}
            </RowList>
          )}
        </section>
      </div>
    </PracticePage>
  )
}
