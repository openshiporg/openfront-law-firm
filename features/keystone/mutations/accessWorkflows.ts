import { assertCurrentCommandActor, lockCurrentFirmMember } from "./command-authority";
import { permissions } from "../access";
import { accessibleMatterStorageWhere } from "../lib/matter-access";
import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { runSerializableTransaction } from "../lib/transactions";
import {
  assertMatterAccess,
  boundedReason,
  recordAuditEvent,
  requirePermission,
} from "./workflow-helpers";

const teamRoles = new Set([
  "responsible_attorney",
  "attorney",
  "paralegal",
  "assistant",
  "billing",
  "observer",
]);

async function synchronizeMatterBlocks(tx: any, matterId: string, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return new Set<string>();
  const activeBlocks = await tx.ethicalWallMember.findMany({
    where: {
      matterId,
      userId: { in: uniqueUserIds },
      status: "active",
      decision: "blocked",
      wall: { status: "active" },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const blockedUserIds = new Set<string>(activeBlocks.map((member: any) => member.userId));
  await tx.matter.update({
    where: { id: matterId },
    data: {
      blockedUsers: {
        connect: uniqueUserIds.filter((userId) => blockedUserIds.has(userId)).map((id) => ({ id })),
        disconnect: uniqueUserIds.filter((userId) => !blockedUserIds.has(userId)).map((id) => ({ id })),
      },
    },
  });
  return blockedUserIds;
}

export async function setMatterTeamAccess(
  _root: unknown,
  args: {
    matterId: string;
    userId: string;
    teamRole: string;
    status: "active" | "removed";
    canAccessRestricted?: boolean | null;
    canEdit?: boolean | null;
    canBill?: boolean | null;
    reason: string;
  },
  context: Context,
) {
  const { firmId, userId: actorUserId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  if (!teamRoles.has(args.teamRole) || !new Set(["active", "removed"]).has(args.status)) {
    throw new Error("Matter team role or status is invalid.");
  }
  const reason = boundedReason(args.reason, "Matter team access reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-team:${firmId}:${args.matterId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${firmId}:${args.matterId}`}))`;
    await tx.$executeRaw`SELECT id FROM "Matter" WHERE id = ${args.matterId} AND firm = ${firmId} FOR SHARE`;
    const matter = await tx.matter.findFirst({ where: { id: args.matterId, firmId }, select: { id: true, confidentiality: true } });
    if (!matter) throw new Error("Matter was not found in the active firm.");
    await assertMatterAccess(tx, firmId, matter.id, actorUserId);
    const target = await tx.user.findFirst({
      where: {
        id: args.userId,
        status: "active",
        firmMemberships: { some: { firmId, status: "active", role: { status: "active" } } },
      },
      select: { id: true },
    });
    if (!target) throw new Error("Matter team user must be an active member of the selected firm.");
    const existing = await tx.matterTeamMember.findUnique({
      where: { matterId_userId: { matterId: matter.id, userId: target.id } },
    });
    const now = new Date();
    const willGrantRestrictedAccess = args.status === "active" && Boolean(args.canAccessRestricted);
    const currentlyGrantsRestrictedAccess = existing?.status === "active" && existing.canAccessRestricted;
    if (matter.confidentiality === "restricted" && currentlyGrantsRestrictedAccess && !willGrantRestrictedAccess) {
      // A flag count is not recovery authority. Examine exact current identities
      // under the same physical role/member/user locks as revocation writers.
      let viable = false;
      let after: string | undefined;
      for (let page = 0; page < 32 && !viable; page++) {
        const candidates = await tx.matterTeamMember.findMany({
          where: { firmId, matterId: matter.id, status: "active", canAccessRestricted: true, userId: { not: target.id }, ...(after ? { id: { gt: after } } : {}) },
          select: { id: true, userId: true }, orderBy: { id: "asc" }, take: 32,
        });
        for (const candidate of candidates) {
          const current = await lockCurrentFirmMember(tx, candidate.userId, firmId);
          if (!current || !permissions.canReadMatters({ session: current }) || !permissions.canManageMatters({ session: current })) continue;
          viable = Boolean(await tx.matter.findFirst({ where: { id: matter.id, ...accessibleMatterStorageWhere(firmId, candidate.userId) }, select: { id: true } }));
          if (viable) break;
        }
        if (candidates.length < 32) break;
        after = candidates[candidates.length - 1].id;
      }
      if (!viable) throw new Error("A restricted matter must retain a current authorized access steward. Request a reviewed recovery if none is available.");
    }
    const data = {
      firmId,
      matterId: matter.id,
      userId: target.id,
      teamRole: args.teamRole,
      status: args.status,
      canAccessRestricted: args.status === "active" && Boolean(args.canAccessRestricted),
      canEdit: args.status === "active" && Boolean(args.canEdit),
      canBill: args.status === "active" && Boolean(args.canBill),
      removedAt: args.status === "removed" ? now : null,
    };
    const member = existing
      ? await tx.matterTeamMember.update({ where: { id: existing.id }, data })
      : await tx.matterTeamMember.create({ data: { ...data, assignedAt: now } });
    const grantsRestrictedAccess = member.status === "active" && member.canAccessRestricted;
    await tx.matter.update({
      where: { id: matter.id },
      data: {
        authorizedUsers: grantsRestrictedAccess
          ? { connect: { id: target.id } }
          : { disconnect: { id: target.id } },
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: grantsRestrictedAccess ? "matter.team_access_granted" : "matter.team_access_removed",
      category: "authorization",
      actorUserId,
      matterId: matter.id,
      metadata: {
        matterTeamMemberId: member.id,
        targetUserId: target.id,
        teamRole: member.teamRole,
        canAccessRestricted: member.canAccessRestricted,
        canEdit: member.canEdit,
        canBill: member.canBill,
        reasonDigest: sha256Digest(reason),
      },
    });
    return member;
  });
}

export async function setEthicalWallMember(
  _root: unknown,
  args: {
    wallId: string;
    userId: string;
    decision: "allowed" | "blocked";
    status: "active" | "revoked";
    reason: string;
  },
  context: Context,
) {
  const { firmId, userId: actorUserId } = requirePermission(context, "canManageEthicalWalls", { humanOnly: true });
  if (!new Set(["allowed", "blocked"]).has(args.decision) || !new Set(["active", "revoked"]).has(args.status)) {
    throw new Error("Ethical-wall member decision or status is invalid.");
  }
  const reason = boundedReason(args.reason, "Ethical-wall member reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageEthicalWalls");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-member:${firmId}:${args.wallId}:${args.userId}`}))`;
    const wall = await tx.ethicalWall.findFirst({
      where: { id: args.wallId, firmId },
      select: { id: true, matterId: true, status: true },
    });
    if (!wall || wall.status === "lifted") throw new Error("Current ethical wall was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${firmId}:${wall.matterId}`}))`;
    await assertMatterAccess(tx, firmId, wall.matterId, actorUserId);
    const target = await tx.user.findFirst({
      where: {
        id: args.userId,
        status: "active",
        firmMemberships: { some: { firmId, status: "active", role: { status: "active" } } },
      },
      select: { id: true },
    });
    if (!target) throw new Error("Ethical-wall user must be an active member of the selected firm.");
    const existing = await tx.ethicalWallMember.findUnique({
      where: { wallId_userId: { wallId: wall.id, userId: target.id } },
    });
    const now = new Date();
    const data = {
      firmId,
      matterId: wall.matterId,
      wallId: wall.id,
      userId: target.id,
      decision: args.decision,
      status: args.status,
      approvedById: actorUserId,
      reason,
      effectiveAt: now,
      revokedAt: args.status === "revoked" ? now : null,
    };
    const member = existing
      ? await tx.ethicalWallMember.update({ where: { id: existing.id }, data })
      : await tx.ethicalWallMember.create({ data });
    const blockedUserIds = await synchronizeMatterBlocks(tx, wall.matterId, [target.id]);
    const blocked = blockedUserIds.has(target.id);
    await recordAuditEvent(tx, {
      firmId,
      eventType: "ethical_wall.member_access_updated",
      category: "authorization",
      actorUserId,
      matterId: wall.matterId,
      metadata: {
        ethicalWallId: wall.id,
        ethicalWallMemberId: member.id,
        targetUserId: target.id,
        decision: member.decision,
        status: member.status,
        effectiveBlocked: blocked,
        reasonDigest: sha256Digest(reason),
      },
    });
    return member;
  });
}

export async function transitionEthicalWall(
  _root: unknown,
  args: { wallId: string; toStatus: "active" | "lifted"; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageEthicalWalls", { humanOnly: true });
  if (!new Set(["active", "lifted"]).has(args.toStatus)) throw new Error("Ethical-wall status is invalid.");
  const reason = boundedReason(args.reason, "Ethical-wall transition reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageEthicalWalls");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall:${firmId}:${args.wallId}`}))`;
    const wall = await tx.ethicalWall.findFirst({ where: { id: args.wallId, firmId } });
    if (!wall) throw new Error("Ethical wall was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${firmId}:${wall.matterId}`}))`;
    await assertMatterAccess(tx, firmId, wall.matterId, userId);
    if (wall.status === args.toStatus) return { wall, replayed: true };
    assertLifecycleTransition("ethicalWall", wall.status, args.toStatus);
    const members = await tx.ethicalWallMember.findMany({
      where: { wallId: wall.id },
      select: { userId: true, status: true, decision: true },
    });
    const now = new Date();
    const updated = await tx.ethicalWall.update({
      where: { id: wall.id },
      data: {
        status: args.toStatus,
        approvedById: args.toStatus === "active" ? userId : wall.approvedById,
        effectiveAt: args.toStatus === "active" ? now : wall.effectiveAt,
        liftedAt: args.toStatus === "lifted" ? now : null,
      },
    });
    const affectedUserIds = members.map((member: any) => member.userId);
    const blockedUserIds = await synchronizeMatterBlocks(tx, wall.matterId, affectedUserIds);
    await recordAuditEvent(tx, {
      firmId,
      eventType: `ethical_wall.${args.toStatus}`,
      category: "authorization",
      actorUserId: userId,
      matterId: wall.matterId,
      metadata: {
        ethicalWallId: wall.id,
        fromStatus: wall.status,
        blockedUserCount: blockedUserIds.size,
        reasonDigest: sha256Digest(reason),
      },
    });
    return { wall: updated, replayed: false };
  });
}
