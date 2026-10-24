'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { validTimeZone } from '@/features/platform/lib/datetime'

import { OFFICE_STATUSES, type FirmActionState } from '../lib/firmTypes'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[0-9+().\-\s/x#*]{3,40}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

class InputError extends Error {}

function text(formData: FormData, key: string, label: string, max: number) {
  const value = String(formData.get(key) ?? '').trim()
  if (value.length > max) throw new InputError(`${label} must be ${max} characters or fewer.`)
  return value
}

function timeZone(formData: FormData, key: string) {
  const zone = validTimeZone(String(formData.get(key) ?? ''))
  if (!zone) throw new InputError('Enter a valid IANA time zone, such as America/New_York.')
  return zone
}

function currency(formData: FormData) {
  const code = String(formData.get('defaultCurrency') ?? '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) throw new InputError('Use a three-letter currency code, such as USD.')
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code })
  } catch {
    throw new InputError('Unknown currency code.')
  }
  return code
}

function fail(error: unknown, revision: number, fallback: string): FirmActionState {
  return { ok: false, message: error instanceof InputError ? error.message : fallback, revision }
}

function refresh() {
  revalidatePath('/dashboard/platform/firm')
  revalidatePath('/dashboard/platform/team')
}

/** Legal name, slug, default time zone and currency. Brand fields belong to Store Settings. */
export async function saveFirmDefaults(previous: FirmActionState, formData: FormData): Promise<FirmActionState> {
  const revision = previous.revision + 1
  try {
    const firmId = String(formData.get('firmId') ?? '').trim()
    if (!firmId) throw new InputError('No active firm. Reload the page.')
    const name = text(formData, 'name', 'Legal name', 200)
    if (!name) throw new InputError('Legal name is required.')
    const slug = text(formData, 'slug', 'Slug', 80).toLowerCase()
    if (!slug) throw new InputError('Slug is required.')
    if (!SLUG.test(slug)) throw new InputError('Slug may use lowercase letters, numbers and single hyphens.')
    const data = { name, slug, defaultTimezone: timeZone(formData, 'defaultTimezone'), defaultCurrency: currency(formData) }
    const response = await keystoneClient<{ updateFirm: { id: string } | null }>(
      `mutation SaveFirmDefaults($id: ID!, $data: FirmUpdateInput!) { updateFirm(where: { id: $id }, data: $data) { id } }`,
      { id: firmId, data },
    )
    if (!response.success || !response.data.updateFirm) return { ok: false, message: 'Firm was not saved. The slug may already be in use, or firm management permission is required.', revision }
    refresh()
    return { ok: true, message: 'Firm defaults saved.', revision }
  } catch (error) {
    return fail(error, revision, 'Firm was not saved.')
  }
}

export async function saveOffice(previous: FirmActionState, formData: FormData): Promise<FirmActionState> {
  const revision = previous.revision + 1
  try {
    const officeId = String(formData.get('officeId') ?? '').trim()
    const name = text(formData, 'name', 'Name', 200)
    if (!name) throw new InputError('Name is required.')
    const code = text(formData, 'code', 'Code', 40)
    if (!code) throw new InputError('Code is required.')
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(code)) throw new InputError('Code may use letters, numbers, hyphens and underscores.')
    const email = text(formData, 'email', 'Email', 320).toLowerCase()
    if (email && !EMAIL.test(email)) throw new InputError('Enter a valid email address.')
    const phone = text(formData, 'phone', 'Phone', 40)
    if (phone && !PHONE.test(phone)) throw new InputError('Enter a valid phone number.')
    const status = String(formData.get('status') ?? 'active')
    if (!(OFFICE_STATUSES as readonly string[]).includes(status)) throw new InputError('Choose a status.')
    const data = { name, code, email, phone, status, timezone: timeZone(formData, 'timezone') }

    // Office codes are unique within the firm; check first so the reason is shown.
    const clash = await keystoneClient<{ offices: Array<{ id: string }> }>(
      `query OfficeCode($code: String!) { offices(where: { code: { equals: $code, mode: insensitive } }, take: 5) { id } }`,
      { code },
    )
    if (clash.success && clash.data.offices.some((office) => office.id !== officeId)) throw new InputError(`Another office already uses code ${code}.`)

    let saved = false
    if (officeId) {
      const response = await keystoneClient<{ updateOffice: { id: string } | null }>(
        `mutation UpdateOffice($id: ID!, $data: OfficeUpdateInput!) { updateOffice(where: { id: $id }, data: $data) { id } }`,
        { id: officeId, data },
      )
      saved = response.success && Boolean(response.data.updateOffice)
    } else {
      const response = await keystoneClient<{ createOffice: { id: string } | null }>(
        `mutation CreateOffice($data: OfficeCreateInput!) { createOffice(data: $data) { id } }`,
        { data },
      )
      saved = response.success && Boolean(response.data.createOffice)
    }
    if (!saved) return { ok: false, message: officeId ? 'Office was not saved. Firm management permission is required.' : 'Office was not added. Firm management permission is required.', revision }
    refresh()
    return { ok: true, message: officeId ? 'Office saved.' : 'Office added.', revision }
  } catch (error) {
    return fail(error, revision, 'Office was not saved.')
  }
}
