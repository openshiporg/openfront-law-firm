'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { PermissionKey } from '@/features/keystone/access'

import { ROLE_PERMISSION_KEYS, type RoleActionState } from '../lib/rolePermissions'

const ADMIN_KEYS: PermissionKey[] = ['canAccessDashboard', 'canManagePeople', 'canManageRoles', 'canManageFirm']

class InputError extends Error {}

function grantedFrom(formData: FormData) {
  const values = formData.getAll('permission').map(String)
  const granted = ROLE_PERMISSION_KEYS.filter((key) => values.includes(key))
  if (values.some((value) => !ROLE_PERMISSION_KEYS.includes(value as PermissionKey))) throw new InputError('Unknown permission.')
  return granted
}

function reasonFrom(formData: FormData) {
  const reason = String(formData.get('reason') ?? '').trim()
  if (reason.length < 3) throw new InputError('Enter a reason (at least 3 characters).')
  if (reason.length > 2000) throw new InputError('Reason must be 2000 characters or fewer.')
  return reason
}

function fail(error: unknown, revision: number, fallback: string): RoleActionState {
  return { ok: false, message: error instanceof InputError ? error.message : fallback, revision }
}

type RoleState = { id: string; name: string; status: string } & Partial<Record<PermissionKey, boolean | null>>

/** Mirrors updateFirmRoleAuthority's rules so a refusal explains itself: a real change,
 * the acting administrator keeps role and people management, and another active
 * administrator remains when an administrative role loses that authority. */
async function precheck(roleId: string, granted: PermissionKey[], nextStatus: 'active' | 'archived') {
  const current = await keystoneClient<{ role: RoleState | null; authenticatedItem: { id: string } | null }>(`
    query RoleBeforeChange($id: ID!) {
      role(where: { id: $id }) { id name status ${ROLE_PERMISSION_KEYS.join(' ')} }
      authenticatedItem { ... on User { id } }
    }
  `, { id: roleId })
  if (!current.success) throw new InputError('Role could not be loaded. Role management access is required.')
  const role = current.data.role
  if (!role) throw new InputError('Role is unavailable in the active firm.')
  const next = new Set(granted)
  const changed = ROLE_PERMISSION_KEYS.some((key) => Boolean(role[key]) !== next.has(key))
  if (!changed && role.status === nextStatus) throw new InputError('Nothing changed.')

  const userId = current.data.authenticatedItem?.id
  if (userId) {
    const own = await keystoneClient<{ firmMemberships: Array<{ role: { id: string } | null }> }>(`
      query ActorRole($userId: ID!) { firmMemberships(where: { user: { id: { equals: $userId } }, status: { equals: active } }, take: 1) { role { id } } }
    `, { userId })
    const ownRoleId = own.success ? own.data.firmMemberships?.[0]?.role?.id : null
    if (ownRoleId === roleId && (nextStatus !== 'active' || !next.has('canManageRoles') || !next.has('canManagePeople'))) {
      throw new InputError('You cannot archive your own role or remove role or people management from it.')
    }
  }

  const wasAdmin = role.status === 'active' && ADMIN_KEYS.every((key) => role[key] === true)
  const staysAdmin = nextStatus === 'active' && ADMIN_KEYS.every((key) => next.has(key))
  if (wasAdmin && !staysAdmin) {
    const others = await keystoneClient<{ firmMembershipsCount: number }>(`
      query OtherAdministrators($roleId: ID!) {
        firmMembershipsCount(where: {
          status: { equals: active }
          role: { id: { not: { equals: $roleId } }, status: { equals: active }, canAccessDashboard: { equals: true }, canManagePeople: { equals: true }, canManageRoles: { equals: true }, canManageFirm: { equals: true } }
        })
      }
    `, { roleId })
    if (others.success && others.data.firmMembershipsCount === 0) {
      throw new InputError('The firm must keep another active administrator before this role loses administrator access.')
    }
  }
}

async function runAuthority(roleId: string, granted: PermissionKey[], status: 'active' | 'archived', reason: string) {
  return keystoneClient<{ updateFirmRoleAuthority: { roleId: string; status: string; affectedMemberships: number } }>(`
    mutation UpdateFirmRoleAuthority($roleId: ID!, $grantedPermissions: [String!]!, $status: String, $reason: String!) {
      updateFirmRoleAuthority(roleId: $roleId, grantedPermissions: $grantedPermissions, status: $status, reason: $reason) { roleId status affectedMemberships }
    }
  `, { roleId, grantedPermissions: granted, status, reason })
}

export async function saveRolePermissions(previous: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const revision = previous.revision + 1
  try {
    const roleId = String(formData.get('roleId') ?? '').trim()
    if (!roleId) throw new InputError('Role is required.')
    const status = formData.get('status') === 'archived' ? 'archived' : 'active'
    const granted = grantedFrom(formData)
    const reason = reasonFrom(formData)
    await precheck(roleId, granted, status)
    const response = await runAuthority(roleId, granted, status, reason)
    if (!response.success) return { ok: false, message: 'Role was not changed. An interactive session with role management is required.', revision }
    revalidatePath('/dashboard/platform/team')
    const affected = response.data.updateFirmRoleAuthority.affectedMemberships
    return { ok: true, message: `Permissions saved. ${affected} ${affected === 1 ? 'membership uses' : 'memberships use'} this role.`, revision }
  } catch (error) {
    return fail(error, revision, 'Role was not changed.')
  }
}

/** Archives or restores a role, keeping its current permissions. */
export async function setRoleStatus(previous: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const revision = previous.revision + 1
  try {
    const roleId = String(formData.get('roleId') ?? '').trim()
    if (!roleId) throw new InputError('Role is required.')
    const status = formData.get('status') === 'archived' ? 'archived' : 'active'
    const granted = grantedFrom(formData)
    const reason = reasonFrom(formData)
    await precheck(roleId, granted, status)
    const response = await runAuthority(roleId, granted, status, reason)
    if (!response.success) return { ok: false, message: status === 'archived' ? 'Role was not archived.' : 'Role was not restored.', revision }
    revalidatePath('/dashboard/platform/team')
    return { ok: true, message: status === 'archived' ? 'Role archived.' : 'Role restored.', revision }
  } catch (error) {
    return fail(error, revision, 'Role was not changed.')
  }
}

export async function createRole(previous: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const revision = previous.revision + 1
  try {
    const name = String(formData.get('name') ?? '').trim()
    if (!name) throw new InputError('Name is required.')
    if (name.length > 80) throw new InputError('Name must be 80 characters or fewer.')
    const granted = new Set(grantedFrom(formData))
    const existing = await keystoneClient<{ roles: Array<{ name: string }> }>(`query RoleNames { roles(take: 500) { name } }`)
    if (!existing.success) throw new InputError('Roles could not be loaded. Role management access is required.')
    if (existing.data.roles.some((role) => role.name.trim().toLowerCase() === name.toLowerCase())) throw new InputError(`A role named ${name} already exists.`)
    const data = { name, status: 'active', ...Object.fromEntries(ROLE_PERMISSION_KEYS.map((key) => [key, granted.has(key)])) }
    const response = await keystoneClient<{ createRole: { id: string } | null }>(
      `mutation CreateRole($data: RoleCreateInput!) { createRole(data: $data) { id } }`,
      { data },
    )
    if (!response.success || !response.data.createRole) return { ok: false, message: 'Role was not created. Role management access is required.', revision }
    revalidatePath('/dashboard/platform/team')
    return { ok: true, message: `Role ${name} created.`, revision }
  } catch (error) {
    return fail(error, revision, 'Role was not created.')
  }
}
