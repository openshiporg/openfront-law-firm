import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { PermissionKey } from '@/features/keystone/access'

import { ROLE_PERMISSION_KEYS, type RoleDirectory, type RoleRow } from './rolePermissions'

type RawRole = { id: string; name: string; status: 'active' | 'archived'; memberCount: number | null } & Partial<Record<PermissionKey, boolean | null>>

/** Firm roles with their permission flags and the number of current memberships using each.
 * Viewers without role management see only their own role and cannot edit. */
export async function getRoleDirectory(): Promise<RoleDirectory> {
  const response = await keystoneClient<{
    authenticatedItem: { id: string } | null
    roles: RawRole[]
  }>(`
    query RoleDirectory {
      authenticatedItem { ... on User { id } }
      roles(orderBy: [{ name: asc }, { id: asc }], take: 200) {
        id name status
        memberCount: membershipsCount(where: { status: { in: [active, invited, suspended] } })
        ${ROLE_PERMISSION_KEYS.join(' ')}
      }
    }
  `)
  if (!response.success) return { status: 'error', message: 'Roles could not be loaded.' }
  const userId = response.data.authenticatedItem?.id ?? null

  let ownRoleId: string | null = null
  let canManage = false
  if (userId) {
    const own = await keystoneClient<{ firmMemberships: Array<{ role: { id: string; canManageRoles: boolean | null } | null }> }>(`
      query OwnRole($userId: ID!) {
        firmMemberships(where: { user: { id: { equals: $userId } }, status: { equals: active } }, take: 1) { role { id canManageRoles } }
      }
    `, { userId })
    if (own.success) {
      const role = own.data.firmMemberships?.[0]?.role
      ownRoleId = role?.id ?? null
      // Without a readable membership the command still enforces role management.
      canManage = role ? role.canManageRoles === true : true
    }
  }

  const roles: RoleRow[] = (response.data.roles ?? []).map((role) => ({
    id: role.id,
    name: role.name,
    status: role.status,
    memberCount: role.memberCount ?? 0,
    granted: ROLE_PERMISSION_KEYS.filter((key) => role[key] === true),
  }))
  return { status: 'loaded', roles, canManage, ownRoleId }
}
