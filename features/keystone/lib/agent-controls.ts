import { createHash } from "node:crypto";

export type AgentGrantEvidence = {
  status: "proposed" | "active" | "suspended" | "revoked" | "expired";
  firmId: string;
  matterId?: string | null;
  capabilities: string[];
  expiresAt?: string | null;
};

export type AgentApprovalEvidence = {
  status: "pending" | "approved" | "rejected" | "expired";
  actionType: string;
  requestDigest: string;
  firmId: string;
  matterId?: string | null;
  approverUserId: string;
  approverCanApproveAgentActions: boolean;
  approverHasDomainPermission: boolean;
  expiresAt: string;
};

export type AgentAuthorizationInput = {
  now: Date;
  activeFirmId: string;
  matterId?: string | null;
  actionType: string;
  requestDigest: string;
  grant: AgentGrantEvidence;
  approval?: AgentApprovalEvidence | null;
};

export type AgentAuthorizationResult = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string | null;
};

export const highRiskAgentActions = new Set([
  "privileged.read",
  "communication.send",
  "document.publish",
  "signature.send",
  "matter.transition",
  "conflict.resolve",
  "invoice.issue",
  "billing.write",
  "payment.capture",
  "payment.refund",
  "trust.post",
  "retention.dispose",
  "access.change",
]);

const denied = (
  reason: string,
  requiresApproval = false,
): AgentAuthorizationResult => ({ allowed: false, requiresApproval, reason });

function isExpired(value: string | null | undefined, now: Date) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}

export function authorizeAgentAction(
  input: AgentAuthorizationInput,
): AgentAuthorizationResult {
  const { grant } = input;
  if (grant.firmId !== input.activeFirmId) {
    return denied("Agent grant does not belong to the active firm.");
  }
  if (grant.status !== "active") return denied("Agent grant is not active.");
  if (isExpired(grant.expiresAt, input.now)) return denied("Agent grant has expired.");
  if (input.matterId && grant.matterId !== input.matterId) {
    return denied("Agent grant does not cover the requested matter.");
  }
  if (!grant.capabilities.includes(input.actionType)) {
    return denied("Agent grant does not include the requested capability.");
  }

  const requiresApproval = highRiskAgentActions.has(input.actionType);
  if (!requiresApproval) return { allowed: true, requiresApproval: false, reason: null };

  const { approval } = input;
  if (!approval) {
    return denied("A current human approval is required for this action.", true);
  }
  if (approval.status !== "approved") return denied("Agent action approval is not approved.", true);
  if (approval.firmId !== input.activeFirmId) {
    return denied("Agent action approval does not belong to the active firm.", true);
  }
  if ((approval.matterId ?? null) !== (input.matterId ?? null)) {
    return denied("Agent action approval does not cover the requested matter.", true);
  }
  if (approval.actionType !== input.actionType) {
    return denied("Agent action approval does not match the requested action.", true);
  }
  if (approval.requestDigest !== input.requestDigest) {
    return denied("Agent action approval digest does not match the request digest.", true);
  }
  if (isExpired(approval.expiresAt, input.now)) {
    return denied("Agent action approval has expired.", true);
  }
  if (!approval.approverUserId || !approval.approverCanApproveAgentActions) {
    return denied("A human approver with agent-approval authority is required.", true);
  }
  if (!approval.approverHasDomainPermission) {
    return denied("The human approver lacks the required domain permission.", true);
  }

  return { allowed: true, requiresApproval: true, reason: null };
}

/** Binds a human approval to the exact action, matter, request and expiry. */
export function computeAgentApprovalDigest(input: {
  actionId: string;
  actionType: string;
  matterId: string | null;
  requestDigest: string;
  approvalExpiresAt: Date;
}) {
  return createHash("sha256").update(JSON.stringify({
    actionId: input.actionId,
    actionType: input.actionType,
    matterId: input.matterId,
    requestDigest: input.requestDigest,
    approvalExpiresAt: input.approvalExpiresAt.toISOString(),
  })).digest("hex");
}

/** How long an executing claim is trusted before another executor may recover it. */
export const AGENT_EXECUTION_LEASE_MS = 15 * 60 * 1000;

/** Action types whose effect is exactly-once on re-dispatch: task drafts commit with
 * their terminal evidence, and the others replay through action-derived idempotency
 * keys or same-state replay. Other types are never re-dispatched automatically. */
export const replaySafeAgentActions = new Set([
  "task.draft",
  "matter.transition",
  "payment.capture",
  "payment.refund",
  "trust.post",
  "signature.send",
]);

export function agentExecutionLeaseExpired(startedAt: Date | null | undefined, now: Date) {
  return !startedAt || now.getTime() - startedAt.getTime() >= AGENT_EXECUTION_LEASE_MS;
}
