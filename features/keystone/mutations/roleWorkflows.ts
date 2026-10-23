import type { Context } from '.keystone/types'

import { activeFirmId, isInteractiveHumanSession, permissionKeys, permissions, type PermissionKey, type Session } from '../access'
import { sha256Digest } from '../lib/digests'
import { runSerializableTransaction } from '../lib/transactions'
import { assertCurrentCommandActor } from './command-authority'
import { recordAuditEvent } from './workflow-helpers'

/** Standard least-privilege firm roles, seeded at onboarding and offered on People &
 * access for existing firms. None can manage people, roles, firm settings, integrations,
 * machine credentials, retention or audit; those stay with the firm administrator.
 * canManageBilling is included where staff record their own time and expenses. */
export const standardFirmRoles = [
  {
    name: "Attorney",
    permissions: [
      "canAccessDashboard", "canReadPeople",
      "canReadIntake", "canManageIntake", "canRunConflictChecks", "canResolveConflicts",
      "canReadMatters", "canManageMatters",
      "canReadCalendar", "canManageCalendar", "canReadTasks", "canManageTasks",
      "canReadCommunications", "canManageCommunications", "canReadDocuments", "canManageDocuments",
      "canReadBilling", "canManageBilling", "canReadTrust", "canReadPayments",
      "canReadPortal", "canManagePortal",
    ],
  },
  {
    name: "Paralegal",
    permissions: [
      "canAccessDashboard", "canReadPeople",
      "canReadIntake", "canManageIntake", "canRunConflictChecks",
      "canReadMatters",
      "canReadCalendar", "canManageCalendar", "canReadTasks", "canManageTasks",
      "canReadCommunications", "canManageCommunications", "canReadDocuments", "canManageDocuments",
      "canReadBilling", "canManageBilling",
      "canReadPortal",
    ],
  },
  {
    name: "Billing",
    permissions: [
      "canAccessDashboard", "canReadPeople", "canReadMatters",
      "canReadBilling", "canManageBilling", "canReadTrust", "canManageTrust",
      "canReadPayments", "canManagePayments", "canReadPortal",
    ],
  },
  {
    name: "Intake coordinator",
    permissions: [
      "canAccessDashboard", "canReadPeople",
      "canReadIntake", "canManageIntake", "canRunConflictChecks",
      "canReadCalendar", "canManageCalendar", "canReadTasks", "canManageTasks",
      "canReadCommunications", "canManageCommunications",
    ],
  },
] as const satisfies ReadonlyArray<{ name: string; permissions: readonly PermissionKey[] }>;

/** Role create data (all permission keys explicit) for one standard role. */
export function standardRolePermissionData(role: (typeof standardFirmRoles)[number]) {
  const granted = new Set<PermissionKey>(role.permissions);
  return Object.fromEntries(permissionKeys.map((permission) => [permission, granted.has(permission)])) as Record<PermissionKey, boolean>;
}

const administrativePermissions = ['canAccessDashboard', 'canManagePeople', 'canManageRoles', 'canManageFirm'] as const satisfies readonly PermissionKey[]

function grantedPermissions(value: unknown) {
  if (!Array.isArray(value) || value.length > permissionKeys.length) throw new Error('Granted permissions must be a list of role permissions.')
  const granted = new Set<PermissionKey>()
  for (const entry of value) {
    if (typeof entry !== 'string' || !(permissionKeys as readonly string[]).includes(entry)) throw new Error('Granted permissions contain an unknown permission.')
    granted.add(entry as PermissionKey)
  }
  return granted
}

function isAdministrative(role: Partial<Record<PermissionKey, boolean>> & { status: string }) {
  return role.status === 'active' && administrativePermissions.every((permission) => role[permission] === true)
}

/** Changes a firm role's permissions or archives it. Generated Role updates cannot
 * touch these fields, because one edit can disable every membership that uses the
 * role. This command takes the same firm-administrator lock as membership changes
 * and refuses any change that leaves the firm without an active administrator or
 * removes the acting administrator's own role-management authority. */
export async function updateFirmRoleAuthority(
  _root: unknown,
  args: { roleId: string; grantedPermissions: string[]; status?: string | null; reason: string },
  context: Context,
) {
  const session = context.session as Session | undefined
  if (!isInteractiveHumanSession(session) || !permissions.canManageRoles({ session })) {
    throw new Error('Changing role authority requires an interactive role-management session.')
  }
  const firmId = activeFirmId(session)
  if (!firmId) throw new Error('An active firm session is required.')
  const roleId = typeof args.roleId === 'string' ? args.roleId.trim() : ''
  if (!roleId) throw new Error('Role is required.')
  const reason = typeof args.reason === 'string' ? args.reason.trim() : ''
  if (reason.length < 3 || reason.length > 2000) throw new Error('Reason must be between 3 and 2000 characters.')
  const nextStatus = args.status?.trim() || null
  if (nextStatus && !['active', 'archived'].includes(nextStatus)) throw new Error('Role status must be active or archived.')
  const granted = grantedPermissions(args.grantedPermissions)

  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, 'canManageRoles')
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-administrator:${firmId}`}))`
    await tx.$executeRaw`SELECT id FROM "Role" WHERE id = ${roleId} AND firm = ${firmId} FOR UPDATE`
    const role = await tx.role.findFirst({ where: { id: roleId, firmId } })
    if (!role) throw new Error('Role is unavailable in the active firm.')

    const next = {
      status: nextStatus ?? role.status,
      ...Object.fromEntries(permissionKeys.map((permission) => [permission, granted.has(permission)])),
    } as Record<PermissionKey, boolean> & { status: string }
    const changedPermissions = permissionKeys.filter((permission) => Boolean(role[permission]) !== next[permission])
    if (!changedPermissions.length && next.status === role.status) throw new Error('The requested role authority is unchanged.')

    const actorMembership = await tx.firmMembership.findFirst({
      where: { firmId, userId: session.itemId, status: 'active' },
      select: { roleId: true },
    })
    if (actorMembership?.roleId === roleId && (next.status !== 'active' || !next.canManageRoles || !next.canManagePeople)) {
      throw new Error('Administrators cannot remove their own role or people management through their own role.')
    }

    if (isAdministrative(role) && !isAdministrative(next)) {
      const remaining = await tx.firmMembership.count({
        where: {
          firmId,
          status: 'active',
          roleId: { not: roleId },
          role: { firmId, status: 'active', canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true },
          user: { status: 'active', activeFirmId: firmId },
          firm: { status: 'active' },
        },
      })
      if (remaining === 0) throw new Error('The firm must retain another active administrator before this role change.')
    }

    const updated = await tx.role.update({
      where: { id: roleId },
      data: next,
      select: { id: true, name: true, status: true },
    })
    const affectedMemberships = await tx.firmMembership.count({ where: { firmId, roleId, status: { in: ['active', 'invited', 'suspended'] } } })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: session.itemId,
      actorType: 'user',
      eventType: 'staff.role_authority_changed',
      category: 'authorization',
      metadata: {
        roleId,
        previousStatus: role.status,
        nextStatus: updated.status,
        changedPermissions,
        grantedPermissions: permissionKeys.filter((permission) => next[permission]),
        affectedMemberships,
        reasonDigest: sha256Digest(reason),
      },
    })
    return { roleId: updated.id, name: updated.name, status: updated.status, changedPermissions, affectedMemberships }
  })
}
