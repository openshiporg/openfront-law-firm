import {
  PracticeLoadError,
  PracticePage,
  QueuePanel,
  SectionJumps,
} from '@/features/platform/components/PracticeSurface'
import { getPracticeWorkspace } from '@/features/platform/operations/actions'
import type { PracticeWorkspaceSection } from '@/features/platform/operations/types'
import { DataTransferPanel } from '@/features/platform/data/components/DataTransferPanel'
import { TrustPostingPanel } from '@/features/platform/accounting/components/TrustPostingPanel'
import { ReconciliationPreparationPanel } from '@/features/platform/accounting/components/ReconciliationPreparationPanel'
import { PortalManagementPanel } from '@/features/platform/portal/components/PortalManagementPanel'
import { PortalPolicyDirectory, type PortalDirectoryParams } from '@/features/platform/portal/components/PortalPolicyDirectory'
import { BillingOperationsPanel } from '@/features/platform/billing/components/BillingOperationsPanel'
import { BillingRatesPanel } from '@/features/platform/billing/components/BillingRatesPanel'
import { BillingPaymentPanel } from '@/features/platform/billing/components/BillingPaymentPanel'
import { TrustSetupPanel } from '@/features/platform/accounting/components/TrustSetupPanel'
import { InvoiceMetadataRegister } from '@/features/platform/billing/components/InvoiceMetadataRegister'
import { IntakeOperationsPanel } from '@/features/platform/intake/components/IntakeOperationsPanel'
import { ConflictCheckRegisterPreview } from '@/features/platform/intake/components/ConflictCheckRegisterPreview'
import { PracticeReportsPanel } from '@/features/platform/reports/components/PracticeReportsPanel'
import { WorkspaceRegisterView } from '@/features/platform/components/WorkspaceRegisterView'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { getWorkspaceRegister } from '@/features/platform/operations/actions/getWorkspaceRegister'
import { registerDefinition, registerHref, type RegisterParams } from '@/features/platform/operations/lib/workspaceRegister'

import { workspaceDefinitions, type WorkspaceCategory } from './config'
import { describeActionInvoicePreview } from './actionInvoicePreview'
import { describeContactDirectoryPreview } from './contactDirectoryPreview'
import { describePortalContactPreview } from './portalContactPreview'
import { describePortalAccountPreview } from './portalAccountPreview'
import { EmailDeliveryStatus } from '@/features/platform/integrations/components/EmailDeliveryStatus'
import { getEmailDeliveryConfigured } from '@/features/platform/integrations/lib/emailDelivery'

// Plain firm-owner wording for the portal register sections (server titles stay as fallbacks).
const portalSectionCopy: Record<string, { title: string; description: string }> = {
  accounts: { title: 'Client accounts', description: 'Clients invited to the portal.' },
  grants: { title: 'Matter access', description: 'Which clients can see which matters.' },
  shares: { title: 'Shared items', description: 'Documents, invoices and conversations clients can see now.' },
  'eligible-contacts': { title: 'Clients you can invite', description: 'Contacts who can be invited to the portal.' },
  'eligible-matters': { title: 'Matters', description: 'Open matters you can see.' },
  'shareable-documents': { title: 'Documents you can share', description: 'Documents marked shareable with the client.' },
  'shareable-invoices': { title: 'Invoices you can share', description: 'Issued invoices.' },
  'shareable-threads': { title: 'Conversations you can share', description: 'Open matter conversations.' },
}

