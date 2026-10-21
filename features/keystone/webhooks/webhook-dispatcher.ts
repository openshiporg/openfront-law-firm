import { createHash, createHmac, randomUUID } from "node:crypto";
import { assertWebhookWireHeaders, assertWebhookWireIdentity } from "./wire-contract";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";

import { canonicalJson, sha256Digest } from "../lib/digests";
import type { Session } from "../access";
import { loadActiveHumanSession } from "../lib/machine-auth";
import { assertCurrentCommandActor, type AuthorityContext } from "../mutations/command-authority";
import { assertMatterAccess } from "../mutations/workflow-helpers";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { decryptSecret, secretDigest } from "../lib/secret-envelope";
import { runSerializableTransaction } from "../lib/transactions";
import { recordAuditEvent } from "../mutations/workflow-helpers";
import { assertWebhookDestination, parseAllowedWebhookHosts, publicOnlyLookup } from "./destination";

export const WEBHOOK_MAX_ATTEMPTS = 8;
export const WEBHOOK_TIMEOUT_MS = 10_000;
export const WEBHOOK_LEASE_MS = 2 * 60_000;
/** Temporarily ineligible rows step back so they cannot starve the queue. */
export const WEBHOOK_DEFERRAL_MS = 5 * 60_000;
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

type DispatchOptions = {
  clock?: () => Date;
  limit?: number;
  transport?: WebhookTransport;
  allowedHosts?: Set<string>;
  keyOverride?: string;
};

type Claim = {
  deliveryId: string;
  claimId: string;
  firmId: string;
  matterId: string | null;
  subscriptionId: string;
  connectionId: string;
  signingKeyVersion: string;
  destinationUrl: string;
  attemptNumber: number;
  url: URL;
  body: string;
  requestDigest: string;
  signingSecret: string;
  eventId: string;
  eventType: string;
};

export function nextWebhookAttemptAt(attempts: number, now: Date) {
  if (attempts >= WEBHOOK_MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + Math.min(2 ** attempts * 60_000, 6 * 60 * 60_000));
}

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

/** A single digest/settlement, with complete END distinct from aborted/truncated
 * 2xx responses. Retained error listeners absorb subsequent close/error events. */
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

async function deadLetter(tx: any, delivery: any, reason: string) {
  if (delivery.status === "pending" || delivery.status === "processing") {
    assertLifecycleTransition("webhookDelivery", delivery.status, "failed");
  }
  assertLifecycleTransition("webhookDelivery", "failed", "dead_letter");
  await tx.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: "dead_letter", nextAttemptAt: null, completedAt: new Date(), lastError: reason },
  });
  await recordAuditEvent(tx, {
    firmId: delivery.firmId,
    eventType: "webhook.delivery_dead_lettered",
    category: "integration",
    outcome: "failed",
    actorType: "system",
    matterId: delivery.matterId ?? null,
    metadata: { deliveryId: delivery.id, attemptCount: delivery.attemptCount, reason },
  });
  return { outcome: "dead_letter" as const, reason };
}

async function recordAttempt(tx: any, delivery: any, data: {
  attemptNumber: number;
  requestDigest: string;
  succeeded: boolean;
  responseStatus?: number | null;
  responseDigest?: string | null;
  errorCode?: string | null;
}) {
  const existing = await tx.webhookDeliveryAttempt.findFirst({
    where: { deliveryId: delivery.id, attemptNumber: data.attemptNumber },
    select: { id: true },
  });
  if (existing) return false;
  await tx.webhookDeliveryAttempt.create({
    data: {
      firmId: delivery.firmId,
      matterId: delivery.matterId ?? null,
      deliveryId: delivery.id,
      attemptNumber: data.attemptNumber,
      attemptedAt: new Date(),
      requestDigest: data.requestDigest,
      responseStatus: data.responseStatus ?? null,
      responseDigest: data.responseDigest ?? "",
      succeeded: data.succeeded ? "yes" : "no",
      errorCode: data.errorCode ?? "",
      errorMessage: "",
    },
  });
  return true;
}

