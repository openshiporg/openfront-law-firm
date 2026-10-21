import type { Context } from ".keystone/types";
import { assertCurrentCommandActor, assertCurrentAgentCredential } from "./command-authority";

import { permissions, type Session } from "../access";
import {
  agentExecutionLeaseExpired,
  authorizeAgentAction,
  highRiskAgentActions,
  replaySafeAgentActions,
} from "../lib/agent-controls";
import { sha256Digest } from "../lib/digests";
import { loadActiveHumanSession } from "../lib/machine-auth";
import {
  prismaWithoutGraphQLErrorConversion,
  runSerializableTransaction,
} from "../lib/transactions";
import {
  actionPermission,
  computeAgentApprovalDigest,
} from "./agentActions";
import {
  recordRefundProviderOutcome,
  requestRefund,
  transitionInvoice,
  transitionPayment,
} from "./billingWorkflows";
import {
  finalizeConflictCheck,
  recordConflictDisposition,
  transitionMatter,
} from "./legalWorkflows";
import { postTrustTransaction } from "./postTrustTransaction";
import {
  queueCommunicationMessage,
  transitionDocument,
  transitionSignatureRequest,
} from "./providerWorkflows";
import { disposeRetainedDocument } from "./retentionWorkflows";
import { assertMatterAccess, recordAuditEvent } from "./workflow-helpers";

function envelope(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent action requires an object request envelope.");
  }
  return value as Record<string, any>;
}

function exactTarget(action: any, field: string, value: unknown) {
  const expected = action[field];
  if (expected && value !== expected) throw new Error(`Agent action envelope does not match approved ${field}.`);
}

async function assertActionMatterResource(
  prisma: any,
  action: any,
  model: string,
  id: string,
) {
  if (!id) throw new Error("Agent action resource identifier is required.");
  const item = await prisma[model].findFirst({
    where: {
      id,
      firmId: action.firmId,
      ...(action.matterId ? { matterId: action.matterId } : {}),
    },
    select: { id: true },
  });
  if (!item) throw new Error("Agent action resource does not match the approved firm and matter scope.");
}

function resultSummary(result: any) {
  const candidates = [
    ["matter", "Matter"],
    ["invoice", "Invoice"],
    ["payment", "Payment"],
    ["refund", "Refund"],
    ["transaction", "TrustTransaction"],
    ["document", "Document"],
    ["request", "SignatureRequest"],
    ["check", "ConflictCheck"],
    ["action", "RetentionAction"],
    ["allocation", "PaymentAllocation"],
  ] as const;
  for (const [key, type] of candidates) {
    if (result?.[key]?.id) return { resourceType: type, resourceId: result[key].id, replayed: Boolean(result.replayed) };
  }
  if (result?.id) return { resourceType: "Record", resourceId: result.id, replayed: false };
  return { resourceType: "Operation", resourceId: null, replayed: Boolean(result?.replayed) };
}

async function recordAgentActionSucceeded(
  tx: any,
  action: any,
  summary: { resourceType: string; resourceId: string | null; replayed: boolean },
  agentPrincipalId?: string,
) {
  const now = new Date();
  const resultDigest = sha256Digest(summary);
  const updated = await tx.agentAction.updateMany({
    where: { id: action.id, status: "executing", startedAt: action.startedAt },
    data: { status: "succeeded", completedAt: now, resultDigest, resultEnvelope: summary },
  });
  if (updated.count !== 1) throw new Error("Agent action is no longer executing.");
  await tx.agentActionEvent.create({
    data: {
      firmId: action.firmId,
      matterId: action.matterId,
      actionId: action.id,
      eventType: "agent_action.succeeded",
      fromStatus: "executing",
      toStatus: "succeeded",
      actorAgentId: agentPrincipalId,
      occurredAt: now,
      metadata: { resultDigest, ...summary },
    },
  });
  await recordAuditEvent(tx, {
    firmId: action.firmId,
    eventType: "agent.action_succeeded",
    category: "agent",
    actorAgentId: agentPrincipalId,
    matterId: action.matterId,
    agentActionId: action.id,
    metadata: { resultDigest, ...summary },
  });
  return tx.agentAction.findUnique({ where: { id: action.id } });
}

