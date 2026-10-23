'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { decimalToMinorUnits } from '@/features/platform/lib/money'

export type PublicSitePolicyRow = {
  id: string
  status: 'draft' | 'published'
  publicAccountsEnabled: boolean
  publicBookingEnabled: boolean
  privacyNotice: string | null
  privacyNoticeVersion: number | null
  firstContactNotice: string | null
  firstContactNoticeVersion: number | null
  aboutStatement: string | null
  publishedAt: string | null
}

export type PublicPracticeAreaRow = {
  id: string
  name: string
  code: string | null
  status: 'active' | 'archived'
  description: string | null
  isPublic: boolean
  publicSlug: string | null
  consultationFeeMinor: number
  consultationMinutes: number
}

export type PublicSiteSetup =
  | { status: 'loaded'; firm: { id: string; defaultCurrency: string }; policy: PublicSitePolicyRow | null; practiceAreas: PublicPracticeAreaRow[] }
  | { status: 'error'; message: string }

export type PublicSiteState = { ok: boolean; message: string; revision: number }

const policyFields = 'id status publicAccountsEnabled publicBookingEnabled privacyNotice privacyNoticeVersion firstContactNotice firstContactNoticeVersion aboutStatement publishedAt'
const areaFields = 'id name code status description isPublic publicSlug consultationFeeMinor consultationMinutes'

export async function getPublicSiteSetup(): Promise<PublicSiteSetup> {
  const response = await keystoneClient<{ firms: Array<{ id: string; defaultCurrency: string | null }>; publicSitePolicies: PublicSitePolicyRow[]; practiceAreas: PublicPracticeAreaRow[] }>(`
    query PublicSiteSetup {
      firms(take: 1) { id defaultCurrency }
      publicSitePolicies(take: 1) { ${policyFields} }
      practiceAreas(take: 100, orderBy: [{ name: asc }]) { ${areaFields} }
    }
  `)
  if (!response.success) return { status: 'error', message: 'Public site settings could not be loaded. Firm management permission is required.' }
  const firm = response.data.firms?.[0]
  if (!firm) return { status: 'error', message: 'No active firm.' }
  return {
    status: 'loaded',
    firm: { id: firm.id, defaultCurrency: (firm.defaultCurrency || 'USD').toUpperCase() },
    policy: response.data.publicSitePolicies?.[0] ?? null,
    practiceAreas: response.data.practiceAreas ?? [],
  }
}

function textValue(formData: FormData, key: string, max: number) {
  const value = String(formData.get(key) ?? '').trim()
  if (value.length > max) throw new Error(`${key} must be ${max} characters or fewer.`)
  return value
}

function refresh() {
  revalidatePath('/dashboard/platform/public-site')
  revalidatePath('/dashboard/platform/branding')
  for (const path of ['/', '/about', '/privacy', '/practice-areas', '/consultation', '/account/signup', '/attorneys']) revalidatePath(path)
}

/** Writes the firm's single PublicSitePolicy; preconditions mirror the model validation so the reason is shown. */
export async function savePublicSitePolicy(previous: PublicSiteState, formData: FormData): Promise<PublicSiteState> {
  const revision = previous.revision + 1
  try {
    const policyId = String(formData.get('policyId') ?? '').trim()
    const status = formData.get('status') === 'published' ? 'published' : 'draft'
    const publicAccountsEnabled = formData.get('publicAccountsEnabled') === 'on'
    const publicBookingEnabled = formData.get('publicBookingEnabled') === 'on'
    const privacyNotice = textValue(formData, 'privacyNotice', 20000)
    const firstContactNotice = textValue(formData, 'firstContactNotice', 20000)
    const aboutStatement = textValue(formData, 'aboutStatement', 20000)
    if (publicBookingEnabled && !publicAccountsEnabled) return { ok: false, message: 'Consultation booking requires client accounts.', revision }
    if (status === 'published' && (publicAccountsEnabled || publicBookingEnabled) && !privacyNotice) return { ok: false, message: 'Add the privacy notice before opening accounts or booking.', revision }
    if (status === 'published' && publicBookingEnabled && !firstContactNotice) return { ok: false, message: 'Add the first-contact notice before opening booking.', revision }
    const data = { status, publicAccountsEnabled, publicBookingEnabled, privacyNotice, firstContactNotice, aboutStatement }
    const response = policyId
      ? await keystoneClient<{ updatePublicSitePolicy: { id: string } | null }>(`mutation SavePolicy($id: ID!, $data: PublicSitePolicyUpdateInput!) { updatePublicSitePolicy(where: { id: $id }, data: $data) { id } }`, { id: policyId, data })
      : await keystoneClient<{ createPublicSitePolicy: { id: string } | null }>(`mutation CreatePolicy($data: PublicSitePolicyCreateInput!) { createPublicSitePolicy(data: $data) { id } }`, { data })
    if (!response.success) return { ok: false, message: 'Public site was not saved. Firm management permission and a signed-in staff session are required.', revision }
    refresh()
    return { ok: true, message: status === 'published' ? 'Public site published.' : 'Saved as draft. The public site stays unpublished.', revision }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Public site was not saved.', revision }
  }
}

/** Creates or updates one practice area's public listing. */
export async function savePracticeArea(previous: PublicSiteState, formData: FormData): Promise<PublicSiteState> {
  const revision = previous.revision + 1
  try {
    const id = String(formData.get('id') ?? '').trim()
    const currency = String(formData.get('currencyCode') ?? 'USD').trim().toUpperCase()
    const name = textValue(formData, 'name', 200)
    if (!name) return { ok: false, message: 'Name is required.', revision }
    const minutes = Number(formData.get('consultationMinutes'))
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 120) return { ok: false, message: 'Consultation length must be 15–120 minutes.', revision }
    const feeRaw = String(formData.get('consultationFee') ?? '').trim() || '0'
    const consultationFeeMinor = decimalToMinorUnits(feeRaw, currency)
    if (consultationFeeMinor < 0) return { ok: false, message: 'Fee cannot be negative.', revision }
    const slug = textValue(formData, 'publicSlug', 80).toLowerCase()
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, message: 'Web address may use lowercase letters, numbers and single hyphens.', revision }
    const data: Record<string, unknown> = {
      name,
      description: textValue(formData, 'description', 4000),
      isPublic: formData.get('isPublic') === 'on',
      consultationMinutes: minutes,
      consultationFeeMinor,
      ...(slug ? { publicSlug: slug } : {}),
    }
    const response = id
      ? await keystoneClient<{ updatePracticeArea: { id: string } | null }>(`mutation SaveArea($id: ID!, $data: PracticeAreaUpdateInput!) { updatePracticeArea(where: { id: $id }, data: $data) { id } }`, { id, data })
      : await keystoneClient<{ createPracticeArea: { id: string } | null }>(`mutation CreateArea($data: PracticeAreaCreateInput!) { createPracticeArea(data: $data) { id } }`, { data })
    if (!response.success) return { ok: false, message: 'Practice area was not saved. The web address may already be in use, or matter management permission is required.', revision }
    refresh()
    return { ok: true, message: id ? 'Practice area saved.' : 'Practice area added.', revision }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Practice area was not saved.', revision }
  }
}