async function failOrDeadLetter(tx: any, delivery: any, attempts: number, errorCode: string, now: Date) {
  const nextAttemptAt = nextWebhookAttemptAt(attempts, now);
  if (!nextAttemptAt) return deadLetter(tx, { ...delivery, attemptCount: attempts }, `retries_exhausted:${errorCode}`);
  assertLifecycleTransition("webhookDelivery", delivery.status, "failed");
  await tx.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: "failed", nextAttemptAt, lastError: errorCode },
  });
  return { outcome: "failed" as const, reason: errorCode };
}

/** Claims one delivery under a lease after re-checking current eligibility. */
async function claimWebhookDelivery(prisma: any, deliveryId: string, options: DispatchOptions & { clock: () => Date }) {
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-dispatch:${deliveryId}`}))`;
    const delivery = await tx.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        firm: { select: { status: true } },
        connection: { select: { id: true, status: true, firmId: true } },
        subscription: {
          select: { id: true, status: true, connectionId: true, endpointUrl: true, eventTypes: true, firmId: true, signingSecretEncrypted: true, signingSecretDigest: true },
        },
      },
    });
    if (!delivery) return { skipped: "missing" as const };
    const now = options.clock(); // reread under the claim fence on every TX retry
    const due = !delivery.nextAttemptAt || delivery.nextAttemptAt <= now;
    if (!due || !["pending", "failed", "processing"].includes(delivery.status)) return { skipped: "not_due" as const };
    const body = webhookBody(delivery);
    const requestDigest = bodyDigest(body);

    if (delivery.status === "processing") {
      // CLAIMED is not ADMITTED. Only a durably admitted attempt might have
      // reached the peer. Both states require review, neither is auto-retried.
      const admission = await tx.auditEvent.findFirst({ where: { firmId: delivery.firmId, eventId: `webhook-admission:${delivery.id}:${delivery.attemptCount}`, eventType: "webhook.send_admitted" } });
      const claimed = await tx.auditEvent.findFirst({ where: { firmId: delivery.firmId, eventId: `webhook-claim:${delivery.id}:${delivery.attemptCount}`, eventType: "webhook.send_claimed" } });
      const knownUnadmitted = delivery.lastError === 'claimed:not_admitted' && claimed?.metadata?.claimProtocolVersion === 1 && typeof claimed.metadata.claimId === 'string' && claimed.metadata.requestDigest === requestDigest && claimed.metadata.effectOutcome === 'not_dispatched';
      // Missing legacy admission/rows is NOT proof that no remote effect occurred.
      const reason = admission ? "outcome_unknown:lease_expired" : knownUnadmitted ? "not_dispatched:claim_expired" : "outcome_unknown:legacy_lineage_missing";
      await recordAttempt(tx, delivery, {
        attemptNumber: Math.max(1, delivery.attemptCount), requestDigest, succeeded: false, errorCode: reason,
      });
      await tx.webhookDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: null, lastError: reason } });
      return { settled: { outcome: knownUnadmitted && !admission ? "not_dispatched" as const : "unknown" as const } };
    }

    try { assertWebhookWireIdentity(delivery.eventId, delivery.eventType); }
    catch { return { settled: await deadLetter(tx, delivery, "invalid_wire_identity") }; }
    const { connection, subscription } = delivery;
    if (connection?.status === "revoked" || connection?.firmId !== delivery.firmId) return { settled: await deadLetter(tx, delivery, "connection_revoked") };
    if (!subscription || subscription.firmId !== delivery.firmId || subscription.status === "revoked") return { settled: await deadLetter(tx, delivery, "subscription_revoked") };
    if (subscription.connectionId !== delivery.connectionId) return { settled: await deadLetter(tx, delivery, "subscription_moved") };
    if (!Array.isArray(subscription.eventTypes) || !subscription.eventTypes.includes(delivery.eventType)) {
      return { settled: await deadLetter(tx, delivery, "event_type_unsubscribed") };
    }
    if (delivery.destinationUrl !== subscription.endpointUrl) return { settled: await deadLetter(tx, delivery, "destination_changed") };
    if (Buffer.byteLength(body) > WEBHOOK_MAX_BODY_BYTES) return { settled: await deadLetter(tx, delivery, "payload_too_large") };
    if (delivery.matterId) {
      const matter = await tx.matter.findFirst({ where: { id: delivery.matterId, firmId: delivery.firmId }, select: { id: true } });
      if (!matter) return { settled: await deadLetter(tx, delivery, "matter_unavailable") };
    }
    if (delivery.attemptCount >= WEBHOOK_MAX_ATTEMPTS) return { settled: await deadLetter(tx, delivery, "retries_exhausted") };
    // Temporary conditions leave the delivery queued, deferred to a later run.
    const defer = async (skipped: string) => {
      await tx.webhookDelivery.update({
        where: { id: delivery.id },
        data: { nextAttemptAt: new Date(now.getTime() + WEBHOOK_DEFERRAL_MS), lastError: skipped },
      });
      return { skipped };
    };
    if (delivery.firm?.status !== "active") return defer("firm_inactive");
    if (connection.status !== "active") return defer("connection_inactive");
    if (subscription.status !== "active") return defer("subscription_paused");

    let url: URL;
    try {
      url = assertWebhookDestination(delivery.destinationUrl, options.allowedHosts ?? parseAllowedWebhookHosts());
    } catch (error) {
      const reason = (error as Error).message;
      if (reason === "destination_not_allowlisted") return defer(reason);
      return { settled: await deadLetter(tx, delivery, reason) };
    }
    let signingSecret: string;
    try {
      if (!subscription.signingSecretEncrypted) return defer("signing_secret_missing");
      if (!/^[a-f0-9]{64}$/.test(subscription.signingSecretDigest ?? "")) return defer("signing_key_version_missing");
      signingSecret = decryptSecret(subscription.signingSecretEncrypted, options.keyOverride);
      if (secretDigest(signingSecret, options.keyOverride) !== subscription.signingSecretDigest) return defer("signing_key_version_mismatch");
    } catch {
      return defer("signing_secret_unavailable");
    }

    if (delivery.status === "failed") assertLifecycleTransition("webhookDelivery", "failed", "pending");
    assertLifecycleTransition("webhookDelivery", "pending", "processing");
    const attemptNumber = delivery.attemptCount + 1;
    const claimId = randomUUID();
    const claimedAt = options.clock();
    await tx.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "processing", attemptCount: attemptNumber, nextAttemptAt: new Date(claimedAt.getTime() + WEBHOOK_LEASE_MS), lastError: "claimed:not_admitted" },
    });
    await tx.auditEvent.create({ data: { firmId: delivery.firmId, eventId: `webhook-claim:${delivery.id}:${attemptNumber}`, eventType: "webhook.send_claimed", category: "integration", outcome: "succeeded", actorType: "system", occurredAt: claimedAt, metadata: { deliveryId: delivery.id, attemptNumber, claimId, requestDigest, claimProtocolVersion: 1, effectOutcome: "not_dispatched" } } });
    const claim: Claim = {
      deliveryId: delivery.id, claimId,
      firmId: delivery.firmId,
      matterId: delivery.matterId ?? null,
      subscriptionId: subscription.id,
      connectionId: delivery.connectionId,
      signingKeyVersion: bodyDigest(subscription.signingSecretEncrypted),
      destinationUrl: delivery.destinationUrl,
      attemptNumber,
      url,
      body,
      requestDigest,
      signingSecret,
      eventId: delivery.eventId,
      eventType: delivery.eventType,
    };
    return { claim };
  });
}