async function dispatchAction(action: any, approvedContext: Context) {
  const data = envelope(action.requestEnvelope);
  if (action.actionType === "task.draft") {
    if (!action.matterId) throw new Error("Task drafting requires an approved matter scope.");
    const title = String(data.title ?? "").trim();
    const description = String(data.description ?? "").trim() || null;
    const dueAt = data.dueAt ? new Date(data.dueAt) : null;
    if (
      !title ||
      title.length > 300 ||
      (description && description.length > 4000) ||
      (dueAt && Number.isNaN(dueAt.getTime()))
    ) {
      throw new Error("Agent task draft title, description, or due date is invalid.");
    }
    const session = approvedContext.session as Session;
    // The task and the action's terminal evidence commit together, so a crash or
    // retry can never leave a drafted task behind an action that is not succeeded.
    return runSerializableTransaction(approvedContext.prisma, async (tx: any) => {
      await assertCurrentCommandActor(tx, approvedContext, "canManageTasks");
      await assertMatterAccess(tx, action.firmId, action.matterId, session.itemId);
      await tx.$executeRaw`SELECT id FROM "AgentAction" WHERE id = ${action.id} FOR UPDATE`;
      const current = await tx.agentAction.findFirst({ where: { id: action.id, status: "executing", startedAt: action.startedAt }, select: { id: true } });
      if (!current) throw new Error("Agent action is no longer executing.");
      const task = await tx.legalTask.create({
        data: {
          firmId: action.firmId,
          matterId: action.matterId,
          title,
          description: description ?? "",
          status: "open",
          priority: new Set(["low", "normal", "high", "urgent"]).has(data.priority) ? data.priority : "normal",
          assignedToId: session.itemId,
          assignedById: session.itemId,
          dueAt,
        },
      });
      const summary = { resourceType: "LegalTask", resourceId: task.id, replayed: false };
      const completedAction = await recordAgentActionSucceeded(tx, action, summary, session.agentPrincipalId);
      return { task, completedAction };
    });
  }
  if (action.actionType === "matter.transition") {
    exactTarget(action, "matterId", data.matterId);
    return transitionMatter(null, {
      matterId: data.matterId,
      toStatus: data.toStatus,
      reason: data.reason,
    }, approvedContext);
  }
  if (action.actionType === "conflict.resolve") {
    await assertActionMatterResource(approvedContext.prisma, action, "conflictCheck", data.checkId);
    if (data.operation === "finalize") {
      return finalizeConflictCheck(null, {
        checkId: data.checkId,
        outcome: data.outcome,
        summary: data.summary,
      }, approvedContext);
    }
    return recordConflictDisposition(null, {
      checkId: data.checkId,
      matchId: data.matchId,
      outcome: data.outcome,
      rationale: data.rationale,
      conditions: data.conditions,
      policyReference: data.policyReference,
    }, approvedContext);
  }
  if (action.actionType === "invoice.issue") {
    exactTarget(action, "invoiceId", data.invoiceId);
    return transitionInvoice(null, {
      invoiceId: data.invoiceId,
      toStatus: "issued",
      dueAt: data.dueAt,
      reason: data.reason,
    }, approvedContext);
  }
  if (action.actionType === "payment.capture") {
    exactTarget(action, "paymentId", data.paymentId);
    return transitionPayment(null, {
      paymentId: data.paymentId,
      toStatus: "captured",
      eventId: `agent-action-${action.id}`,
      providerPaymentId: data.providerPaymentId,
    }, approvedContext);
  }
  if (action.actionType === "payment.refund") {
    exactTarget(action, "paymentId", data.paymentId);
    if (data.operation === "provider_outcome") {
      return recordRefundProviderOutcome(null, {
        refundId: data.refundId,
        toStatus: data.toStatus,
        eventId: `agent-action-${action.id}`,
        providerRefundId: data.providerRefundId,
        failureReason: data.failureReason,
      }, approvedContext);
    }
    return requestRefund(null, {
      paymentId: data.paymentId,
      amountMinor: data.amountMinor,
      reason: data.reason,
      explanation: data.explanation,
      idempotencyKey: `agent-refund-${action.id}`,
    }, approvedContext);
  }
  if (action.actionType === "trust.post") {
    if (action.matterId) {
      const ledgerIds = [...new Set((data.entries ?? []).flatMap((entry: any) => entry.ledgerAccountId ? [entry.ledgerAccountId] : []))];
      if (!ledgerIds.length) throw new Error("Matter-scoped trust actions require an exact client ledger.");
      const count = await (approvedContext.prisma as any).trustLedgerAccount.count({
        where: { id: { in: ledgerIds }, firmId: action.firmId, matterId: action.matterId },
      });
      if (count !== ledgerIds.length) throw new Error("Trust action ledger does not match the approved matter scope.");
    }
    return postTrustTransaction(null, { data: data as any }, approvedContext);
  }
  if (action.actionType === "retention.dispose") {
    exactTarget(action, "documentId", data.documentId);
    return disposeRetainedDocument(null, {
      documentId: data.documentId,
      reason: data.reason,
      confirmation: data.confirmation,
    }, approvedContext);
  }
  if (action.actionType === "communication.send") {
    await assertActionMatterResource(approvedContext.prisma, action, "communicationMessage", data.messageId);
    return queueCommunicationMessage(null, {
      messageId: data.messageId,
      reason: data.reason,
    }, approvedContext);
  }
  if (action.actionType === "document.publish") {
    exactTarget(action, "documentId", data.documentId);
    return transitionDocument(null, {
      documentId: data.documentId,
      toStatus: "active",
      reason: data.reason,
    }, approvedContext);
  }
  if (action.actionType === "signature.send") {
    await assertActionMatterResource(approvedContext.prisma, action, "signatureRequest", data.requestId);
    return transitionSignatureRequest(null, {
      requestId: data.requestId,
      toStatus: "sent",
      providerEventId: `agent-action-${action.id}`,
      actorReference: action.agentPrincipalId,
      evidenceDigest: sha256Digest({ actionId: action.id, requestDigest: action.requestDigest }),
    }, approvedContext);
  }
  throw new Error("This agent action type has no controlled execution adapter.");
}

