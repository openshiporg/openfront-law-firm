import { randomBytes } from 'node:crypto'
import { assertCurrentCommandActor } from './command-authority'

import type { Context } from '.keystone/types'

import { activeFirmId, isInteractiveHumanSession, permissions } from '../access'
import { sha256Digest } from '../lib/digests'
import { assertLifecycleTransition } from '../lib/lifecycles'
import { runSerializableTransaction } from '../lib/transactions'
import { recordAuditEvent } from './workflow-helpers'

function requireString(value: unknown, label: string, maximum: number) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > maximum) throw new Error(`${label} is required and must be ${maximum} characters or fewer.`)
  return text
}

function normalizeEmail(value: unknown) {
  const email = requireString(value, 'Staff email', 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Staff email must be valid.')
  return email
}

const invitationIdentitySelect = {
  id: true,
  status: true,
  bootstrapKey: true,
  bootstrapRoleId: true,
  passwordResetRedeemedAt: true,
  _count: { select: { firmMemberships: true } },
} as const

function isUnclaimedInvitationIdentity(user: {
  status: string
  bootstrapKey: string | null
  bootstrapRoleId: string | null
  passwordResetRedeemedAt: Date | null
  _count: { firmMemberships: number }
}) {
  return user.status === 'invited' &&
    !user.bootstrapKey &&
    !user.bootstrapRoleId &&
    !user.passwordResetRedeemedAt &&
    user._count.firmMemberships === 0
}

function boundedReason(value: unknown) {
  const reason = requireString(value, 'Reason', 2000)
  if (reason.length < 3) throw new Error('Reason must be at least 3 characters.')
  return reason
}

export async function inviteFirmMember(
  _root: unknown,
  args: {
    name: string
    email: string
    roleId: string
    officeId?: string | null
  },
  context: Context,
) {
  if (
    !isInteractiveHumanSession(context.session as any) ||
    !permissions.canManagePeople({ session: context.session as any }) ||
    !permissions.canManageRoles({ session: context.session as any })
  ) {
    throw new Error('Managing staff invitations requires people- and role-management permission.')
  }
  const firmId = activeFirmId(context.session as any)
  const actorUserId = context.session?.itemId
  if (!firmId || !actorUserId) throw new Error('An active firm session is required.')

  const name = requireString(args.name, 'Staff name', 200)
  const email = normalizeEmail(args.email)
  const roleId = requireString(args.roleId, 'Role', 200)
  const officeId = args.officeId ? requireString(args.officeId, 'Office', 200) : null
  const prisma = context.prisma as any

  const [role, office, existing] = await Promise.all([
    prisma.role.findFirst({ where: { id: roleId, firmId, status: 'active' }, select: { id: true, name: true } }),
    officeId
      ? prisma.office.findFirst({ where: { id: officeId, firmId, status: 'active' }, select: { id: true } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { email }, select: invitationIdentitySelect }),
  ])
  if (!role) throw new Error('The selected active role is unavailable in this firm.')
  if (officeId && !office) throw new Error('The selected active office is unavailable in this firm.')
  // No durable originating invitation intent exists for legacy orphans. Email
  // and an invited/unused shape are NOT proof of this firm's allocation. Keep
  // every existing global identity intact for identity-owned joining/review.
  if (existing) {
    throw new Error('A user with this email already exists. Use account recovery or an administrator-assisted membership review.')
  }

  // The temporary password is never returned or logged. The person receives a
  // single-use Keystone password-reset link and becomes active only when that
  // credential is replaced; User.afterOperation activates the invited membership.
    const created = await context.sudo().db.User.createOne({
      data: { name, email, password: `Of!${randomBytes(30).toString('base64url')}9a`, status: 'invited' },
    }) as { id: string }
    const membership = await runSerializableTransaction(prisma, async (tx: any) => {
      await assertCurrentCommandActor(tx, context, 'canManagePeople')
      await assertCurrentCommandActor(tx, context, 'canManageRoles')
      // Role and office are re-read and share-locked in the same transaction as the
      // membership, so a concurrent archive or closure cannot leave a dead invitation.
      await tx.$executeRaw`SELECT id FROM "Role" WHERE id = ${roleId} AND firm = ${firmId} FOR SHARE`
      const currentRole = await tx.role.findFirst({ where: { id: roleId, firmId, status: 'active' }, select: { id: true } })
      if (!currentRole) throw new Error('The selected active role is unavailable in this firm.')
      if (officeId) {
        await tx.$executeRaw`SELECT id FROM "Office" WHERE id = ${officeId} AND firm = ${firmId} FOR SHARE`
        const currentOffice = await tx.office.findFirst({ where: { id: officeId, firmId, status: 'active' }, select: { id: true } })
        if (!currentOffice) throw new Error('The selected active office is unavailable in this firm.')
      }
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${created.id} FOR UPDATE`
      const identity = await tx.user.findUnique({ where: { id: created.id }, select: invitationIdentitySelect })
      if (!identity || !isUnclaimedInvitationIdentity(identity)) throw new Error('This user already has a firm membership.')
      await tx.user.update({ where: { id: created.id }, data: { activeFirmId: firmId } })
      const result = await tx.firmMembership.create({
        data: {
          firmId,
          userId: created.id,
          roleId,
          primaryOfficeId: officeId,
          status: 'invited',
        },
        select: { id: true, status: true },
      })
      await recordAuditEvent(tx, {
        firmId,
        actorUserId,
        actorType: 'user',
        eventType: 'staff.invitation_issued',
        category: 'authorization',
        metadata: {
          membershipId: result.id,
          invitationDigest: sha256Digest({ email, roleId, officeId, invitedUserId: created.id }),
        },
      })
      return result
    })

    return { membership, userId: created.id, email }
}

export async function changeFirmMemberAccess(
  _root: unknown,
  args: {
    membershipId: string
    roleId?: string | null
    officeId?: string | null
    changeOffice?: boolean | null
    toStatus?: string | null
    reason: string
  },
  context: Context,
) {
  if (!permissions.canManagePeople({ session: context.session as any })) {
    throw new Error('Managing firm membership requires people-management permission.')
  }
  const firmId = activeFirmId(context.session as any)
  const actorUserId = context.session?.itemId
  if (!firmId || !actorUserId) throw new Error('An active firm session is required.')
  const membershipId = requireString(args.membershipId, 'Membership', 200)
  const reason = boundedReason(args.reason)
  const roleId = args.roleId ? requireString(args.roleId, 'Role', 200) : null
  const officeProvided = args.changeOffice === true
  const officeId = args.officeId ? requireString(args.officeId, 'Office', 200) : null
  const toStatus = args.toStatus?.trim() || null
  if (toStatus && !['active', 'suspended', 'ended'].includes(toStatus)) {
    throw new Error('Membership status must be active, suspended, or ended.')
  }
  if (!roleId && !officeProvided && !toStatus) throw new Error('A role, office, or status change is required.')
  if (roleId && !permissions.canManageRoles({ session: context.session as any })) {
    throw new Error('Changing a firm role requires role-management permission.')
  }

  const prisma = context.prisma as any
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, 'canManagePeople')
    if (roleId) await assertCurrentCommandActor(tx, context, 'canManageRoles')
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-membership:${firmId}:${membershipId}`}))`
    const membership = await tx.firmMembership.findFirst({
      where: { id: membershipId, firmId },
      select: {
        id: true,
        userId: true,
        status: true,
        roleId: true,
        primaryOfficeId: true,
        startedAt: true,
        role: { select: { canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true } },
      },
    })
    if (!membership) throw new Error('Firm membership is unavailable in the active firm.')
    const roleChanged = Boolean(roleId && roleId !== membership.roleId)
    const officeChanged = officeProvided && officeId !== membership.primaryOfficeId
    const statusChanged = Boolean(toStatus && toStatus !== membership.status)
    if (!roleChanged && !officeChanged && !statusChanged) throw new Error('The requested membership access is unchanged.')
    if (membership.userId === actorUserId && (roleChanged || statusChanged)) {
      throw new Error('Administrators cannot change their own role or membership status.')
    }

    const role = roleId
      ? await tx.role.findFirst({
          where: { id: roleId, firmId, status: 'active' },
          select: { id: true, canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true },
        })
      : null
    if (roleId && !role) throw new Error('The selected active role is unavailable in this firm.')
    if (officeProvided && officeId) {
      const office = await tx.office.findFirst({ where: { id: officeId, firmId, status: 'active' }, select: { id: true } })
      if (!office) throw new Error('The selected active office is unavailable in this firm.')
    }
    if (statusChanged && toStatus) {
      if (membership.status === 'invited' && toStatus === 'active') {
        throw new Error('Invited membership activates only after the user redeems the password setup link.')
      }
      assertLifecycleTransition('membership', membership.status, toStatus)
    }

    const nextStatus = toStatus ?? membership.status
    const nextRole = role ?? membership.role
    const currentlyAdministrative = membership.status === 'active'
      && membership.role.canAccessDashboard
      && membership.role.canManagePeople
      && membership.role.canManageRoles
      && membership.role.canManageFirm
    const remainsAdministrative = nextStatus === 'active'
      && nextRole.canAccessDashboard
      && nextRole.canManagePeople
      && nextRole.canManageRoles
      && nextRole.canManageFirm
    if (currentlyAdministrative && !remainsAdministrative) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`firm-administrator:${firmId}`}))`
      const otherAdministrators = await tx.firmMembership.count({
        where: {
          firmId,
          id: { not: membershipId },
          status: 'active',
          role: { firmId, status: 'active', canAccessDashboard: true, canManagePeople: true, canManageRoles: true, canManageFirm: true },
          user: { status: 'active', activeFirmId: firmId },
          firm: { status: 'active' },
        },
      })
      if (otherAdministrators === 0) throw new Error('The firm must retain another active administrator before this change.')
    }

    const changed = await tx.firmMembership.update({
      where: { id: membershipId },
      data: {
        ...(roleChanged && roleId ? { roleId } : {}),
        ...(officeChanged ? { primaryOfficeId: officeId } : {}),
        ...(statusChanged && toStatus ? {
          status: toStatus,
          endedAt: toStatus === 'ended' ? new Date() : null,
          startedAt: toStatus === 'active' && !membership.startedAt ? new Date() : undefined,
        } : {}),
      },
      select: {
        id: true,
        status: true,
        role: { select: { id: true, name: true } },
        primaryOffice: { select: { id: true, name: true } },
      },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId,
      actorType: 'user',
      eventType: 'staff.membership_access_changed',
      category: 'authorization',
      metadata: {
        membershipId,
        previousStatus: membership.status,
        nextStatus: changed.status,
        previousRoleId: membership.roleId,
        nextRoleId: changed.role.id,
        previousOfficeId: membership.primaryOfficeId,
        nextOfficeId: changed.primaryOffice?.id ?? null,
        reasonDigest: sha256Digest(reason),
      },
    })
    return changed
  })
}