/** Persist the exact admitted configuration/intent BEFORE any external I/O.
 * Ordinary row locks participate with revocation/rotation writers. Admission is
 * the durable ordering point; a later revocation cannot certify remote recall. */
async function admitWebhookSend(prisma: any, claim: Claim, headers: Record<string, string>, clock: () => Date, keyOverride?: string) {
  assertWebhookWireIdentity(claim.eventId, claim.eventType);
  assertWebhookWireHeaders(headers); // Node's real header validator, BEFORE admission
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-dispatch:${claim.deliveryId}`}))`;
    await tx.$executeRaw`SELECT id FROM "Firm" WHERE id = ${claim.firmId} FOR SHARE`;
    await tx.$executeRaw`SELECT id FROM "IntegrationConnection" WHERE id = ${claim.connectionId} AND firm = ${claim.firmId} FOR SHARE`;
    await tx.$executeRaw`SELECT id FROM "WebhookSubscription" WHERE id = ${claim.subscriptionId} AND firm = ${claim.firmId} FOR SHARE`;
    const delivery = await tx.webhookDelivery.findUnique({ where: { id: claim.deliveryId }, include: { firm: true, connection: true, subscription: true } });
    const claimed = await tx.auditEvent.findFirst({ where: { firmId: claim.firmId, eventId: `webhook-claim:${claim.deliveryId}:${claim.attemptNumber}`, eventType: "webhook.send_claimed" } });
    if (!delivery || delivery.status !== "processing" || delivery.attemptCount !== claim.attemptNumber || delivery.lastError !== "claimed:not_admitted" || claimed?.metadata?.claimId !== claim.claimId || claimed.metadata?.claimProtocolVersion !== 1 || claimed.metadata?.requestDigest !== claim.requestDigest || !delivery.nextAttemptAt) return false;
    const subscription = delivery.subscription;
    if (delivery.firmId !== claim.firmId || delivery.firm?.status !== "active" || delivery.connection?.status !== "active" || delivery.connection.firmId !== claim.firmId || !subscription || subscription.status !== "active" || subscription.firmId !== claim.firmId || subscription.connectionId !== claim.connectionId || subscription.endpointUrl !== claim.destinationUrl || delivery.destinationUrl !== claim.destinationUrl || bodyDigest(subscription.signingSecretEncrypted ?? "") !== claim.signingKeyVersion || subscription.signingSecretDigest !== secretDigest(claim.signingSecret, keyOverride) || !Array.isArray(subscription.eventTypes) || !subscription.eventTypes.includes(claim.eventType) || bodyDigest(webhookBody(delivery)) !== claim.requestDigest) return false;
    const origin = await tx.auditEvent.findFirst({ where: { firmId: claim.firmId, eventType: "webhook.delivery_enqueued", metadata: { path: ["deliveryId"], equals: claim.deliveryId } } });
    const expectedIntent = sha256Digest({ eventId: delivery.eventId, eventType: delivery.eventType, payload: delivery.payload, destinationUrl: delivery.destinationUrl });
    if (!origin?.actorUserId || origin.actorAgentId || origin.metadata?.requestDigest !== expectedIntent) return false;
    const kind = origin.metadata?.authenticationType ?? (origin.actorType === "user" ? "human" : origin.actorType);
    if (!["human", "api_key", "oauth"].includes(kind) || kind !== "human" && !origin.metadata?.credentialId) return false;
    const current = await loadActiveHumanSession(tx, origin.actorUserId, claim.firmId);
    if (!current) return false;
    const session: Session = { ...current, authenticationType: kind, credentialId: origin.metadata?.credentialId ?? undefined };
    const withSession = (session: Session): AuthorityContext => ({ session, withSession });
    await assertCurrentCommandActor(tx, withSession(session), "canManageIntegrations");
    if (claim.matterId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-team:${claim.firmId}:${claim.matterId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${claim.firmId}:${claim.matterId}`}))`;
      await tx.$executeRaw`SELECT id FROM "Matter" WHERE id = ${claim.matterId} AND firm = ${claim.firmId} FOR SHARE`;
      await assertCurrentCommandActor(tx, withSession(session), "canReadMatters");
      await assertMatterAccess(tx, claim.firmId, claim.matterId, session.itemId);
    }
    const now = clock(); // after ALL waits/authority/configuration locks
    if (delivery.nextAttemptAt.getTime() <= now.getTime() + WEBHOOK_TIMEOUT_MS + 1_000) return false;
    await tx.webhookDelivery.update({ where: { id: delivery.id }, data: { lastError: "admitted:awaiting_observation" } });
    await tx.auditEvent.create({ data: {
      firmId: claim.firmId, eventId: `webhook-admission:${claim.deliveryId}:${claim.attemptNumber}`, eventType: "webhook.send_admitted", category: "integration", outcome: "succeeded", actorType: "system", occurredAt: now,
      metadata: { deliveryId: claim.deliveryId, claimId: claim.claimId, attemptNumber: claim.attemptNumber, connectionId: claim.connectionId, subscriptionId: claim.subscriptionId, signingKeyVersion: claim.signingKeyVersion, protocolVersion: 1, destination: claim.url.href, requestDigest: claim.requestDigest, signatureHeaderDigest: bodyDigest(headers["x-openfront-signature"]), signatureTimestamp: headers["x-openfront-signature"].split(",")[0], leaseExpiresAt: delivery.nextAttemptAt.toISOString(), effectOutcome: "not_yet_observed" },
    } });
    return true;
  });
}

