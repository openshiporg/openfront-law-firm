'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { zonedWallTimeToInstant } from '@/features/platform/lib/datetime'
import { decimalToMinorUnits, formatMoneyLabel } from '@/features/platform/lib/money'

import { loadActiveHourlyRules, priceEntries } from '../lib/loadRateRules'

export type RateActionState = { ok: boolean; message: string }

export type BillingRateCard = {
  id: string
  name: string
  status: string
  currencyCode: string
  effectiveFrom: string | null
  matter: { id: string; matterNumber: string } | null
  rules: Array<{
    id: string
    rateType: string
    amountMinor: number
    currencyCode: string
    user: { name: string | null } | null
    practiceArea: { name: string | null } | null
    matter: { matterNumber: string } | null
  }>
}

export type BillingRatesSetup = {
  cards: BillingRateCard[]
  unpricedOpenTime: number
  unpricedApprovedTime: number
}

const BILLING_PATHS = ['/dashboard/platform/billing', '/dashboard/platform/time-expenses']
const UNPRICED_PAGE = 100

function revalidateBilling() {
  for (const path of BILLING_PATHS) revalidatePath(path)
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function getBillingRatesSetup(): Promise<{ success: true; data: BillingRatesSetup } | { success: false; error: string }> {
  const response = await keystoneClient<{ rateCards: BillingRateCard[]; open: number; approved: number }>(`
    query BillingRates {
      rateCards(where: { status: { in: [draft, active] } }, orderBy: [{ name: asc }, { id: asc }], take: 50) {
        id name status currencyCode effectiveFrom
        matter { id matterNumber }
        rules(orderBy: [{ priority: asc }, { id: asc }], take: 50) {
          id rateType amountMinor currencyCode
          user { name } practiceArea { name } matter { matterNumber }
        }
      }
      open: timeEntriesCount(where: { status: { in: [draft, submitted] }, isBillable: { equals: true }, amountMinor: { equals: null } })
      approved: timeEntriesCount(where: { status: { equals: approved }, isBillable: { equals: true }, amountMinor: { equals: null }, invoiceLine: null })
    }
  `)
  if (!response.success) return { success: false, error: response.error }
  return { success: true, data: { cards: response.data.rateCards, unpricedOpenTime: response.data.open, unpricedApprovedTime: response.data.approved } }
}

async function effectiveInstant(value: string) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Effective date must be a date.')
  const instant = zonedWallTimeToInstant(`${value}T00:00`, await getFirmTimeZone())
  if (!instant) throw new Error('Effective date is not a valid date in the firm time zone.')
  return instant.toISOString()
}

