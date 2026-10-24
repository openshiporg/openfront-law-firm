import type { ReactNode } from 'react'
import Link from 'next/link'

import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { EmptyState, ErrorBanner, Meta, MetaGrid, Panel, StatusDot, statusLabel, statusTone } from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

import { ContactIdentityForm, ContactStatusTrack } from '../components/ContactForms'
import { AddressManager, ContactMethodManager } from '../components/ContactRecords'
import { getContactDetail } from '../lib/contactQueries'
import { CONTACT_STATUS_LABELS, CONTACT_STATUS_TONES, PARTY_ROLE_LABELS, type Related } from '../lib/contactTypes'

const trail = (name: string) => [{ label: 'Contacts', href: '/dashboard/platform/contacts' }, { label: name }]

function RelatedPanel<T extends { id: string }>({ title, related, empty, children }: { title: string; related: Related<T>; empty: string; children: (row: T) => ReactNode }) {
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">{title}{related.status === 'loaded' ? <span className="font-mono text-xs font-normal text-muted-foreground">{related.rows.length}</span> : null}</h2>}
      bodyClassName="p-0"
    >
      {related.status !== 'loaded' ? (
        <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Not available with your access</p>
      ) : related.rows.length ? (
        <ul className="divide-y divide-border">{related.rows.map((row) => <li key={row.id} className="min-w-0">{children(row)}</li>)}</ul>
      ) : (
        <p role="status" className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      )}
    </Panel>
  )
}

function RowTitle({ title, status, detail }: { title: string; status: string | null | undefined; detail: string }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot tone={statusTone(status)} />
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</span>
        {status ? <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(status)}</span> : null}
      </span>
      <span className="mt-0.5 block truncate pl-4 text-xs text-muted-foreground">{detail}</span>
    </>
  )
}

export async function ContactDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params
  const [result, timeZone] = await Promise.all([getContactDetail(decodeURIComponent(contactId)), getFirmTimeZone()])

  if (result.status === 'error') {
    return <PracticePage title="Contact" description="Contact" trail={trail('Contact')}><ErrorBanner title="Contact unavailable">{result.message}</ErrorBanner></PracticePage>
  }
  if (result.status === 'missing') {
    return <PracticePage title="Contact" description="Contact" trail={trail('Not found')}><EmptyState title="Contact not found" /></PracticePage>
  }

  const { contact, addresses, methods, matters, intakes, portalAccounts } = result
  return (
    <PracticePage
      title={contact.displayName}
      description="Contact"
      trail={trail(contact.displayName)}
      status={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><StatusDot tone={CONTACT_STATUS_TONES[contact.status]} />{CONTACT_STATUS_LABELS[contact.status]}</span>}
      meta={[contact.contactType === 'organization' ? 'Organization' : 'Person', contact.preferredName ? `Prefers “${contact.preferredName}”` : null, contact.primaryEmail].filter(Boolean).join(' · ')}
    >
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <ContactStatusTrack contactId={contact.id} status={contact.status} />
          <ContactIdentityForm key={contact.updatedAt ?? contact.id} contact={contact} />
          <Panel title="Record">
            <MetaGrid className="sm:grid-cols-2 lg:grid-cols-2">
              <Meta label="Created">{formatInstant(contact.createdAt, timeZone)}</Meta>
              <Meta label="Updated">{formatInstant(contact.updatedAt, timeZone)}</Meta>
            </MetaGrid>
          </Panel>
        </div>
        <div className="grid min-w-0 gap-6">
          <AddressManager contactId={contact.id} addresses={addresses} />
          <ContactMethodManager contactId={contact.id} methods={methods} />
          <RelatedPanel title="Matters" related={matters} empty="Not a party on any matter">
            {(party) => {
              const body = <RowTitle title={party.matter ? [party.matter.matterNumber, party.matter.title].filter(Boolean).join(' · ') || 'Matter' : 'Matter'} status={party.matter?.status} detail={[PARTY_ROLE_LABELS[party.partyRole] ?? statusLabel(party.partyRole), party.side ? statusLabel(party.side) : null, party.isPrimaryClient ? 'Primary client' : null, party.status === 'removed' ? 'Removed from matter' : null].filter(Boolean).join(' · ')} />
              return party.matter ? <Link href={`/dashboard/platform/matters/${party.matter.id}`} className="block px-4 py-3 hover:bg-muted/40">{body}</Link> : <div className="px-4 py-3">{body}</div>
            }}
          </RelatedPanel>
          <RelatedPanel title="Intakes" related={intakes} empty="No intakes">
            {(intake) => <div className="px-4 py-3"><RowTitle title={[intake.intakeNumber, intake.title].filter(Boolean).join(' · ') || 'Intake'} status={intake.status} detail={`Received ${formatInstant(intake.receivedAt, timeZone, { includeTime: false })}`} /></div>}
          </RelatedPanel>
          <RelatedPanel title="Portal account" related={portalAccounts} empty="No portal account">
            {(account) => <Link href="/dashboard/platform/portal" className="block px-4 py-3 hover:bg-muted/40"><RowTitle title={account.email || 'Portal account'} status={account.status} detail={account.lastLoginAt ? `Last sign-in ${formatInstant(account.lastLoginAt, timeZone)}` : account.invitedAt ? `Invited ${formatInstant(account.invitedAt, timeZone, { includeTime: false })}` : 'Never signed in'} /></Link>}
          </RelatedPanel>
        </div>
      </div>
    </PracticePage>
  )
}
