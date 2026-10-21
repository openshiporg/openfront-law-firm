import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from ".keystone/types";

import { permissions } from "../access";
import { sha256Digest } from "../lib/digests";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { runSerializableTransaction } from "../lib/transactions";
import { assertMatterAccess, boundedReason, recordAuditEvent, requirePermission } from "./workflow-helpers";
import { AGENT_EXECUTION_LEASE_MS } from "../lib/agent-controls";

const grantCapabilities = new Set([
  "matter.read", "privileged.read", "task.draft", "communication.send",
  "document.publish", "signature.send", "matter.transition", "conflict.resolve",
  "invoice.issue", "billing.write", "payment.capture", "payment.refund", "trust.post",
  "retention.dispose", "access.change",
]);

export async function transitionAgentPrincipal(
  _root: unknown,
  args: { principalId: string; toStatus: "active" | "suspended" | "revoked"; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageAgents", { humanOnly: true });
  const reason = boundedReason(args.reason, "Agent-principal transition reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-principal:${firmId}:${args.principalId}`}))`;
    const principal = await tx.agentPrincipal.findFirst({ where: { id: args.principalId, firmId } });
    if (!principal) throw new Error("Agent principal was not found in the active firm.");
    if (principal.status === args.toStatus) return { principal, replayed: true };
    assertLifecycleTransition("agentPrincipal", principal.status, args.toStatus);
    const updated = await tx.agentPrincipal.update({ where: { id: principal.id }, data: { status: args.toStatus } });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `agent.principal_${args.toStatus}`,
      category: "agent",
      actorUserId: userId,
      metadata: {
        principalId: principal.id,
        fromStatus: principal.status,
        toStatus: args.toStatus,
        identityDigest: sha256Digest({ ownerId: principal.ownerId, agentType: principal.agentType }),
        reasonDigest: sha256Digest(reason),
      },
    });
    return { principal: updated, replayed: false };
  });
}

export async function updateAgentGrantAuthority(
  _root: unknown,
  args: {
    grantId: string;
    toStatus: "active" | "suspended" | "revoked" | "expired";
    capabilities?: string[] | null;
    reason: string;
    startsAt?: string | null;
    expiresAt?: string | null;
  },
  context: Context,
) {
  const { session, firmId, userId } = requirePermission(context, "canManageAgents", { humanOnly: true });
  const reason = boundedReason(args.reason, "Agent grant authority reason", 5, 2000);
  const capabilities = args.capabilities == null ? null : [...new Set(args.capabilities)];
  if (capabilities && (capabilities.length > 30 || capabilities.some((value) => !grantCapabilities.has(value)))) {
    throw new Error("Agent grant capabilities contain an unsupported value.");
  }
  const startsAt = args.startsAt ? new Date(args.startsAt) : null;
  const expiresAt = args.expiresAt ? new Date(args.expiresAt) : null;
  if ((args.startsAt && Number.isNaN(startsAt!.getTime())) || (args.expiresAt && Number.isNaN(expiresAt!.getTime()))) {
    throw new Error("Agent grant authority dates are invalid.");
  }
  if (startsAt && expiresAt && startsAt >= expiresAt) throw new Error("Agent grant expiration must follow its start.");

  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-grant:${firmId}:${args.grantId}`}))`;
    const grant = await tx.agentGrant.findFirst({ where: { id: args.grantId, firmId } });
    if (!grant) throw new Error("Agent grant was not found in the active firm.");
    if (grant.matterId) await assertMatterAccess(tx, firmId, grant.matterId, userId);
    if (new Set(["suspended", "revoked", "expired"]).has(args.toStatus)) {
      // An unexpired claim may still be committing its effect. A claim past its lease is
      // a crashed execution: any late effect re-checks grant status where it commits,
      // so it must not freeze suspension or revocation indefinitely.
      const executingActions = await tx.agentAction.count({
        where: { grantId: grant.id, status: "executing", startedAt: { gt: new Date(Date.now() - AGENT_EXECUTION_LEASE_MS) } },
      });
      if (executingActions) throw new Error("Agent grant authority cannot change while an action is executing.");
    }
    if (grant.status !== args.toStatus) assertLifecycleTransition("agentGrant", grant.status, args.toStatus);

    const finalCapabilities = capabilities ?? grant.capabilities;
    const finalStartsAt = args.startsAt === undefined ? grant.startsAt : startsAt;
    const finalExpiresAt = args.expiresAt === undefined ? grant.expiresAt : expiresAt;
    const authorityChanged =
      JSON.stringify(finalCapabilities) !== JSON.stringify(grant.capabilities) ||
      String(finalStartsAt ?? "") !== String(grant.startsAt ?? "") ||
      String(finalExpiresAt ?? "") !== String(grant.expiresAt ?? "") ||
      grant.status !== args.toStatus;
    const requiresApproval = args.toStatus === "active" && authorityChanged;
    if (requiresApproval && !permissions.canApproveAgentActions({ session })) {
      throw new Error("Activating or renewing agent authority requires agent-approval permission.");
    }
    // Approval authority is re-read and locked here, not taken from the request session.
    if (requiresApproval) await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    const authorityDigest = sha256Digest({
      grantId: grant.id,
      agentPrincipalId: grant.agentPrincipalId,
      matterId: grant.matterId,
      capabilities: finalCapabilities,
      startsAt: finalStartsAt?.toISOString?.() ?? finalStartsAt ?? null,
      expiresAt: finalExpiresAt?.toISOString?.() ?? finalExpiresAt ?? null,
      status: args.toStatus,
      reason,
    });
    const now = new Date();
    const updated = await tx.agentGrant.update({
      where: { id: grant.id },
      data: {
        status: args.toStatus,
        capabilities: finalCapabilities,
        reason,
        startsAt: finalStartsAt,
        expiresAt: finalExpiresAt,
        ...(requiresApproval ? { approvedById: userId, approvedAt: now } : {}),
        ...(args.toStatus === "suspended" ? { suspendedAt: now } : {}),
        ...(args.toStatus === "revoked" ? { revokedAt: now } : {}),
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `agent.grant_${args.toStatus}`,
      category: "agent",
      actorUserId: userId,
      matterId: grant.matterId,
      metadata: {
        grantId: grant.id,
        agentPrincipalId: grant.agentPrincipalId,
        fromStatus: grant.status,
        authorityDigest,
        approvedBy: requiresApproval ? userId : grant.approvedById,
      },
    });
    return { grant: updated, authorityDigest };
  });
}
