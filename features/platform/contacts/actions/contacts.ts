'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import {
  ADDRESS_TYPES,
  MAX_CONFLICT_ALIASES,
  METHOD_TYPES,
  isContactStatus,
  isContactType,
  type ContactActionState,
} from '../lib/contactTypes'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[0-9+().\-\s/x#*]{3,40}$/i

class InputError extends Error {}

function text(formData: FormData, key: string, label: string, max: number) {
  const value = String(formData.get(key) ?? '').trim()
  if (value.length > max) throw new InputError(`${label} must be ${max} characters or fewer.`)
  return value
}

function id(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value || value.length > 200) throw new InputError('The record is missing. Reload the page and try again.')
  return value
}

function fail(error: unknown, revision: number, fallback: string): ContactActionState {
  return { ok: false, message: error instanceof InputError ? error.message : fallback, revision }
}

function refresh(contactId?: string) {
  revalidatePath('/dashboard/platform/contacts')
  if (contactId) revalidatePath(`/dashboard/platform/contacts/${contactId}`)
}

/** Mirrors the Contact model: type and status enums, PII text, bounded conflict aliases. */
function identityData(formData: FormData) {
  const contactType = String(formData.get('contactType') ?? '')
  if (!isContactType(contactType)) throw new InputError('Choose person or organization.')
  const firstName = text(formData, 'firstName', 'First name', 120)
  const middleName = text(formData, 'middleName', 'Middle name', 120)
  const lastName = text(formData, 'lastName', 'Last name', 120)
  const organizationName = text(formData, 'organizationName', 'Organization name', 200)
  const preferredName = text(formData, 'preferredName', 'Preferred name', 120)
  const primaryEmail = text(formData, 'primaryEmail', 'Email', 320).toLowerCase()
  const primaryPhone = text(formData, 'primaryPhone', 'Phone', 40)
  if (contactType === 'person' && !firstName && !lastName) throw new InputError('Enter a first or last name.')
  if (contactType === 'organization' && !organizationName) throw new InputError('Enter the organization name.')
  if (primaryEmail && !EMAIL.test(primaryEmail)) throw new InputError('Enter a valid email address.')
  if (primaryPhone && !PHONE.test(primaryPhone)) throw new InputError('Enter a valid phone number.')
  const rawAliases = String(formData.get('conflictSearchAliases') ?? '')
  const aliases = Array.from(new Set(rawAliases.split('\n').map((alias) => alias.trim()).filter(Boolean)))
  if (aliases.length > MAX_CONFLICT_ALIASES) throw new InputError(`Use at most ${MAX_CONFLICT_ALIASES} conflict aliases.`)
  if (aliases.some((alias) => alias.length > 200)) throw new InputError('Each conflict alias must be 200 characters or fewer.')
  return { contactType, firstName, middleName, lastName, organizationName, preferredName, primaryEmail, primaryPhone, conflictSearchAliases: aliases }
}

export async function createContact(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const data: Record<string, unknown> = identityData(formData)
    const status = String(formData.get('status') ?? 'prospective_client')
    if (!isContactStatus(status)) throw new InputError('Choose a status.')
    data.status = status
    const response = await keystoneClient<{ createContact: { id: string } | null }>(
      `mutation CreateContact($data: ContactCreateInput!) { createContact(data: $data) { id } }`,
      { data },
    )
    if (!response.success || !response.data.createContact) return { ok: false, message: 'Contact was not created. Managing people requires people-management access.', revision }
    refresh()
    return { ok: true, message: 'Contact created.', revision, id: response.data.createContact.id }
  } catch (error) {
    return fail(error, revision, 'Contact was not created.')
  }
}

export async function updateContactIdentity(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const contactId = id(formData, 'contactId')
    const data = identityData(formData)
    const response = await keystoneClient<{ updateContact: { id: string } | null }>(
      `mutation UpdateContact($id: ID!, $data: ContactUpdateInput!) { updateContact(where: { id: $id }, data: $data) { id } }`,
      { id: contactId, data },
    )
    if (!response.success || !response.data.updateContact) return { ok: false, message: 'Contact was not saved. Managing people requires people-management access.', revision }
    refresh(contactId)
    return { ok: true, message: 'Contact saved.', revision }
  } catch (error) {
    return fail(error, revision, 'Contact was not saved.')
  }
}

