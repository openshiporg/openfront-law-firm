import { createHash, createHmac } from "node:crypto";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";

import { canonicalJson } from "../lib/digests";
import { decryptSecret, secretDigest } from "../lib/secret-envelope";
import { prismaWithoutGraphQLErrorConversion } from "../lib/transactions";
import { recordAuditEvent } from "../mutations/workflow-helpers";
import { assertWebhookDestination, parseAllowedWebhookHosts, publicOnlyLookup } from "./destination";
import { assertWebhookWireHeaders, assertWebhookWireIdentity } from "./wire-contract";

/**
 * Outbound webhooks are sent on the request that causes them (enqueueWebhookDelivery)
 * and re-sent by a staff "Retry" (retryWebhookDelivery). There is no worker, timer or
 * scheduler: nothing here runs unless a request calls it.
 */
export const WEBHOOK_MAX_ATTEMPTS = 8;
export const WEBHOOK_TIMEOUT_MS = 10_000;
/** A delivery stuck in "processing" longer than this was interrupted; staff may retry it. */
export const WEBHOOK_STALE_PROCESSING_MS = 2 * 60_000;
export const WEBHOOK_MAX_BODY_BYTES = 256 * 1024;
export const WEBHOOK_MAX_RESPONSE_BYTES = 16 * 1024;

export type WebhookRequest = {
  url: URL;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  maxResponseBytes: number;
};
export type WebhookResponse = { status: number; bodyDigest: string; complete?: boolean; errorCode?: string };
export type WebhookTransport = (request: WebhookRequest) => Promise<WebhookResponse>;

export type DeliverOptions = {
  /** Staff retry: allow one more attempt even after the retry budget is used. */
  force?: boolean;
  transport?: WebhookTransport;
  allowedHosts?: Set<string>;
  keyOverride?: string;
  clock?: () => Date;
  actor?: { actorUserId?: string | null; actorAgentId?: string | null; actorType?: string };
};

/** Deterministic across retries, so the request digest identifies the exact payload. */
export function webhookBody(delivery: { eventId: string; eventType: string; createdAt: Date | string; payload?: unknown }) {
  return canonicalJson({
    id: delivery.eventId,
    type: delivery.eventType,
    createdAt: new Date(delivery.createdAt).toISOString(),
    data: delivery.payload ?? null,
  });
}

function bodyDigest(body: string | Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

export function webhookSignature(secret: string, timestamp: number, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** A single digest/settlement, with complete END distinct from aborted/truncated 2xx responses. */
export function collectWebhookResponse(response: IncomingMessage, limit: number): Promise<WebhookResponse> {
  return new Promise(resolve => {
    const hash = createHash("sha256");
    let received = 0;
    let settled = false;
    const finish = (complete: boolean, errorCode?: string) => {
      if (settled) return;
      settled = true;
      resolve({ status: response.statusCode ?? 0, bodyDigest: hash.digest("hex"), complete, errorCode });
    };
    response.on("data", (chunk: Buffer) => {
      if (settled) return;
      const remaining = Math.max(0, limit - received);
      hash.update(chunk.subarray(0, remaining));
      received += chunk.length;
      if (received > limit) { finish(false, "response_byte_limit"); response.destroy(); }
    });
    response.on("end", () => finish(true));
    response.on("aborted", () => finish(false, "response_aborted"));
    response.on("error", () => finish(false, "response_error"));
    response.on("close", () => finish(false, "response_premature_close"));
  });
}

/** No redirects (https.request never follows them), no cookies or app auth, bounded time and bytes. */
export const httpsWebhookTransport: WebhookTransport = (request) => new Promise((resolve, reject) => {
  const outgoing = httpsRequest(request.url, {
    method: "POST",
    headers: { ...request.headers, "content-length": String(Buffer.byteLength(request.body)) },
    lookup: publicOnlyLookup as any,
    timeout: request.timeoutMs,
  }, (response) => {
    void collectWebhookResponse(response, request.maxResponseBytes).then(resolve, reject);
  });
  const deadline = setTimeout(() => outgoing.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })), request.timeoutMs);
  outgoing.on("timeout", () => outgoing.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
  outgoing.on("error", (error) => {
    clearTimeout(deadline);
    reject(error);
  });
  outgoing.on("close", () => clearTimeout(deadline));
  outgoing.end(request.body);
});