// A rate card is created in draft (its initial lifecycle state) and activated straight
// after, so it applies to time immediately. Matter-scoped cards apply to that matter only.
export async function createRateCard(_previous: RateActionState, formData: FormData): Promise<RateActionState> {
  try {
    const name = field(formData, 'name')
    const currencyCode = field(formData, 'currencyCode').toUpperCase()
    const matterId = field(formData, 'matterId')
    if (name.length < 2 || name.length > 200) return { ok: false, message: 'Name must be 2–200 characters.' }
    if (!/^[A-Z]{3}$/.test(currencyCode)) return { ok: false, message: 'Currency must be a three-letter code.' }
    if (matterId.length > 200) return { ok: false, message: 'Choose a valid matter.' }
    const effectiveFrom = await effectiveInstant(field(formData, 'effectiveFrom'))
    const created = await keystoneClient<{ createRateCard: { id: string } | null }>(`
      mutation CreateRateCard($data: RateCardCreateInput!) { createRateCard(data: $data) { id } }
    `, {
      data: {
        name,
        currencyCode,
        ...(matterId ? { matter: { connect: { id: matterId } } } : {}),
        ...(effectiveFrom ? { effectiveFrom } : {}),
      },
    })
    if (!created.success || !created.data.createRateCard) {
      return { ok: false, message: created.success ? 'The rate card was not created.' : 'The rate card was not created. Check billing permission and matter access.' }
    }
    const activated = await keystoneClient<{ updateRateCard: { id: string; status: string } | null }>(`
      mutation ActivateRateCard($id: ID!) { updateRateCard(where: { id: $id }, data: { status: active }) { id status } }
    `, { id: created.data.createRateCard.id })
    revalidateBilling()
    if (!activated.success || activated.data.updateRateCard?.status !== 'active') {
      return { ok: false, message: 'Rate card created as a draft but not activated.' }
    }
    return { ok: true, message: `Rate card ${name} is active.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The rate card was not created.' }
  }
}

export async function setRateCardStatus(rateCardId: string, status: 'active' | 'retired'): Promise<RateActionState> {
  const id = String(rateCardId ?? '').trim()
  if (!id || id.length > 200 || !['active', 'retired'].includes(status)) return { ok: false, message: 'Choose a rate card.' }
  const response = await keystoneClient<{ updateRateCard: { id: string; status: string } | null }>(`
    mutation SetRateCardStatus($id: ID!, $status: RateCardStatusType!) { updateRateCard(where: { id: $id }, data: { status: $status }) { id status } }
  `, { id, status })
  if (!response.success || !response.data.updateRateCard) {
    return { ok: false, message: status === 'retired' ? 'The rate card was not retired.' : 'The rate card was not activated.' }
  }
  revalidateBilling()
  return { ok: true, message: status === 'retired' ? 'Rate card retired.' : 'Rate card active.' }
}

export async function addRateRule(_previous: RateActionState, formData: FormData): Promise<RateActionState> {
  try {
    const rateCardId = field(formData, 'rateCardId')
    const userId = field(formData, 'userId')
    const practiceAreaId = field(formData, 'practiceAreaId')
    if (!rateCardId || rateCardId.length > 200) return { ok: false, message: 'Choose a rate card.' }
    if (userId.length > 200 || practiceAreaId.length > 200) return { ok: false, message: 'Choose a valid timekeeper or practice area.' }
    const card = await keystoneClient<{ rateCard: { id: string; name: string; status: string; currencyCode: string; matter: { id: string } | null } | null }>(`
      query RateCardForRule($id: ID!) { rateCard(where: { id: $id }) { id name status currencyCode matter { id } } }
    `, { id: rateCardId })
    if (!card.success) return { ok: false, message: card.error }
    if (!card.data.rateCard || card.data.rateCard.status === 'retired') return { ok: false, message: 'Choose an active or draft rate card.' }
    const currencyCode = card.data.rateCard.currencyCode
    const amountMinor = decimalToMinorUnits(field(formData, 'amount'), currencyCode)
    if (amountMinor <= 0 || amountMinor > 2_000_000_000) return { ok: false, message: 'Hourly rate must be greater than zero.' }
    const response = await keystoneClient<{ createRateRule: { id: string } | null }>(`
      mutation CreateRateRule($data: RateRuleCreateInput!) { createRateRule(data: $data) { id } }
    `, {
      data: {
        rateCard: { connect: { id: rateCardId } },
        rateType: 'hourly',
        amountMinor,
        currencyCode,
        unitLabel: 'hour',
        // A matter card's rules share its matter scope.
        ...(card.data.rateCard.matter ? { matter: { connect: { id: card.data.rateCard.matter.id } } } : {}),
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        ...(practiceAreaId ? { practiceArea: { connect: { id: practiceAreaId } } } : {}),
      },
    })
    if (!response.success || !response.data.createRateRule) return { ok: false, message: 'The rate was not added. Check billing permission.' }
    revalidateBilling()
    return { ok: true, message: `${formatMoneyLabel(amountMinor, currencyCode)}/hour added to ${card.data.rateCard.name}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The rate was not added.' }
  }
}

// Draft and submitted time is still editable, so active rates can be applied to it before
// approval. Approved time is immutable and keeps whatever amount it was approved with.
export async function priceUnapprovedTime(): Promise<RateActionState> {
  const [entries, rules] = await Promise.all([
    keystoneClient<{ timeEntries: Array<{ id: string; durationMinutes: number; workDate: string; user: { id: string } | null; matter: { id: string; practiceArea: { id: string } | null } | null }> }>(`
      query UnpricedOpenTime($take: Int!) {
        timeEntries(
          where: { status: { in: [draft, submitted] }, isBillable: { equals: true }, amountMinor: { equals: null } }
          orderBy: [{ workDate: asc }, { id: asc }]
          take: $take
        ) { id durationMinutes workDate user { id } matter { id practiceArea { id } } }
      }
    `, { take: UNPRICED_PAGE }),
    loadActiveHourlyRules(),
  ])
  if (!entries.success) return { ok: false, message: entries.error }
  if (!rules.success) return { ok: false, message: rules.error }
  const priced = priceEntries(rules.data.rateRules, entries.data.timeEntries)
  let updated = 0
  for (const [id, price] of priced) {
    const response = await keystoneClient<{ updateTimeEntry: { id: string } | null }>(`
      mutation PriceTimeEntry($id: ID!, $data: TimeEntryUpdateInput!) { updateTimeEntry(where: { id: $id }, data: $data) { id } }
    `, { id, data: { rateMinor: price.rateMinor, amountMinor: price.amountMinor, currencyCode: price.rule.currencyCode } })
    if (response.success && response.data.updateTimeEntry) updated++
  }
  revalidateBilling()
  const remaining = entries.data.timeEntries.length - updated
  if (!entries.data.timeEntries.length) return { ok: true, message: 'No unpriced draft or submitted time.' }
  return {
    ok: updated > 0,
    message: `Priced ${updated.toLocaleString()} ${updated === 1 ? 'entry' : 'entries'}.${remaining ? ` ${remaining.toLocaleString()} still ${remaining === 1 ? 'has' : 'have'} no applicable rate.` : ''}`,
  }
}
