'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { zonedWallTimeToInstant } from '@/features/platform/lib/datetime'
import { currencyFractionDigits, decimalToMinorUnits } from '@/features/platform/lib/money'

import { CONTINGENCY_FEES, FEE_STRUCTURES, RETAINER_STATUSES, RETAINER_TRANSITIONS } from '../lib/retainerOptions'

export type RetainerActionState = { ok: boolean; message: string; retainerId?: string }

type Named = { id: string; displayName: string | null }

export type RetainerListRow = {
  id: string
  agreementNumber: string
  status: string
  feeStructure: string
  currencyCode: string
  initialRetainerMinor: number | null
  createdAt: string | null
  effectiveAt: string | null
  matter: { id: string; matterNumber: string; title: string | null } | null
  client: Named | null
}

export type RetainerList = { rows: RetainerListRow[]; counts: Record<string, number>; total: number; timeZone: string }

export type RetainerMatterOption = {
  id: string
  matterNumber: string
  title: string | null
  status: string
  client: Named | null
}

export type RetainerFormSetup = {
  matters: RetainerMatterOption[]
  suggestedNumber: string
  defaultCurrency: string
}

export type RetainerMatterContext = {
  clients: Array<{ id: string; displayName: string }>
  defaultClientId: string | null
  rateCards: Array<{ id: string; name: string; currencyCode: string; matterScoped: boolean }>
  trustLedgers: Array<{ id: string; ledgerNumber: string; currencyCode: string; clientId: string | null; clientName: string | null }>
}

export type RetainerDetail = {
  retainer: RetainerListRow & {
    evergreenThresholdMinor: number | null
    replenishmentAmountMinor: number | null
    contingencyBasisPoints: number | null
    termsSummary: string | null
    sentAt: string | null
    acceptedAt: string | null
    terminatedAt: string | null
    rateCard: { id: string; name: string; currencyCode: string } | null
    trustLedgerAccount: { id: string; ledgerNumber: string; currencyCode: string } | null
    signedDocumentVersion: { id: string; versionNumber: number; fileName: string | null; document: { id: string; title: string | null } | null } | null
    invoices: Array<{ id: string; invoiceNumber: string; status: string; totalMinor: number; balanceDueMinor: number; currencyCode: string; issuedAt: string | null; dueAt: string | null }>
  }
  documentVersions: Array<{ id: string; label: string }>
  timeZone: string
}

const OPEN_MATTER_STATUSES = ['proposed', 'pending_conflict', 'open', 'on_hold']
const ID = /^[A-Za-z0-9_-]{1,200}$/

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function validId(value: string) {
  return ID.test(value)
}

const listFields = `
  id agreementNumber status feeStructure currencyCode initialRetainerMinor createdAt effectiveAt
  matter { id matterNumber title } client { id displayName }
`

export async function getRetainerList({ status, q }: { status: string | null; q: string }): Promise<{ success: true; data: RetainerList } | { success: false; error: string }> {
  const query = q.trim().slice(0, 100)
  const contains = { contains: query, mode: 'insensitive' }
  const search = query ? {
    OR: [
      { agreementNumber: contains },
      { client: { firstName: contains } },
      { client: { lastName: contains } },
      { client: { organizationName: contains } },
      { client: { preferredName: contains } },
    ],
  } : {}
  const where = { ...search, ...(status ? { status: { equals: status } } : {}) }
  const countFields = RETAINER_STATUSES.map((value) => `${value}: retainerAgreementsCount(where: { AND: [$search, { status: { equals: ${value} } }] })`).join('\n')
  const [response, timeZone] = await Promise.all([
    keystoneClient<{ rows: RetainerListRow[]; total: number } & Record<string, number>>(`
      query RetainerList($where: RetainerAgreementWhereInput!, $search: RetainerAgreementWhereInput!) {
        rows: retainerAgreements(where: $where, orderBy: [{ createdAt: desc }, { id: asc }], take: 100) { ${listFields} }
        total: retainerAgreementsCount(where: $search)
        ${countFields}
      }
    `, { where, search }),
    getFirmTimeZone(),
  ])
  if (!response.success) return { success: false, error: 'Retainer agreements could not be loaded. Check billing permission.' }
  const counts = Object.fromEntries(RETAINER_STATUSES.map((value) => [value, Number(response.data[value] ?? 0)]))
  return { success: true, data: { rows: response.data.rows ?? [], counts, total: response.data.total ?? 0, timeZone } }
}