export async function WorkspaceScreen({ category, intakePage, conflictPage, invoicePage, paymentPage, relationshipPage, auditPage, reportDeadlinePage, portalParams, register, conflictReviewPage, decisionPage }: { category: WorkspaceCategory; conflictReviewPage?: number; decisionPage?: number; intakePage?: number; conflictPage?: number; invoicePage?: number; paymentPage?: number; relationshipPage?: number; auditPage?: number; reportDeadlinePage?: number; portalParams?: PortalDirectoryParams; register?: RegisterParams | null }) {
  const definition = workspaceDefinitions[category]
  const [response, timeZone] = await Promise.all([
    getPracticeWorkspace(category, { intake: intakePage, conflicts: conflictPage, invoices: invoicePage, payments: paymentPage, relationships: relationshipPage }),
    getFirmTimeZone(),
  ])
  const registerSection = register && response.success ? response.data.sections.find((section) => section.key === register.view) : undefined
  const registerResult = register && registerSection
    ? await getWorkspaceRegister(category, register, { title: registerSection.title, description: registerSection.description, canAct: registerSection.items[0]?.canAct ?? false })
    : null
  if (registerResult) {
    return (
      <PracticePage title={definition.title} description={definition.description}>
        {registerResult.success
          ? <WorkspaceRegisterView register={registerResult.data} backHref={`/dashboard/platform/${category}`} backLabel={definition.title} timeZone={timeZone} />
          : <PracticeLoadError message={registerResult.error} />}
      </PracticePage>
    )
  }
  const activeIntakePage = response.success
    ? response.data.sections.find((section) => section.key === 'pipeline')?.pagination?.page ?? intakePage ?? 1
    : intakePage ?? 1
  const activeConflictPage = response.success
    ? response.data.sections.find((section) => section.key === 'conflicts')?.pagination?.page ?? conflictPage ?? 1
    : conflictPage ?? 1
  const activePaymentPage = response.success
    ? response.data.sections.find((section) => section.key === 'payments')?.pagination?.page ?? paymentPage ?? 1
    : paymentPage ?? 1
  const invoiceMetadataRegister = response.success ? response.data.invoiceMetadataRegister : undefined
  const activeInvoicePage = invoiceMetadataRegister?.success ? invoiceMetadataRegister.pagination.page : invoicePage ?? 1
  const eligiblePortalContacts = response.success
    ? response.data.sections.find((section) => section.key === 'eligible-contacts')
    : undefined
  const emailConfigured = category === 'portal' || category === 'integrations' ? getEmailDeliveryConfigured() : false
  const portalContactPreview = category === 'portal' && eligiblePortalContacts
    ? describePortalContactPreview(eligiblePortalContacts.items.length, eligiblePortalContacts.total)
    : null

  return (
    <PracticePage title={definition.title} description={definition.description}>
      {!response.success ? (
        <PracticeLoadError message={response.error} />
      ) : (
        // Billing and accounting end in pagers and form footers; the bottom padding keeps the
        // last control clear of the shell's floating assistant button.
        <div className={category === 'billing' || category === 'accounting' ? 'space-y-6 pb-24' : 'space-y-6'}>
          <SectionJumps sections={response.data.sections.map((section) => ({ key: section.key, title: section.title, total: section.total }))} />
          {category === 'intake' ? <IntakeOperationsPanel reviewPage={conflictReviewPage} decisionPage={decisionPage} pageHref={(page) => `/dashboard/platform/intake?intakePage=${activeIntakePage}&conflictPage=${activeConflictPage}&reviewPage=${page}&decisionPage=${decisionPage ?? 1}#conflict-review`} decisionPageHref={(page) => `/dashboard/platform/intake?intakePage=${activeIntakePage}&conflictPage=${activeConflictPage}&reviewPage=${conflictReviewPage ?? 1}&decisionPage=${page}#intake-conversion`} /> : null}
          {category === 'billing' ? <BillingOperationsPanel /> : null}
          {category === 'billing' ? <BillingRatesPanel /> : null}
          {category === 'billing' ? <BillingPaymentPanel /> : null}
          {category === 'reports' ? <PracticeReportsPanel auditPage={auditPage} reportDeadlinePage={reportDeadlinePage} /> : null}
          {category === 'data' ? (
            <DataTransferPanel
              connectionTotal={response.data.sections.find((section) => section.key === 'connections')?.total}
              connections={(response.data.sections.find((section) => section.key === 'connections')?.items ?? []).map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
              }))}
            />
          ) : null}
          {category === 'accounting' ? (
            <TrustSetupPanel accounts={(response.data.sections.find((section) => section.key === 'accounts')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status }))} />
          ) : null}
          {category === 'accounting' ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <TrustPostingPanel
                accounts={trustOptions(response.data.sections, 'accounts')}
                accountTotal={response.data.sections.find((section) => section.key === 'accounts')?.total}
                ledgers={trustOptions(response.data.sections, 'ledgers')}
                ledgerTotal={response.data.sections.find((section) => section.key === 'ledgers')?.total}
              />
              <ReconciliationPreparationPanel
                accounts={trustOptions(response.data.sections, 'accounts')}
                accountTotal={response.data.sections.find((section) => section.key === 'accounts')?.total}
              />
            </div>
          ) : null}
          {category === 'integrations' ? <div className="rounded-xl border border-border bg-card p-4 shadow-xs"><EmailDeliveryStatus configured={emailConfigured} /></div> : null}
          {category === 'portal' ? <PortalPolicyDirectory params={portalParams} /> : null}
          {category === 'portal' ? (
            <PortalManagementPanel
              emailConfigured={emailConfigured}
              contacts={(eligiblePortalContacts?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status }))}
              contactPreviewNote={portalContactPreview?.selectorNote}
              accounts={(response.data.sections.find((section) => section.key === 'accounts')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status }))}
              matters={(response.data.sections.find((section) => section.key === 'eligible-matters')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status }))}
              grants={(response.data.sections.find((section) => section.key === 'grants')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status }))}
              shares={(response.data.sections.find((section) => section.key === 'shares')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status }))}
              resources={[
                ...(response.data.sections.find((section) => section.key === 'shareable-documents')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status, resourceType: 'document' as const })),
                ...(response.data.sections.find((section) => section.key === 'shareable-invoices')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status, resourceType: 'invoice' as const })),
                ...(response.data.sections.find((section) => section.key === 'shareable-threads')?.items ?? []).map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, status: item.status, resourceType: 'communication_thread' as const })),
              ]}
            />
          ) : null}

          <div className="space-y-6">
            {response.data.sections.map((section) => {
              const isContactDirectoryPreview = category === 'contacts' && section.key === 'directory'
              const isActionInvoicePreview = category === 'billing' && section.key === 'invoices'
              const isPortalContactPreview = category === 'portal' && section.key === 'eligible-contacts'
              const isPortalAccountPreview = category === 'portal' && section.key === 'accounts'
              const portalCopy = category === 'portal' ? portalSectionCopy[section.key] : undefined
              const sectionTitle = portalCopy?.title ?? section.title
              const sectionDescription = portalCopy?.description ?? section.description
              const previewCopy = isPortalAccountPreview
                ? describePortalAccountPreview(section.items.length, section.total)
                : isActionInvoicePreview
                  ? describeActionInvoicePreview(section.items.length, section.total)
                  : isContactDirectoryPreview
                    ? describeContactDirectoryPreview(section.items.length, section.total)
                    : isPortalContactPreview
                      ? describePortalContactPreview(section.items.length, section.total)
                      : null
              return (
                <div id={section.key} key={section.key} className="scroll-mt-20">
                  {category === 'intake' && section.key === 'conflicts' ? (
                    <ConflictCheckRegisterPreview
                      rows={section.items.map((item) => ({ title: item.title, subtitle: item.subtitle, status: item.status, createdAt: item.at }))}
                      timeZone={timeZone}
                      total={section.total}
                      pagination={section.pagination}
                      paginationHrefs={getConflictCheckPageHrefs(section, activeIntakePage)}
                    />
                  ) : (
                    <QueuePanel
                      title={previewCopy
                        ? `${sectionTitle} · ${previewCopy.summary}`
                        : sectionTitle}
                      count={previewCopy ? undefined : section.total}
                      description={previewCopy
                        ? `${sectionDescription} ${previewCopy.description}`.trim()
                        : sectionDescription}
                      items={section.items}
                      empty={`No ${sectionTitle.toLowerCase()}`}
                      viewAllHref={category === 'reports' ? `/dashboard/platform/${section.key}` : registerHref(category, { view: section.key })}
                      showViewAll={section.total > 0 && (category === 'reports' || Boolean(registerDefinition(category, section.key)))}
                      anchor={section.key}
                      actionPath={`/dashboard/platform/${category}`}
                      timeZone={timeZone}
                      pagination={
                        (category === 'intake' && section.key === 'pipeline') ||
                        (category === 'billing' && section.key === 'payments') ||
                        (category === 'contacts' && section.key === 'relationships')
                          ? section.pagination
                          : undefined
                      }
                      authorizedTotal={
                        (category === 'intake' && section.key === 'pipeline') ||
                        (category === 'billing' && section.key === 'payments') ||
                        (category === 'contacts' && section.key === 'relationships')
                          ? section.total
                          : undefined
                      }
                      paginationHrefs={
                        category === 'intake' && section.key === 'pipeline'
                          ? getIntakePageHrefs(section, activeConflictPage)
                          : category === 'billing' && section.key === 'payments'
                            ? getBillingPageHrefs(section, activeInvoicePage)
                            : category === 'contacts' && section.key === 'relationships'
                              ? getContactRelationshipPageHrefs(section)
                              : undefined
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>

          {category === 'billing' && invoiceMetadataRegister ? (
            <InvoiceMetadataRegister
              register={invoiceMetadataRegister}
              timeZone={timeZone}
              paginationHrefs={invoiceMetadataRegister.success
                ? getBillingInvoicePageHrefs(invoiceMetadataRegister.pagination, activePaymentPage)
                : undefined}
            />
          ) : null}
        </div>
      )}
    </PracticePage>
  )
}

// Trust account and ledger subtitles carry the currency as their second segment
// ("type · USD · ••••1234", "account · USD · matter"). Only active accounts and ledgers
// can take postings or reconciliations, so pending, frozen and closed ones are left out.
function trustOptions(sections: PracticeWorkspaceSection[], key: 'accounts' | 'ledgers') {
  return (sections.find((section) => section.key === key)?.items ?? []).filter((item) => item.status === 'active').map((item) => {
    const currencyCode = item.subtitle.split(' · ')[1]?.trim()
    return { value: item.id, label: `${item.title} — ${item.subtitle}`, ...(currencyCode && /^[A-Z]{3}$/.test(currencyCode) ? { currencyCode } : {}) }
  })
}

function getIntakePageHrefs(section: PracticeWorkspaceSection, conflictPage: number) {
  const pagination = section.pagination
  if (!pagination) return undefined
  const href = (page: number) => `/dashboard/platform/intake?intakePage=${page}&conflictPage=${conflictPage}#pipeline`
  return {
    previous: pagination.hasPrevious ? href(pagination.page - 1) : null,
    next: pagination.hasNext ? href(pagination.page + 1) : null,
  }
}

function getConflictCheckPageHrefs(section: PracticeWorkspaceSection, intakePage: number) {
  const pagination = section.pagination
  if (!pagination) return { previous: null, next: null }
  const href = (page: number) => `/dashboard/platform/intake?intakePage=${intakePage}&conflictPage=${page}#conflicts`
  return {
    previous: pagination.hasPrevious ? href(pagination.page - 1) : null,
    next: pagination.hasNext ? href(pagination.page + 1) : null,
  }
}

function getContactRelationshipPageHrefs(section: PracticeWorkspaceSection) {
  const pagination = section.pagination
  if (!pagination) return undefined
  const href = (page: number) => `/dashboard/platform/contacts?relationshipPage=${page}#relationships`
  return {
    previous: pagination.hasPrevious ? href(pagination.page - 1) : null,
    next: pagination.hasNext ? href(pagination.page + 1) : null,
  }
}

function getBillingPageHrefs(section: PracticeWorkspaceSection, invoicePage: number) {
  const pagination = section.pagination
  if (!pagination) return undefined
  const href = (page: number) => `/dashboard/platform/billing?invoicePage=${invoicePage}&paymentPage=${page}#payments`
  return {
    previous: pagination.hasPrevious ? href(pagination.page - 1) : null,
    next: pagination.hasNext ? href(pagination.page + 1) : null,
  }
}

function getBillingInvoicePageHrefs(pagination: NonNullable<PracticeWorkspaceSection['pagination']>, paymentPage: number) {
  const href = (page: number) => `/dashboard/platform/billing?invoicePage=${page}&paymentPage=${paymentPage}#invoice-metadata-register`
  return {
    previous: pagination.hasPrevious ? href(pagination.page - 1) : null,
    next: pagination.hasNext ? href(pagination.page + 1) : null,
  }
}
