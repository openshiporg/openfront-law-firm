import { randomUUID } from "node:crypto";
import { accessibleMatterStorageWhere } from "../lib/matter-access";

import type { Context } from ".keystone/types";

import {
  activeFirmId,
  isInteractiveHumanSession,
  permissions,
  type PermissionKey,
  type Session,
} from "../access";

export function requirePermission(
  context: Context,
  permission: PermissionKey,
  options: { humanOnly?: boolean } = {},
) {
  const session = context.session as Session | undefined;
  const firmId = activeFirmId(session);
  if (
    !session?.itemId ||
    !firmId ||
    (options.humanOnly && !isInteractiveHumanSession(session)) ||
    !permissions[permission]({ session })
  ) {
    throw new Error(`Permission ${permission} is required in an active firm.`);
  }
  return { session, firmId, userId: session.itemId };
}

export function boundedReason(
  value: string | null | undefined,
  label = "Reason",
  minimum = 3,
  maximum = 2000,
) {
  const reason = value?.trim();
  if (!reason || reason.length < minimum || reason.length > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum} characters.`);
  }
  return reason;
}

export function optionalBoundedText(
  value: string | null | undefined,
  label: string,
  maximum = 2000,
) {
  const text = value?.trim() || null;
  if (text && text.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return text;
}

export function workflowActor(context: Context, userId: string) {
  const session = context.session as Session | undefined;
  return {
    actorUserId: userId,
    actorAgentId: session?.agentPrincipalId ?? null,
    actorType: session?.agentPrincipalId
      ? "agent"
      : session?.authenticationType && session.authenticationType !== "human"
        ? session.authenticationType
        : "user",
  };
}

export async function assertMatterAccess(
  prisma: any,
  firmId: string,
  matterId: string,
  userId: string,
) {
  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
      ...accessibleMatterStorageWhere(firmId, userId),
    },
    select: { id: true },
  });
  if (!matter) throw new Error("Matter access is not explicitly granted in the active firm.");
}

export async function assertMatterTeamCapability(
  prisma: any,
  firmId: string,
  matterId: string,
  userId: string,
  capability: "canEdit" | "canBill",
) {
  const grant = await prisma.matterTeamMember.findFirst({
    where: { firmId, matterId, userId, status: "active", [capability]: true },
    select: { id: true },
  });
  if (!grant) {
    throw new Error(capability === "canBill"
      ? "Matter billing authority is not explicitly granted to this team member."
      : "Matter editing authority is not explicitly granted to this team member.");
  }
}

export async function recordAuditEvent(tx: any, data: {
  firmId: string;
  eventType: string;
  category: "authentication" | "authorization" | "legal_workflow" | "financial" | "integration" | "retention" | "agent";
  outcome?: "succeeded" | "denied" | "failed";
  actorUserId?: string | null;
  actorAgentId?: string | null;
  actorType?: string;
  matterId?: string | null;
  contactId?: string | null;
  intakeId?: string | null;
  documentId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  trustTransactionId?: string | null;
  agentActionId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await tx.auditEvent.create({
    data: {
      firmId: data.firmId,
      eventId: randomUUID(),
      eventType: data.eventType,
      category: data.category,
      outcome: data.outcome ?? "succeeded",
      actorUserId: data.actorUserId ?? null,
      actorAgentId: data.actorAgentId ?? null,
      actorType: data.actorType ?? (data.actorAgentId ? "agent" : "user"),
      matterId: data.matterId ?? null,
      contactId: data.contactId ?? null,
      intakeId: data.intakeId ?? null,
      documentId: data.documentId ?? null,
      invoiceId: data.invoiceId ?? null,
      paymentId: data.paymentId ?? null,
      trustTransactionId: data.trustTransactionId ?? null,
      agentActionId: data.agentActionId ?? null,
      occurredAt: new Date(),
      metadata: data.metadata ?? null,
    },
  });
}