async function firmYear() {
  const year = new Intl.DateTimeFormat('en-US', { timeZone: await getFirmTimeZone(), year: 'numeric' }).format(new Date())
  return /^\d{4}$/.test(year) ? year : String(new Date().getUTCFullYear())
}

export async function getRetainerFormSetup(): Promise<{ success: true; data: RetainerFormSetup } | { success: false; error: string }> {
  const year = await firmYear()
  const prefix = `RA-${year}-`
  const response = await keystoneClient<{
    matters: RetainerMatterOption[]
    numbers: Array<{ agreementNumber: string }>
    firms: Array<{ defaultCurrency: string | null }>
  }>(`
    query RetainerFormSetup($statuses: [MatterStatusType!], $prefix: String!) {
      matters(where: { status: { in: $statuses } }, orderBy: [{ matterNumber: asc }, { id: asc }], take: 200) {
        id matterNumber title status client { id displayName }
      }
      numbers: retainerAgreements(where: { agreementNumber: { startsWith: $prefix } }, take: 1000) { agreementNumber }
      firms(take: 1) { defaultCurrency }
    }
  `, { statuses: OPEN_MATTER_STATUSES, prefix })
  if (!response.success) return { success: false, error: 'Matters for a new agreement could not be loaded. Check billing permission.' }
  const highest = response.data.numbers.reduce((max, row) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(row.agreementNumber)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return {
    success: true,
    data: {
      matters: response.data.matters ?? [],
      suggestedNumber: `${prefix}${String(highest + 1).padStart(3, '0')}`,
      defaultCurrency: (response.data.firms?.[0]?.defaultCurrency || 'USD').toUpperCase(),
    },
  }
}

export async function getRetainerMatterContext(matterId: string): Promise<{ success: true; data: RetainerMatterContext } | { success: false; error: string }> {
  if (!validId(matterId)) return { success: false, error: 'Choose a matter.' }
  const response = await keystoneClient<{
    matter: { id: string; client: Named | null; parties: Array<{ contact: Named | null }> } | null
    rateCards: Array<{ id: string; name: string; currencyCode: string; matter: { id: string } | null }>
    trustLedgerAccounts: Array<{ id: string; ledgerNumber: string; currencyCode: string; client: Named | null }>
  }>(`
    query RetainerMatterContext($id: ID!) {
      matter(where: { id: $id }) {
        id client { id displayName }
        parties(where: { partyRole: { equals: client }, status: { equals: active } }, take: 20) { contact { id displayName } }
      }
      rateCards(where: { status: { equals: active }, OR: [{ matter: null }, { matter: { id: { equals: $id } } }] }, orderBy: [{ name: asc }], take: 100) {
        id name currencyCode matter { id }
      }
      trustLedgerAccounts(where: { status: { equals: active }, matter: { id: { equals: $id } } }, orderBy: [{ ledgerNumber: asc }], take: 50) {
        id ledgerNumber currencyCode client { id displayName }
      }
    }
  `, { id: matterId })
  if (!response.success) return { success: false, error: 'Matter details could not be loaded.' }
  const matter = response.data.matter
  if (!matter) return { success: false, error: 'Choose a matter you can access.' }
  const clients = new Map<string, string>()
  if (matter.client) clients.set(matter.client.id, matter.client.displayName ?? 'Client')
  for (const party of matter.parties ?? []) if (party.contact) clients.set(party.contact.id, party.contact.displayName ?? 'Client')
  return {
    success: true,
    data: {
      clients: [...clients].map(([id, displayName]) => ({ id, displayName })),
      defaultClientId: matter.client?.id ?? null,
      rateCards: (response.data.rateCards ?? []).map((card) => ({ id: card.id, name: card.name, currencyCode: card.currencyCode, matterScoped: Boolean(card.matter) })),
      trustLedgers: (response.data.trustLedgerAccounts ?? []).map((ledger) => ({ id: ledger.id, ledgerNumber: ledger.ledgerNumber, currencyCode: ledger.currencyCode, clientId: ledger.client?.id ?? null, clientName: ledger.client?.displayName ?? null })),
    },
  }
}

function optionalAmount(formData: FormData, key: string, currencyCode: string, label: string) {
  const raw = field(formData, key)
  if (!raw) return null
  const minor = decimalToMinorUnits(raw, currencyCode)
  if (minor < 0) throw new Error(`${label} cannot be negative.`)
  if (minor > 2_147_483_647) throw new Error(`${label} is too large.`)
  return minor
}

export async function prepareRetainer(_previous: RetainerActionState, formData: FormData): Promise<RetainerActionState> {
  try {
    const matterId = field(formData, 'matterId')
    const clientId = field(formData, 'clientId')
    const agreementNumber = field(formData, 'agreementNumber')
    const feeStructure = field(formData, 'feeStructure')
    const currencyCode = field(formData, 'currencyCode').toUpperCase()
    const rateCardId = field(formData, 'rateCardId')
    const trustLedgerAccountId = field(formData, 'trustLedgerAccountId')
    const termsSummary = field(formData, 'termsSummary')
    if (!validId(matterId)) return { ok: false, message: 'Choose a matter.' }
    if (!validId(clientId)) return { ok: false, message: 'Choose the agreement client.' }
    if (!agreementNumber || agreementNumber.length > 100) return { ok: false, message: 'Agreement number is required (100 characters or fewer).' }
    if (!FEE_STRUCTURES.some(([value]) => value === feeStructure)) return { ok: false, message: 'Choose a fee structure.' }
    if (!/^[A-Z]{3}$/.test(currencyCode) || currencyFractionDigits(currencyCode) === null) return { ok: false, message: 'Currency must be a three-letter ISO code.' }
    if (rateCardId && !validId(rateCardId)) return { ok: false, message: 'Choose a valid rate card.' }
    if (trustLedgerAccountId && !validId(trustLedgerAccountId)) return { ok: false, message: 'Choose a valid trust ledger.' }
    if (termsSummary.length > 4000) return { ok: false, message: 'Terms summary must be 4,000 characters or fewer.' }

    const initialRetainerMinor = optionalAmount(formData, 'initialRetainer', currencyCode, 'Initial retainer')
    const evergreenThresholdMinor = optionalAmount(formData, 'evergreenThreshold', currencyCode, 'Evergreen threshold')
    const replenishmentAmountMinor = optionalAmount(formData, 'replenishmentAmount', currencyCode, 'Replenishment amount')

    const contingencyRaw = field(formData, 'contingencyPercent')
    let contingencyBasisPoints: number | null = null
    if (CONTINGENCY_FEES.has(feeStructure)) {
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(contingencyRaw)) return { ok: false, message: 'Contingency % is required for contingency and hybrid fees (up to two decimals).' }
      const [whole, fraction = ''] = contingencyRaw.split('.')
      contingencyBasisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
      if (contingencyBasisPoints > 10_000) return { ok: false, message: 'Contingency cannot exceed 100%.' }
    } else if (contingencyRaw) {
      return { ok: false, message: 'Contingency % applies only to contingency and hybrid fees.' }
    }

    // Pre-validate scope rules the command enforces, so the merchant sees the reason.
    const context = await getRetainerMatterContext(matterId)
    if (!context.success) return { ok: false, message: context.error }
    if (!context.data.clients.some((client) => client.id === clientId)) return { ok: false, message: "The agreement client must be this matter's client." }
    const rateCard = rateCardId ? context.data.rateCards.find((card) => card.id === rateCardId) : null
    if (rateCardId && !rateCard) return { ok: false, message: 'Rate card must be active and apply to this matter.' }
    if (rateCard && rateCard.currencyCode.toUpperCase() !== currencyCode) return { ok: false, message: 'Rate card currency must match the agreement currency.' }
    const ledger = trustLedgerAccountId ? context.data.trustLedgers.find((row) => row.id === trustLedgerAccountId) : null
    if (trustLedgerAccountId && (!ledger || ledger.clientId !== clientId)) return { ok: false, message: 'Trust ledger must be an active ledger for this matter and client.' }
    if (ledger && ledger.currencyCode.toUpperCase() !== currencyCode) return { ok: false, message: 'Trust ledger currency must match the agreement currency.' }

    const [matterCheck, duplicate] = await Promise.all([
      keystoneClient<{ matter: { status: string } | null }>(`query RetainerMatterStatus($id: ID!) { matter(where: { id: $id }) { status } }`, { id: matterId }),
      keystoneClient<{ count: number }>(`query RetainerNumberTaken($number: String!) { count: retainerAgreementsCount(where: { agreementNumber: { equals: $number } }) }`, { number: agreementNumber }),
    ])
    if (!matterCheck.success || !matterCheck.data.matter) return { ok: false, message: 'Choose a matter you can access.' }
    if (!OPEN_MATTER_STATUSES.includes(matterCheck.data.matter.status)) return { ok: false, message: 'Only an open matter can receive a fee agreement.' }
    if (duplicate.success && duplicate.data.count > 0) return { ok: false, message: `Agreement number ${agreementNumber} is already in use.` }

    const response = await keystoneClient<{ prepareRetainerAgreement: { id: string; status: string } }>(`
      mutation PrepareRetainerAgreement(
        $matterId: ID!, $clientId: ID!, $agreementNumber: String!, $feeStructure: String!, $currencyCode: String!,
        $rateCardId: ID, $trustLedgerAccountId: ID, $initialRetainerMinor: Int, $evergreenThresholdMinor: Int,
        $replenishmentAmountMinor: Int, $contingencyBasisPoints: Int, $termsSummary: String
      ) {
        prepareRetainerAgreement(
          matterId: $matterId, clientId: $clientId, agreementNumber: $agreementNumber, feeStructure: $feeStructure,
          currencyCode: $currencyCode, rateCardId: $rateCardId, trustLedgerAccountId: $trustLedgerAccountId,
          initialRetainerMinor: $initialRetainerMinor, evergreenThresholdMinor: $evergreenThresholdMinor,
          replenishmentAmountMinor: $replenishmentAmountMinor, contingencyBasisPoints: $contingencyBasisPoints,
          termsSummary: $termsSummary
        ) { id status }
      }
    `, {
      matterId,
      clientId,
      agreementNumber,
      feeStructure,
      currencyCode,
      rateCardId: rateCardId || null,
      trustLedgerAccountId: trustLedgerAccountId || null,
      initialRetainerMinor,
      evergreenThresholdMinor,
      replenishmentAmountMinor,
      contingencyBasisPoints,
      termsSummary: termsSummary || null,
    })
    if (!response.success) return { ok: false, message: 'The agreement was not prepared. Check billing permission and your billing access on this matter.' }
    revalidatePath('/dashboard/platform/retainers')
    return { ok: true, message: `Draft agreement ${agreementNumber} prepared.`, retainerId: response.data.prepareRetainerAgreement.id }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The agreement was not prepared.' }
  }
}