export async function changeContactStatus(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const contactId = id(formData, 'contactId')
    const status = String(formData.get('status') ?? '')
    if (!isContactStatus(status)) throw new InputError('Choose a status.')
    const response = await keystoneClient<{ updateContact: { id: string } | null }>(
      `mutation ChangeContactStatus($id: ID!, $data: ContactUpdateInput!) { updateContact(where: { id: $id }, data: $data) { id } }`,
      { id: contactId, data: { status } },
    )
    if (!response.success || !response.data.updateContact) return { ok: false, message: 'Status was not changed. Managing people requires people-management access.', revision }
    refresh(contactId)
    return { ok: true, message: 'Status changed.', revision }
  } catch (error) {
    return fail(error, revision, 'Status was not changed.')
  }
}

/** Clears isPrimary on the contact's other addresses or methods so one stays primary. */
async function clearOtherPrimaries(list: 'Address' | 'ContactMethod', contactId: string, keepId: string) {
  const plural = list === 'Address' ? 'addresses' : 'contactMethods'
  const update = list === 'Address' ? 'updateAddresses' : 'updateContactMethods'
  const where = list === 'Address' ? 'AddressWhereInput' : 'ContactMethodWhereInput'
  const input = list === 'Address' ? 'AddressUpdateArgs' : 'ContactMethodUpdateArgs'
  const others = await keystoneClient<Record<string, Array<{ id: string }>>>(
    `query OtherPrimaries($where: ${where}!) { ${plural}(where: $where, take: 50) { id } }`,
    { where: { contact: { id: { equals: contactId } }, isPrimary: { equals: true }, id: { not: { equals: keepId } } } },
  )
  if (!others.success) return false
  const rows = others.data[plural] ?? []
  if (!rows.length) return true
  const cleared = await keystoneClient(
    `mutation ClearPrimaries($data: [${input}!]!) { ${update}(data: $data) { id } }`,
    { data: rows.map((row) => ({ where: { id: row.id }, data: { isPrimary: false } })) },
  )
  return cleared.success
}

export async function saveAddress(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const contactId = id(formData, 'contactId')
    const addressId = String(formData.get('addressId') ?? '').trim()
    const addressType = String(formData.get('addressType') ?? 'mailing')
    if (!(ADDRESS_TYPES as readonly string[]).includes(addressType)) throw new InputError('Choose an address type.')
    const line1 = text(formData, 'line1', 'Address line 1', 200)
    const city = text(formData, 'city', 'City', 120)
    const countryCode = text(formData, 'countryCode', 'Country', 2).toUpperCase() || 'US'
    if (!line1) throw new InputError('Address line 1 is required.')
    if (!city) throw new InputError('City is required.')
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new InputError('Use a two-letter country code, such as US.')
    const isPrimary = formData.get('isPrimary') === 'on'
    const data: Record<string, unknown> = {
      label: text(formData, 'label', 'Label', 80),
      addressType,
      line1,
      line2: text(formData, 'line2', 'Address line 2', 200),
      city,
      region: text(formData, 'region', 'State or region', 120),
      postalCode: text(formData, 'postalCode', 'Postal code', 20),
      countryCode,
      isPrimary,
    }
    let savedId = addressId
    if (addressId) {
      const response = await keystoneClient<{ updateAddress: { id: string } | null }>(
        `mutation UpdateAddress($id: ID!, $data: AddressUpdateInput!) { updateAddress(where: { id: $id }, data: $data) { id } }`,
        { id: addressId, data },
      )
      if (!response.success || !response.data.updateAddress) return { ok: false, message: 'Address was not saved. Managing people requires people-management access.', revision }
    } else {
      const response = await keystoneClient<{ createAddress: { id: string } | null }>(
        `mutation CreateAddress($data: AddressCreateInput!) { createAddress(data: $data) { id } }`,
        { data: { ...data, contact: { connect: { id: contactId } } } },
      )
      if (!response.success || !response.data.createAddress) return { ok: false, message: 'Address was not added. Managing people requires people-management access.', revision }
      savedId = response.data.createAddress.id
    }
    if (isPrimary && !(await clearOtherPrimaries('Address', contactId, savedId))) {
      refresh(contactId)
      return { ok: false, message: 'Address saved, but other addresses are still marked primary.', revision }
    }
    refresh(contactId)
    return { ok: true, message: addressId ? 'Address saved.' : 'Address added.', revision }
  } catch (error) {
    return fail(error, revision, 'Address was not saved.')
  }
}

