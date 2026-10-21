import { assertCurrentCommandActor, assertCurrentAgentCredential } from "./command-authority";
import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import {
  activeFirmId,
  permissions,
  type PermissionKey,
} from "../access";
import { authorizeAgentAction, computeAgentApprovalDigest } from "../lib/agent-controls";
import { sha256Digest } from "../lib/digests";
import {
  prismaWithoutGraphQLErrorConversion,
  runSerializableTransaction,
} from "../lib/transactions";

export type RequestAgentActionArgs = {
  data: {
    idempotencyKey: string;
    agentPrincipalId: string;
    grantId: string;
    matterId?: string | null;
    actionType: string;
    requestEnvelope?: unknown;
    contactId?: string | null;
    intakeId?: string | null;
    documentId?: string | null;
    invoiceId?: string | null;
    paymentId?: string | null;
    trustTransactionId?: string | null;
    deadlineId?: string | null;
    taskId?: string | null;
  };
};

export type ReviewAgentActionArgs = {
  actionId: string;
  decision: "approve" | "reject";
  reason?: string | null;
  approvalExpiresAt?: string | null;
};

export const actionPermission: Record<string, PermissionKey> = {
  "matter.read": "canReadMatters",
  "privileged.read": "canReadMatters",
  "task.draft": "canManageTasks",
  "communication.send": "canManageCommunications",
  "document.publish": "canManageDocuments",
  "signature.send": "canManageDocuments",
  "matter.transition": "canManageMatters",
  "conflict.resolve": "canResolveConflicts",
  "invoice.issue": "canManageBilling",
  "billing.write": "canManageBilling",
  "payment.capture": "canManagePayments",
  "payment.refund": "canManagePayments",
  "trust.post": "canManageTrust",
  "retention.dispose": "canManageRetention",
  "access.change": "canManageRoles",
};

function boundedText(value: string | null | undefined, label: string, min: number, max: number) {
  const text = value?.trim();
  if (!text || text.length < min || text.length > max) {
    throw new Error(`${label} must be between ${min} and ${max} characters.`);
  }
  return text;
}