const detailFields = `
  ${listFields}
  evergreenThresholdMinor replenishmentAmountMinor contingencyBasisPoints termsSummary sentAt acceptedAt terminatedAt
  rateCard { id name currencyCode }
  trustLedgerAccount { id ledgerNumber currencyCode }
  signedDocumentVersion { id versionNumber fileName document { id title } }
  invoices(orderBy: [{ createdAt: desc }], take: 50) { id invoiceNumber status totalMinor balanceDueMinor currencyCode issuedAt dueAt }
`

export async function getRetainerDetail(retainerId: string): Promise<{ success: true; data: RetainerDetail } | { success: false; error: string; notFound?: boolean }> {
  if (!validId(retainerId)) return { success: false, error: 'Agreement not found.', notFound: true }
  const [response, timeZone] = await Promise.all([
    keystoneClient<{ retainerAgreement: RetainerDetail['retainer'] | null }>(`
      query RetainerDetail($id: ID!) { retainerAgreement(where: { id: $id }) { ${detailFields} } }
    `, { id: retainerId }),
    getFirmTimeZone(),
  ])
  if (!response.success) return { success: false, error: 'The agreement could not be loaded. Check billing permission.' }
  const retainer = response.data.retainerAgreement
  if (!retainer) return { success: false, error: 'Agreement not found.', notFound: true }
  let documentVersions: RetainerDetail['documentVersions'] = []
  if (retainer.status === 'sent' && retainer.matter) {
    const versions = await keystoneClient<{ documentVersions: Array<{ id: string; versionNumber: number; fileName: string | null; createdAt: string | null; document: { title: string | null } | null }> }>(`
      query RetainerSignedVersions($matterId: ID!) {
        documentVersions(
          where: { document: { matter: { id: { equals: $matterId } }, status: { notIn: [archived, disposed] } } }
          orderBy: [{ createdAt: desc }, { id: asc }]
          take: 100
        ) { id versionNumber fileName createdAt document { title } }
      }
    `, { matterId: retainer.matter.id })
    if (versions.success) {
      documentVersions = versions.data.documentVersions.map((version) => ({
        id: version.id,
        label: `${version.document?.title ?? 'Document'} · v${version.versionNumber}${version.fileName ? ` · ${version.fileName}` : ''}`,
      }))
    }
  }
  return { success: true, data: { retainer, documentVersions, timeZone } }
}