/** Distinguish proved pre-I/O denial from an admitted possibly-sent effect.
 * A missing admission ACK alone is not proof: read committed admission first. */
async function recordUnadmittedWebhook(prisma: any, claim: Claim, clock: () => Date) {
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-dispatch:${claim.deliveryId}`}))`;
    const admission = await tx.auditEvent.findFirst({ where: { firmId: claim.firmId, eventId: `webhook-admission:${claim.deliveryId}:${claim.attemptNumber}`, eventType: "webhook.send_admitted" } });
    if (admission) return "admitted";
    const delivery = await tx.webhookDelivery.findUnique({ where: { id: claim.deliveryId } });
    const claimed = await tx.auditEvent.findFirst({ where: { firmId: claim.firmId, eventId: `webhook-claim:${claim.deliveryId}:${claim.attemptNumber}`, eventType: "webhook.send_claimed" } });
    if (!delivery || delivery.status !== "processing" || delivery.attemptCount !== claim.attemptNumber || claimed?.metadata?.claimId !== claim.claimId || claimed.metadata?.claimProtocolVersion !== 1 || claimed.metadata?.requestDigest !== claim.requestDigest || delivery.lastError !== "claimed:not_admitted") return "claim_changed";
    if (!await recordAttempt(tx, delivery, { attemptNumber: claim.attemptNumber, requestDigest: claim.requestDigest, succeeded: false, errorCode: "not_dispatched:admission_denied" })) return "attempt_conflict";
    const now = clock();
    await tx.webhookDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: null, lastError: "not_dispatched:admission_denied" } });
    await tx.auditEvent.create({ data: { firmId: claim.firmId, eventId: `webhook-denial:${claim.deliveryId}:${claim.attemptNumber}`, eventType: "webhook.send_not_admitted", category: "integration", outcome: "denied", actorType: "system", occurredAt: now,
      metadata: { deliveryId: claim.deliveryId, claimId: claim.claimId, attemptNumber: claim.attemptNumber, requestDigest: claim.requestDigest, effectOutcome: "not_dispatched", requiresReview: true } } });
    return "not_dispatched";
  });
}