async function assertMatterAccess(prisma: any, firmId: string, matterId: string, userId: string) {
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      firmId,
      AND: [
        {
          OR: [
            { confidentiality: { not: "restricted" } },
            {
              teamMembers: {
                some: { userId, status: "active", canAccessRestricted: true },
              },
            },
          ],
        },
        {
          NOT: {
            ethicalWalls: {
              some: {
                status: "active",
                members: { some: { userId, status: "active", decision: "blocked" } },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (!matter) throw new Error("Matter access is not explicitly granted in the active firm.");
}

const targetDefinitions = [
  ["contactId", "contact", false],
  ["intakeId", "intake", false],
  ["documentId", "document", true],
  ["invoiceId", "invoice", true],
  ["paymentId", "payment", true],
  ["trustTransactionId", "trustTransaction", false],
  ["deadlineId", "deadline", true],
  ["taskId", "legalTask", true],
] as const;

async function assertTargets(
  prisma: any,
  firmId: string,
  matterId: string | null,
  data: RequestAgentActionArgs["data"],
) {
  for (const [inputKey, model, hasMatter] of targetDefinitions) {
    const id = data[inputKey];
    if (!id) continue;
    const item = await prisma[model].findFirst({
      where: { id, firmId },
      select: hasMatter ? { id: true, matterId: true } : { id: true },
    });
    if (!item) throw new Error(`Agent action target ${inputKey} was not found in the active firm.`);
    if (hasMatter && item.matterId && item.matterId !== matterId) {
      throw new Error(`Agent action target ${inputKey} does not belong to the requested matter.`);
    }
  }
}

export { computeAgentApprovalDigest } from "../lib/agent-controls";

function requestEnvelope(value: unknown) {
  if (value === undefined || value === null) return null;
  const serialized = JSON.stringify(value);
  if (serialized.length > 50_000) throw new Error("Agent action request envelope exceeds the size limit.");
  return value;
}

export function computeAgentRequestDigest(data: RequestAgentActionArgs["data"]) {
  const request = Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== "idempotencyKey"),
  );
  return sha256Digest(request);
}

export async function requestAgentAction(
  _root: unknown,
  { data }: RequestAgentActionArgs,
  context: Context,
) {
  const session = context.session as any;
  const firmId = activeFirmId(session);
  const isAgent = session?.authenticationType === "agent";
  if (!firmId || !session?.itemId) {
    throw new Error("You do not have permission to request agent actions.");
  }
  if (isAgent) {
    if (
      session.agentPrincipalId !== data.agentPrincipalId ||
      !session.agentCapabilities?.includes(data.actionType)
    ) {
      throw new Error("The authenticated agent credential does not cover this action.");
    }
  } else if (
    (session.authenticationType && session.authenticationType !== "human") ||
    !permissions.canManageAgents({ session })
  ) {
    throw new Error("You do not have permission to request agent actions.");
  }

  const idempotencyKey = boundedText(data.idempotencyKey, "Idempotency key", 12, 160);
  const requiredPermission = actionPermission[data.actionType];
  if (!requiredPermission) throw new Error("Unsupported agent action type.");
  if (!isAgent && !permissions[requiredPermission]({ session })) {
    throw new Error("You lack the domain permission required for this agent action.");
  }
  const envelope = requestEnvelope(data.requestEnvelope);
  const requestDigest = computeAgentRequestDigest({ ...data, requestEnvelope: envelope });
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const now = new Date();

  const [principal, grant] = await Promise.all([
    prisma.agentPrincipal.findFirst({
      where: { id: data.agentPrincipalId, firmId, status: "active" },
      select: { id: true },
    }),
    prisma.agentGrant.findFirst({
      where: { id: data.grantId, firmId, agentPrincipalId: data.agentPrincipalId },
      select: {
        id: true,
        status: true,
        matterId: true,
        capabilities: true,
        startsAt: true,
        expiresAt: true,
      },
    }),
  ]);
  if (!principal) throw new Error("Active agent principal not found in the active firm.");
  if (!grant) throw new Error("Agent grant not found for the selected principal and firm.");
  if (grant.startsAt && grant.startsAt.getTime() > now.getTime()) throw new Error("Agent grant is not yet active.");

  const capabilities = Array.isArray(grant.capabilities)
    ? grant.capabilities.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const authorization = authorizeAgentAction({
    now,
    activeFirmId: firmId,
    matterId: data.matterId ?? null,
    actionType: data.actionType,
    requestDigest,
    grant: {
      status: grant.status,
      firmId,
      matterId: grant.matterId,
      capabilities,
      expiresAt: grant.expiresAt?.toISOString() ?? null,
    },
  });
  if (!authorization.allowed && !authorization.requiresApproval) {
    throw new Error(authorization.reason ?? "Agent action is not authorized by its grant.");
  }

  if (data.matterId) {
    await assertMatterAccess(prisma, firmId, data.matterId, session.itemId);
  }
  await assertTargets(prisma, firmId, data.matterId ?? null, data);
  const storedIdempotencyKey = `${firmId}:${idempotencyKey}`;
  const status = authorization.requiresApproval ? "awaiting_approval" : "approved";
  const riskLevel = authorization.requiresApproval
    ? (["trust.post", "payment.capture", "payment.refund"].includes(data.actionType)
      ? "financial"
      : data.actionType === "access.change" ? "access_control" : "high")
    : "low";

  return runSerializableTransaction(prisma, async (tx: any) => {
    if (isAgent) await assertCurrentAgentCredential(tx, context, data.actionType);
    else {
      await assertCurrentCommandActor(tx, context, "canManageAgents");
      await assertCurrentCommandActor(tx, context, requiredPermission);
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${storedIdempotencyKey}))`;
    const replay = await tx.agentAction.findUnique({ where: { idempotencyKey: storedIdempotencyKey } });
    if (replay) {
      if (replay.requestDigest !== requestDigest) {
        throw new Error("Idempotency key was already used for a different agent request.");
      }
      return { action: replay, replayed: true };
    }

    const [currentPrincipal, currentGrant] = await Promise.all([
      tx.agentPrincipal.findFirst({
        where: { id: principal.id, firmId, status: "active" },
        select: { id: true },
      }),
      tx.agentGrant.findFirst({
        where: { id: grant.id, firmId, agentPrincipalId: principal.id },
        select: {
          id: true,
          status: true,
          matterId: true,
          capabilities: true,
          startsAt: true,
          expiresAt: true,
        },
      }),
    ]);
    if (!currentPrincipal || !currentGrant || (currentGrant.startsAt && currentGrant.startsAt > now)) {
      throw new Error("The agent principal or grant is no longer active.");
    }
    const currentCapabilities = Array.isArray(currentGrant.capabilities)
      ? currentGrant.capabilities.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const currentAuthorization = authorizeAgentAction({
      now,
      activeFirmId: firmId,
      matterId: data.matterId ?? null,
      actionType: data.actionType,
      requestDigest,
      grant: {
        status: currentGrant.status,
        firmId,
        matterId: currentGrant.matterId,
        capabilities: currentCapabilities,
        expiresAt: currentGrant.expiresAt?.toISOString() ?? null,
      },
    });
    if (!currentAuthorization.allowed && !currentAuthorization.requiresApproval) {
      throw new Error(currentAuthorization.reason ?? "The agent grant is no longer valid for this request.");
    }

    const action = await tx.agentAction.create({
      data: {
        firmId,
        matterId: data.matterId ?? null,
        agentPrincipalId: principal.id,
        grantId: grant.id,
        actionNumber: `AGENT-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        idempotencyKey: storedIdempotencyKey,
        actionType: data.actionType,
        status,
        riskLevel,
        requestDigest,
        requestEnvelope: envelope,
        requiresApproval: authorization.requiresApproval,
        requestedByUserId: isAgent ? null : session.itemId,
        contactId: data.contactId ?? null,
        intakeId: data.intakeId ?? null,
        documentId: data.documentId ?? null,
        invoiceId: data.invoiceId ?? null,
        paymentId: data.paymentId ?? null,
        trustTransactionId: data.trustTransactionId ?? null,
        deadlineId: data.deadlineId ?? null,
        taskId: data.taskId ?? null,
      },
    });
    await tx.agentActionEvent.create({
      data: {
        firmId,
        matterId: data.matterId ?? null,
        actionId: action.id,
        eventType: authorization.requiresApproval ? "agent_action.awaiting_approval" : "agent_action.auto_approved",
        fromStatus: "requested",
        toStatus: status,
        actorUserId: isAgent ? null : session.itemId,
        actorAgentId: isAgent ? principal.id : null,
        reason: authorization.requiresApproval ? "Human approval required by action policy." : "Low-risk action authorized by active grant.",
        occurredAt: now,
        metadata: { actionType: data.actionType, requestDigest },
      },
    });
    return { action, replayed: false };
  });
}