export async function setPrimaryAddress(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const contactId = id(formData, 'contactId')
    const addressId = id(formData, 'addressId')
    const response = await keystoneClient<{ updateAddress: { id: string } | null }>(
      `mutation PrimaryAddress($id: ID!) { updateAddress(where: { id: $id }, data: { isPrimary: true }) { id } }`,
      { id: addressId },
    )
    if (!response.success || !response.data.updateAddress) return { ok: false, message: 'Primary address was not changed.', revision }
    const cleared = await clearOtherPrimaries('Address', contactId, addressId)
    refresh(contactId)
    return cleared ? { ok: true, message: 'Primary address changed.', revision } : { ok: false, message: 'Other addresses are still marked primary.', revision }
  } catch (error) {
    return fail(error, revision, 'Primary address was not changed.')
  }
}

/** Address and ContactMethod records cannot be deleted; removing one detaches it from the contact. */
export async function removeAddress(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const contactId = id(formData, 'contactId')
    const addressId = id(formData, 'addressId')
    const response = await keystoneClient<{ updateAddress: { id: string } | null }>(
      `mutation RemoveAddress($id: ID!) { updateAddress(where: { id: $id }, data: { isPrimary: false, contact: { disconnect: true } }) { id } }`,
      { id: addressId },
    )
    if (!response.success || !response.data.updateAddress) return { ok: false, message: 'Address was not removed. Managing people requires people-management access.', revision }
    refresh(contactId)
    return { ok: true, message: 'Address removed.', revision }
  } catch (error) {
    return fail(error, revision, 'Address was not removed.')
  }
}

export async function addContactMethod(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const contactId = id(formData, 'contactId')
    const methodType = String(formData.get('methodType') ?? '')
    if (!(METHOD_TYPES as readonly string[]).includes(methodType)) throw new InputError('Choose a method type.')
    const value = text(formData, 'value', 'Value', 320)
    if (!value) throw new InputError('Enter the email, number or address.')
    if (methodType === 'email' && !EMAIL.test(value)) throw new InputError('Enter a valid email address.')
    if (methodType === 'phone' && !PHONE.test(value)) throw new InputError('Enter a valid phone number.')
    const isPrimary = formData.get('isPrimary') === 'on'
    const response = await keystoneClient<{ createContactMethod: { id: string } | null }>(
      `mutation AddContactMethod($data: ContactMethodCreateInput!) { createContactMethod(data: $data) { id } }`,
      {
        data: {
          methodType,
          value: methodType === 'email' ? value.toLowerCase() : value,
          label: text(formData, 'label', 'Label', 80),
          isPrimary,
          canContact: formData.get('canContact') === 'on',
          contact: { connect: { id: contactId } },
        },
      },
    )
    if (!response.success || !response.data.createContactMethod) return { ok: false, message: 'Contact method was not added. Managing people requires people-management access.', revision }
    if (isPrimary && !(await clearOtherPrimaries('ContactMethod', contactId, response.data.createContactMethod.id))) {
      refresh(contactId)
      return { ok: false, message: 'Method added, but other methods are still marked primary.', revision }
    }
    refresh(contactId)
    return { ok: true, message: 'Contact method added.', revision }
  } catch (error) {
    return fail(error, revision, 'Contact method was not added.')
  }
}

/** One change per submit: make primary, allow or stop contact, or remove (detach). */
export async function changeContactMethod(previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const revision = previous.revision + 1
  try {
    const contactId = id(formData, 'contactId')
    const methodId = id(formData, 'methodId')
    const change = String(formData.get('change') ?? '')
    const data =
      change === 'primary' ? { isPrimary: true }
      : change === 'allow' ? { canContact: true }
      : change === 'stop' ? { canContact: false }
      : change === 'remove' ? { isPrimary: false, contact: { disconnect: true } }
      : null
    if (!data) throw new InputError('Choose a change.')
    const response = await keystoneClient<{ updateContactMethod: { id: string } | null }>(
      `mutation ChangeContactMethod($id: ID!, $data: ContactMethodUpdateInput!) { updateContactMethod(where: { id: $id }, data: $data) { id } }`,
      { id: methodId, data },
    )
    if (!response.success || !response.data.updateContactMethod) return { ok: false, message: 'Contact method was not changed. Managing people requires people-management access.', revision }
    if (change === 'primary' && !(await clearOtherPrimaries('ContactMethod', contactId, methodId))) {
      refresh(contactId)
      return { ok: false, message: 'Other methods are still marked primary.', revision }
    }
    refresh(contactId)
    const messages: Record<string, string> = { primary: 'Primary method changed.', allow: 'Contact allowed.', stop: 'Do not contact set.', remove: 'Contact method removed.' }
    return { ok: true, message: messages[change], revision }
  } catch (error) {
    return fail(error, revision, 'Contact method was not changed.')
  }
}