/** Only the live, admitted generation may record a terminal outcome. */
async function recordWebhookOutcome(
  prisma: any,
  claim: Claim,
  result: { response?: WebhookResponse; errorCode?: string },
  clock: () => Date,
) {
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-dispatch:${claim.deliveryId}`}))`;
    const delivery = await tx.webhookDelivery.findUnique({ where: { id: claim.deliveryId } });
    const now = clock();
    const admission = await tx.auditEvent.findFirst({ where: { firmId: claim.firmId, eventId: `webhook-admission:${claim.deliveryId}:${claim.attemptNumber}`, eventType: "webhook.send_admitted" } });
    const prior = await tx.webhookDeliveryAttempt.findFirst({ where: { deliveryId: claim.deliveryId, attemptNumber: claim.attemptNumber } });
    if (!delivery || delivery.status !== "processing" || delivery.attemptCount !== claim.attemptNumber || admission?.metadata?.claimId !== claim.claimId || delivery.lastError !== "admitted:awaiting_observation" || !delivery.nextAttemptAt || delivery.nextAttemptAt <= now || prior) {
      // A late real receipt is evidence, NOT current terminal-write authority.
      await tx.auditEvent.create({ data: { firmId: claim.firmId, eventId: randomUUID(), eventType: "webhook.late_observation", category: "integration", outcome: "failed", actorType: "system", occurredAt: now,
        metadata: { deliveryId: claim.deliveryId, claimId: claim.claimId, attemptNumber: claim.attemptNumber, requestDigest: claim.requestDigest, responseStatus: result.response?.status ?? null, responseDigest: result.response?.bodyDigest ?? null, complete: result.response?.complete ?? null, errorCode: result.errorCode ?? null, effectOutcome: "requires_reconciliation" } } });
      return { outcome: "late_observation" as const };
    }
    const succeeded = Boolean(result.response && result.response.complete !== false && result.response.status >= 200 && result.response.status < 300);
    const errorCode = succeeded ? null : result.response?.errorCode ?? result.errorCode ?? `http_${result.response?.status ?? 0}`;
    const inserted = await recordAttempt(tx, delivery, {
      attemptNumber: claim.attemptNumber,
      requestDigest: claim.requestDigest,
      succeeded,
      responseStatus: result.response?.status ?? null,
      responseDigest: result.response?.bodyDigest ?? null,
      errorCode,
    });
    if (!inserted) return { outcome: "attempt_conflict" as const };
    if (succeeded) {
      assertLifecycleTransition("webhookDelivery", "processing", "succeeded");
      await tx.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "succeeded", completedAt: now, nextAttemptAt: null, lastError: "" },
      });
      await tx.webhookSubscription.update({ where: { id: claim.subscriptionId }, data: { lastDeliveredAt: now } });
      return { outcome: "succeeded" as const };
    }
    if (!result.response || result.response.complete === false) {
      // Dispatch may already have caused an effect. A partial/absent response is
      // not permission to resend. Keep an explicit unresolved processing state.
      await tx.webhookDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: null, lastError: `outcome_unknown:${result.response?.errorCode ?? errorCode}` } });
      return { outcome: "unknown" as const };
    }
    return failOrDeadLetter(tx, delivery, claim.attemptNumber, errorCode!, now);
  });
}