export async function reviewAgentAction(
  _root: unknown,
  args: ReviewAgentActionArgs,
  context: Context,
) {
  const session = context.session as any;
  const firmId = activeFirmId(session);
  if (
    !firmId ||
    !session?.itemId ||
    (session.authenticationType && session.authenticationType !== "human") ||
    !permissions.canApproveAgentActions({ session })
  ) {
    throw new Error("You do not have permission to review agent actions.");
  }
  if (!(["approve", "reject"] as const).includes(args.decision)) {
    throw new Error("Decision must be approve or reject.");
  }
  const reason = boundedText(args.reason, "Review reason", 3, 2000);

  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const action = await prisma.agentAction.findFirst({
    where: { id: args.actionId, firmId },
    select: {
      id: true,
      matterId: true,
      actionType: true,
      status: true,
      requestDigest: true,
      agentPrincipalId: true,
      requiresApproval: true,
    },
  });
  if (!action) throw new Error("Agent action not found in the active firm.");
  const isReplay = action.status === "approved" || action.status === "rejected";
  if (!isReplay && (action.status !== "awaiting_approval" || !action.requiresApproval)) {
    throw new Error("Agent action is not awaiting human approval.");
  }
  const requiredPermission = actionPermission[action.actionType];
  if (!requiredPermission || !permissions[requiredPermission]({ session })) {
    throw new Error("The reviewer lacks the required domain permission for this action.");
  }
  if (action.matterId) await assertMatterAccess(prisma, firmId, action.matterId, session.itemId);

  const now = new Date();
  let approvalExpiresAt: Date | null = null;
  if (args.decision === "approve") {
    approvalExpiresAt = args.approvalExpiresAt
      ? new Date(args.approvalExpiresAt)
      : new Date(now.getTime() + 15 * 60_000);
    if (
      Number.isNaN(approvalExpiresAt.getTime()) ||
      approvalExpiresAt <= now ||
      approvalExpiresAt.getTime() > now.getTime() + 24 * 60 * 60_000
    ) {
      throw new Error("Approval expiration must be in the next 24 hours.");
    }
  }

  const approvalDigest = args.decision === "approve"
    ? computeAgentApprovalDigest({
        actionId: action.id,
        actionType: action.actionType,
        matterId: action.matterId,
        requestDigest: action.requestDigest,
        approvalExpiresAt: approvalExpiresAt!,
      })
    : "";

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    await assertCurrentCommandActor(tx, context, requiredPermission);
    if (action.matterId) await assertMatterAccess(tx, firmId, action.matterId, session.itemId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${action.id}))`;
    const current = await tx.agentAction.findUnique({ where: { id: action.id } });
    if (current.status === "approved" || current.status === "rejected") {
      if (current.status !== (args.decision === "approve" ? "approved" : "rejected")) throw new Error("The action already has a different review decision.");
      return { action: current, replayed: true };
    }
    if (current.status !== "awaiting_approval") {
      throw new Error("Agent action is no longer awaiting approval.");
    }

    const [currentPrincipal, currentGrant] = await Promise.all([
      tx.agentPrincipal.findFirst({
        where: { id: current.agentPrincipalId, firmId, status: "active" },
        select: { id: true },
      }),
      tx.agentGrant.findFirst({
        where: {
          id: current.grantId,
          firmId,
          agentPrincipalId: current.agentPrincipalId,
        },
        select: {
          status: true,
          matterId: true,
          capabilities: true,
          startsAt: true,
          expiresAt: true,
        },
      }),
    ]);
    if (!currentPrincipal || !currentGrant || (currentGrant.startsAt && currentGrant.startsAt > now)) {
      throw new Error("The agent principal or grant is no longer active.");
    }
    const currentCapabilities = Array.isArray(currentGrant.capabilities)
      ? currentGrant.capabilities.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const currentAuthorization = authorizeAgentAction({
      now,
      activeFirmId: firmId,
      matterId: current.matterId,
      actionType: current.actionType,
      requestDigest: current.requestDigest,
      grant: {
        status: currentGrant.status,
        firmId,
        matterId: currentGrant.matterId,
        capabilities: currentCapabilities,
        expiresAt: currentGrant.expiresAt?.toISOString() ?? null,
      },
    });
    if (!currentAuthorization.allowed && !currentAuthorization.requiresApproval) {
      throw new Error(currentAuthorization.reason ?? "The agent grant is no longer valid for this request.");
    }

    const nextStatus = args.decision === "approve" ? "approved" : "rejected";
    const reviewed = await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: nextStatus,
        approvedById: args.decision === "approve" ? session.itemId : null,
        approvalDigest,
        approvalExpiresAt,
        reviewedAt: now,
        rejectionReason: args.decision === "reject" ? reason : "",
      },
    });
    await tx.agentActionEvent.create({
      data: {
        firmId,
        matterId: action.matterId,
        actionId: action.id,
        eventType: `agent_action.${nextStatus}`,
        fromStatus: "awaiting_approval",
        toStatus: nextStatus,
        actorUserId: session.itemId,
        reason,
        occurredAt: now,
        metadata: {
          actionType: action.actionType,
          requestDigest: action.requestDigest,
          approvalDigest: approvalDigest || null,
          approvalExpiresAt: approvalExpiresAt?.toISOString() ?? null,
        },
      },
    });
    return { action: reviewed, replayed: false };
  });
}