export async function transitionRetainer(_previous: RetainerActionState, formData: FormData): Promise<RetainerActionState> {
  try {
    const retainerId = field(formData, 'retainerId')
    const toStatus = field(formData, 'toStatus')
    const signedDocumentVersionId = field(formData, 'signedDocumentVersionId')
    const effectiveDate = field(formData, 'effectiveDate')
    const reason = field(formData, 'reason')
    if (!validId(retainerId)) return { ok: false, message: 'Reload the page and try again.' }
    const loaded = await getRetainerDetail(retainerId)
    if (!loaded.success) return { ok: false, message: loaded.error }
    const { retainer } = loaded.data
    if (!(RETAINER_TRANSITIONS[retainer.status] ?? []).includes(toStatus)) {
      return { ok: false, message: `A ${retainer.status} agreement cannot move to ${toStatus}. Reload the page.` }
    }
    if (reason.length > 2000) return { ok: false, message: 'Reason must be 2,000 characters or fewer.' }
    if (toStatus === 'terminated' && reason.length < 5) return { ok: false, message: 'Termination reason must be at least 5 characters.' }
    if (toStatus === 'accepted') {
      if (!validId(signedDocumentVersionId)) return { ok: false, message: "Choose the signed agreement's document version." }
      if (!loaded.data.documentVersions.some((version) => version.id === signedDocumentVersionId)) {
        return { ok: false, message: 'The signed agreement must be a current document version on this matter.' }
      }
    }
    let effectiveAt: string | null = null
    if (toStatus === 'active') {
      if ((retainer.initialRetainerMinor ?? 0) > 0 && !retainer.trustLedgerAccount) {
        return { ok: false, message: 'An agreement that takes a retainer deposit needs the client trust ledger before it becomes active.' }
      }
      if (effectiveDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return { ok: false, message: 'Effective date is invalid.' }
        const instant = zonedWallTimeToInstant(`${effectiveDate}T00:00`, loaded.data.timeZone)
        if (!instant) return { ok: false, message: 'Effective date is invalid.' }
        effectiveAt = instant.toISOString()
      }
    }

    const response = await keystoneClient<{ transitionRetainerAgreement: { id: string; status: string } }>(`
      mutation TransitionRetainerAgreement($retainerId: ID!, $toStatus: String!, $signedDocumentVersionId: ID, $effectiveAt: DateTime, $reason: String) {
        transitionRetainerAgreement(retainerId: $retainerId, toStatus: $toStatus, signedDocumentVersionId: $signedDocumentVersionId, effectiveAt: $effectiveAt, reason: $reason) { id status }
      }
    `, {
      retainerId,
      toStatus,
      signedDocumentVersionId: toStatus === 'accepted' ? signedDocumentVersionId : null,
      effectiveAt,
      reason: reason || null,
    })
    if (!response.success) return { ok: false, message: 'The agreement status was not changed. Check billing permission and your billing access on this matter.' }
    revalidatePath('/dashboard/platform/retainers')
    revalidatePath(`/dashboard/platform/retainers/${retainerId}`)
    return { ok: true, message: `Agreement ${retainer.agreementNumber} is now ${toStatus}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The agreement status was not changed.' }
  }
}