/**
 * Privileged outbox worker. It is a server-only entry point (see run.ts); it is
 * deliberately not registered on the GraphQL schema, and callers can never
 * supply an outcome: outcomes come only from the HTTP exchange performed here.
 */
export async function dispatchWebhookDeliveries(prisma: any, options: DispatchOptions = {}): Promise<Record<string, number>> {
  const clock = options.clock ?? (() => new Date());
  const now = clock();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const transport = options.transport ?? httpsWebhookTransport;
  const candidates = await prisma.webhookDelivery.findMany({
    where: {
      OR: [
        { status: "pending", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "failed", nextAttemptAt: { lte: now } },
        { status: "processing", nextAttemptAt: { lte: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });
  const summary: Record<string, number> = {};
  const count = (key: string) => { summary[key] = (summary[key] ?? 0) + 1; };
  for (const candidate of candidates) {
    const claimed: any = await claimWebhookDelivery(prisma, candidate.id, { ...options, clock });
    if (claimed.skipped) { count(`skipped:${claimed.skipped}`); continue; }
    if (claimed.settled) { count(claimed.settled.outcome); continue; }
    if (!claimed.claim) continue;
    const claim: Claim = claimed.claim;
    const timestamp = Math.floor(clock().getTime() / 1000);
    let result: { response?: WebhookResponse; errorCode?: string };
    const headers = {
      "content-type": "application/json",
      "user-agent": "openfront-law-firm-webhooks/1",
      "x-openfront-event-id": claim.eventId,
      "x-openfront-event-type": claim.eventType,
      "x-openfront-delivery-id": claim.deliveryId,
      "x-openfront-attempt": String(claim.attemptNumber),
      "x-openfront-signature": `t=${timestamp},v1=${webhookSignature(claim.signingSecret, timestamp, claim.body)}`,
    };
    try {
      if (!await admitWebhookSend(prisma, claim, headers, clock, options.keyOverride)) {
        count(await recordUnadmittedWebhook(prisma, claim, clock)); continue;
      }
      const response = await transport({
        url: claim.url,
        headers,
        body: claim.body,
        timeoutMs: WEBHOOK_TIMEOUT_MS,
        maxResponseBytes: WEBHOOK_MAX_RESPONSE_BYTES,
      });
      result = { response };
    } catch (error) {
      // Read durable admission rather than trusting whether its ACK arrived.
      const disposition = await recordUnadmittedWebhook(prisma, claim, clock);
      if (disposition !== "admitted") { count(disposition); continue; }
      result = { errorCode: failureCode(error) };
    }
    const recorded = await recordWebhookOutcome(prisma, claim, result, clock);
    count(recorded.outcome);
  }
  return { examined: candidates.length, ...summary };
}