function failureCode(error: unknown) {
  const code = (error as { code?: string; message?: string })?.code;
  const message = (error as { message?: string })?.message ?? "";
  if (code === "ETIMEDOUT" || message === "timeout") return "timeout";
  if (code === "EDESTINATIONDENIED" || message.startsWith("destination_")) return "destination_rejected";
  return "network_error";
}

export type DeliverResult = { status: string; outcome: "succeeded" | "failed" | "dead_letter" | "skipped"; reason?: string };

/**
 * Sends one delivery now. Safe to call from two requests at once: the claim is a
 * conditional update, so only one caller sends a given attempt.
 */
export async function deliverWebhook(prismaInput: any, deliveryId: string, options: DeliverOptions = {}): Promise<DeliverResult> {
  const prisma = prismaWithoutGraphQLErrorConversion(prismaInput) as any;
  const clock = options.clock ?? (() => new Date());
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      firm: { select: { status: true } },
      connection: { select: { id: true, status: true, firmId: true } },
      subscription: {
        select: { id: true, status: true, connectionId: true, endpointUrl: true, eventTypes: true, firmId: true, signingSecretEncrypted: true, signingSecretDigest: true },
      },
    },
  });
  if (!delivery) return { status: "missing", outcome: "skipped", reason: "missing" };
  const stale = delivery.status === "processing" && delivery.updatedAt.getTime() + WEBHOOK_STALE_PROCESSING_MS <= clock().getTime();
  if (!["pending", "failed", "dead_letter"].includes(delivery.status) && !stale) {
    return { status: delivery.status, outcome: "skipped", reason: "not_retryable" };
  }
  if (delivery.status === "dead_letter" && !options.force) return { status: delivery.status, outcome: "skipped", reason: "dead_letter" };

  const settle = async (status: "failed" | "dead_letter", reason: string) => {
    const updated = await prisma.webhookDelivery.updateMany({
      where: { id: delivery.id, status: delivery.status, attemptCount: delivery.attemptCount },
      data: { status, lastError: reason, ...(status === "dead_letter" ? { completedAt: clock() } : {}) },
    });
    if (updated.count && status === "dead_letter") {
      await recordAuditEvent(prisma, {
        firmId: delivery.firmId, eventType: "webhook.delivery_dead_lettered", category: "integration", outcome: "failed",
        actorType: "system", matterId: delivery.matterId ?? null, metadata: { deliveryId: delivery.id, reason },
      });
    }
    return { status, outcome: status, reason } as DeliverResult;
  };

  const body = webhookBody(delivery);
  const requestDigest = bodyDigest(body);
  const { connection, subscription } = delivery;
  // Conditions no retry can fix are dead-lettered; fixable ones leave the delivery failed for a staff Retry.
  try { assertWebhookWireIdentity(delivery.eventId, delivery.eventType); }
  catch { return settle("dead_letter", "invalid_wire_identity"); }
  if (connection?.status === "revoked" || connection?.firmId !== delivery.firmId) return settle("dead_letter", "connection_revoked");
  if (!subscription || subscription.firmId !== delivery.firmId || subscription.status === "revoked") return settle("dead_letter", "subscription_revoked");
  if (subscription.connectionId !== delivery.connectionId) return settle("dead_letter", "subscription_moved");
  if (!Array.isArray(subscription.eventTypes) || !subscription.eventTypes.includes(delivery.eventType)) return settle("dead_letter", "event_type_unsubscribed");
  if (delivery.destinationUrl !== subscription.endpointUrl) return settle("dead_letter", "destination_changed");
  if (Buffer.byteLength(body) > WEBHOOK_MAX_BODY_BYTES) return settle("dead_letter", "payload_too_large");
  if (delivery.matterId) {
    const matter = await prisma.matter.findFirst({ where: { id: delivery.matterId, firmId: delivery.firmId }, select: { id: true } });
    if (!matter) return settle("dead_letter", "matter_unavailable");
  }
  const priorAttempts: number = delivery.attemptCount ?? 0;
  if (priorAttempts >= WEBHOOK_MAX_ATTEMPTS && !options.force) return settle("dead_letter", "retries_exhausted");
  if (delivery.firm?.status !== "active") return settle("failed", "firm_inactive");
  if (connection.status !== "active") return settle("failed", "connection_inactive");
  if (subscription.status !== "active") return settle("failed", "subscription_paused");
  let url: URL;
  try {
    url = assertWebhookDestination(delivery.destinationUrl, options.allowedHosts ?? parseAllowedWebhookHosts());
  } catch (error) {
    const reason = (error as Error).message;
    return settle(reason === "destination_not_allowlisted" ? "failed" : "dead_letter", reason);
  }
  let signingSecret: string;
  try {
    if (!subscription.signingSecretEncrypted) return settle("failed", "signing_secret_missing");
    if (!/^[a-f0-9]{64}$/.test(subscription.signingSecretDigest ?? "")) return settle("failed", "signing_key_version_missing");
    signingSecret = decryptSecret(subscription.signingSecretEncrypted, options.keyOverride);
    if (secretDigest(signingSecret, options.keyOverride) !== subscription.signingSecretDigest) return settle("failed", "signing_key_version_mismatch");
  } catch {
    return settle("failed", "signing_secret_unavailable");
  }

  const attemptNumber = priorAttempts + 1;
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id: delivery.id, status: delivery.status, attemptCount: delivery.attemptCount },
    data: { status: "processing", attemptCount: attemptNumber, lastError: "sending" },
  });
  if (!claimed.count) return { status: "processing", outcome: "skipped", reason: "claimed_elsewhere" };

  const timestamp = Math.floor(clock().getTime() / 1000);
  const headers = {
    "content-type": "application/json",
    "user-agent": "openfront-law-firm-webhooks/1",
    "x-openfront-event-id": delivery.eventId,
    "x-openfront-event-type": delivery.eventType,
    "x-openfront-delivery-id": delivery.id,
    "x-openfront-attempt": String(attemptNumber),
    "x-openfront-signature": `t=${timestamp},v1=${webhookSignature(signingSecret, timestamp, body)}`,
  };
  let response: WebhookResponse | undefined;
  let errorCode: string | undefined;
  try {
    assertWebhookWireHeaders(headers);
    response = await (options.transport ?? httpsWebhookTransport)({
      url, headers, body, timeoutMs: WEBHOOK_TIMEOUT_MS, maxResponseBytes: WEBHOOK_MAX_RESPONSE_BYTES,
    });
  } catch (error) {
    errorCode = failureCode(error);
  }
  const succeeded = Boolean(response && response.complete !== false && response.status >= 200 && response.status < 300);
  const failure = succeeded ? null : response?.errorCode ?? errorCode ?? `http_${response?.status ?? 0}`;
  const now = clock();
  const finalStatus = succeeded ? "succeeded" : attemptNumber >= WEBHOOK_MAX_ATTEMPTS ? "dead_letter" : "failed";
  await prisma.$transaction(async (tx: any) => {
    await tx.webhookDeliveryAttempt.create({
      data: {
        firmId: delivery.firmId, matterId: delivery.matterId ?? null, deliveryId: delivery.id, attemptNumber,
        attemptedAt: now, requestDigest, responseStatus: response?.status ?? null, responseDigest: response?.bodyDigest ?? "",
        succeeded: succeeded ? "yes" : "no", errorCode: failure ?? "", errorMessage: "",
      },
    });
    await tx.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: finalStatus, lastError: failure ?? "", ...(finalStatus === "failed" ? {} : { completedAt: now }) },
    });
    if (succeeded) await tx.webhookSubscription.update({ where: { id: subscription.id }, data: { lastDeliveredAt: now } });
    await recordAuditEvent(tx, {
      firmId: delivery.firmId, eventType: succeeded ? "webhook.delivery_succeeded" : "webhook.delivery_failed", category: "integration",
      outcome: succeeded ? "succeeded" : "failed", ...(options.actor ?? { actorType: "system" }), matterId: delivery.matterId ?? null,
      metadata: { deliveryId: delivery.id, attemptNumber, requestDigest, responseStatus: response?.status ?? null, errorCode: failure },
    });
  });
  return { status: finalStatus, outcome: succeeded ? "succeeded" : finalStatus === "dead_letter" ? "dead_letter" : "failed", reason: failure ?? undefined };
}