export async function executeAgentAction(
  _root: unknown,
  args: { actionId: string },
  context: Context,
) {
  const session = context.session as Session | undefined;
  if (
    !session?.itemId ||
    session.authenticationType !== "agent" ||
    !session.agentPrincipalId
  ) {
    throw new Error("An authenticated agent credential is required to execute an action.");
  }
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const claimed = await runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-action:${args.actionId}`}))`;
    let action = await tx.agentAction.findFirst({
      where: { id: args.actionId, agentPrincipalId: session.agentPrincipalId },
      include: { grant: true, agentPrincipal: true },
    });
    if (!action) throw new Error("Agent action was not found for the authenticated principal.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-grant:${action.firmId}:${action.grantId}`}))`;
    action = await tx.agentAction.findFirst({
      where: { id: args.actionId, agentPrincipalId: session.agentPrincipalId },
      include: { grant: true, agentPrincipal: true },
    });
    if (!action) throw new Error("Agent action was not found for the authenticated principal.");
    await assertCurrentAgentCredential(tx, context, action.actionType);
    if (action.status === "succeeded") return { action, replayed: true, reviewerSession: null };
    const now = new Date();
    // A claim whose executor crashed stays "executing". After the lease expires it may
    // be recovered, but only for types whose effect is exactly-once on re-dispatch.
    const recovering = action.status === "executing" &&
      agentExecutionLeaseExpired(action.startedAt, now) &&
      replaySafeAgentActions.has(action.actionType);
    if (action.status === "executing" && !recovering) {
      throw new Error("Agent action is already executing; an unfinished execution can be recovered only after its lease expires, and only for replay-safe actions.");
    }
    if (action.status !== "approved" && !recovering) throw new Error("Agent action is not approved for execution.");
    if (!session.agentCapabilities?.includes(action.actionType)) {
      throw new Error("Agent credential no longer covers this action.");
    }
    if (
      action.agentPrincipal.status !== "active" ||
      action.grant.status !== "active" ||
      (action.grant.startsAt && action.grant.startsAt > now) ||
      (action.grant.expiresAt && action.grant.expiresAt <= now) ||
      !Array.isArray(action.grant.capabilities) ||
      !action.grant.capabilities.includes(action.actionType)
    ) {
      throw new Error("Agent principal or grant is no longer valid for this action.");
    }

    const requiredPermission = actionPermission[action.actionType];
    if (!requiredPermission) throw new Error("Agent action type is unsupported.");
    let reviewerSession: Session | null = null;
    let approval: any = null;
    if (highRiskAgentActions.has(action.actionType)) {
      if (!action.approvedById || !action.approvalExpiresAt || action.approvalExpiresAt <= now) {
        throw new Error("Agent action approval is missing or expired.");
      }
      const expectedDigest = computeAgentApprovalDigest({
        actionId: action.id,
        actionType: action.actionType,
        matterId: action.matterId,
        requestDigest: action.requestDigest,
        approvalExpiresAt: action.approvalExpiresAt,
      });
      if (action.approvalDigest !== expectedDigest) throw new Error("Agent action approval digest is invalid.");
      reviewerSession = await loadActiveHumanSession(tx, action.approvedById, action.firmId);
      if (
        !reviewerSession ||
        !permissions.canApproveAgentActions({ session: reviewerSession }) ||
        !permissions[requiredPermission]({ session: reviewerSession })
      ) {
        throw new Error("The current human approval authority is no longer valid.");
      }
      approval = {
        status: "approved",
        actionType: action.actionType,
        requestDigest: action.requestDigest,
        firmId: action.firmId,
        matterId: action.matterId,
        approverUserId: action.approvedById,
        approverCanApproveAgentActions: true,
        approverHasDomainPermission: true,
        expiresAt: action.approvalExpiresAt.toISOString(),
      };
    } else {
      reviewerSession = await loadActiveHumanSession(tx, action.agentPrincipal.ownerId, action.firmId);
      if (!reviewerSession) throw new Error("Agent owner is no longer an active firm member.");
    }

    const authorization = authorizeAgentAction({
      now,
      activeFirmId: action.firmId,
      matterId: action.matterId,
      actionType: action.actionType,
      requestDigest: action.requestDigest,
      grant: {
        status: action.grant.status,
        firmId: action.firmId,
        matterId: action.grant.matterId,
        capabilities: action.grant.capabilities,
        expiresAt: action.grant.expiresAt?.toISOString() ?? null,
      },
      approval,
    });
    if (!authorization.allowed) throw new Error(authorization.reason ?? "Agent action is not authorized.");

    const claimed = await tx.agentAction.updateMany({
      where: recovering
        ? { id: action.id, status: "executing", startedAt: action.startedAt }
        : { id: action.id, status: "approved" },
      data: { status: "executing", startedAt: now },
    });
    if (claimed.count !== 1) throw new Error("Agent action was claimed by another executor.");
    await tx.agentActionEvent.create({
      data: {
        firmId: action.firmId,
        matterId: action.matterId,
        actionId: action.id,
        eventType: recovering ? "agent_action.execution_recovered" : "agent_action.executing",
        fromStatus: recovering ? "executing" : "approved",
        toStatus: "executing",
        actorAgentId: session.agentPrincipalId,
        occurredAt: now,
        metadata: { requestDigest: action.requestDigest },
      },
    });
    return { action: { ...action, status: "executing", startedAt: now }, replayed: false, reviewerSession };
  });

  if (claimed.replayed) return { action: claimed.action, replayed: true };
  const approvedContext = context.withSession({
    ...claimed.reviewerSession!,
    agentPrincipalId: session.agentPrincipalId,
    agentExecution: { actionId: claimed.action.id, claimStartedAt: claimed.action.startedAt.toISOString(), credentialSession: session },
  } as any);
  let result: any;
  try {
    result = await dispatchAction(claimed.action, approvedContext);
  } catch (error) {
    // The dispatched command threw, so its own transaction rolled back: failure is truthful.
    const message = error instanceof Error ? error.message : "Controlled action execution failed.";
    await runSerializableTransaction(prisma, async (tx: any) => {
      const now = new Date();
      const failed = await tx.agentAction.updateMany({
        where: { id: claimed.action.id, status: "executing", startedAt: claimed.action.startedAt },
        data: {
          status: "failed",
          completedAt: now,
          errorMessage: message.slice(0, 2000),
          resultDigest: sha256Digest({ error: message }),
        },
      });
      if (failed.count !== 1) return;
      await tx.agentActionEvent.create({
        data: {
          firmId: claimed.action.firmId,
          matterId: claimed.action.matterId,
          actionId: claimed.action.id,
          eventType: "agent_action.failed",
          fromStatus: "executing",
          toStatus: "failed",
          actorAgentId: session.agentPrincipalId,
          occurredAt: now,
          reason: message.slice(0, 2000),
        },
      });
    });
    throw new Error("Agent action execution failed; immutable failure evidence was recorded.");
  }

  if (result?.completedAction) return { action: result.completedAction, replayed: false };
  try {
    const completed = await runSerializableTransaction(prisma, (tx: any) =>
      recordAgentActionSucceeded(tx, claimed.action, resultSummary(result), session.agentPrincipalId),
    );
    return { action: completed, replayed: false };
  } catch {
    // The domain effect already committed. Never record it as failed; the action stays
    // executing so a later execution can recover its evidence after the lease expires.
    console.error("Agent action completion evidence could not be recorded", { actionId: claimed.action.id });
    throw new Error("The agent action effect committed, but its completion evidence could not be recorded; it remains executing for recovery.");
  }
}
