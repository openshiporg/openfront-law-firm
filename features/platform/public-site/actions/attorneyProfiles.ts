'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { PublicSiteState } from './publicSite'

export type AttorneyProfileRow = {
  id: string
  name: string
  slug: string | null
  title: string | null
  focus: string | null
  biography: string | null
  admissions: string | null
  email: string | null
  isPublic: boolean
  sortOrder: number | null
  practiceAreas: Array<{ id: string; name: string }>
}

export type AttorneyProfileSetup = { status: 'loaded'; profiles: AttorneyProfileRow[] } | { status: 'error' }

export async function getAttorneyProfileSetup(): Promise<AttorneyProfileSetup> {
  const response = await keystoneClient<{ attorneyProfiles: AttorneyProfileRow[] }>(`
    query AttorneyProfiles { attorneyProfiles(take: 100, orderBy: [{ sortOrder: asc }, { name: asc }]) { id name slug title focus biography admissions email isPublic sortOrder practiceAreas { id name } } }
  `)
  return response.success ? { status: 'loaded', profiles: response.data.attorneyProfiles ?? [] } : { status: 'error' }
}

function field(formData: FormData, key: string, max: number) {
  const value = String(formData.get(key) ?? '').trim()
  if (value.length > max) throw new Error(`${key} must be ${max} characters or fewer.`)
  return value
}

export async function saveAttorneyProfile(previous: PublicSiteState, formData: FormData): Promise<PublicSiteState> {
  const revision = previous.revision + 1
  try {
    const id = String(formData.get('id') ?? '').trim()
    const name = field(formData, 'name', 200)
    if (!name) return { ok: false, message: 'Name is required.', revision }
    const slug = field(formData, 'slug', 80).toLowerCase()
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, message: 'Web address may use lowercase letters, numbers and single hyphens.', revision }
    const email = field(formData, 'email', 320)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Enter a valid email address.', revision }
    const sortOrder = Number(formData.get('sortOrder') || 0)
    const areaIds = formData.getAll('practiceAreaIds').map(String).filter(Boolean)
    const data: Record<string, unknown> = {
      name,
      title: field(formData, 'title', 120),
      focus: field(formData, 'focus', 200),
      biography: field(formData, 'biography', 8000),
      admissions: field(formData, 'admissions', 2000),
      email,
      isPublic: formData.get('isPublic') === 'on',
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      practiceAreas: id ? { set: areaIds.map((areaId) => ({ id: areaId })) } : { connect: areaIds.map((areaId) => ({ id: areaId })) },
      ...(slug ? { slug } : {}),
    }
    const response = id
      ? await keystoneClient<{ updateAttorneyProfile: { id: string } | null }>(`mutation SaveProfile($id: ID!, $data: AttorneyProfileUpdateInput!) { updateAttorneyProfile(where: { id: $id }, data: $data) { id } }`, { id, data })
      : await keystoneClient<{ createAttorneyProfile: { id: string } | null }>(`mutation CreateProfile($data: AttorneyProfileCreateInput!) { createAttorneyProfile(data: $data) { id } }`, { data })
    if (!response.success) return { ok: false, message: 'Profile was not saved. The web address may already be in use, or firm management permission is required.', revision }
    revalidatePath('/dashboard/platform/public-site')
    revalidatePath('/attorneys', 'layout')
    return { ok: true, message: id ? 'Profile saved.' : 'Profile added.', revision }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Profile was not saved.', revision }
  }
}
