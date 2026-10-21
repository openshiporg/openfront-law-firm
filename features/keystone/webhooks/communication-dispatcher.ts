import { createTransport } from "nodemailer";
import { randomUUID } from "node:crypto";
import { connect, type Socket } from "node:net";

import { sha256Digest } from "../lib/digests";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { runSerializableTransaction } from "../lib/transactions";
import {
  assertCurrentCommunicationRecipient,
  assertCurrentCommunicationOrigin,
  COMMUNICATION_DELIVERY_SNAPSHOT_VERSION,
  communicationEnvelopeDigest,
  isSingleEmailAddress,
} from "../mutations/communicationWorkflows";

export const COMMUNICATION_MAX_ATTEMPTS = 5;
export const COMMUNICATION_LEASE_MS = 5 * 60_000;

export type OutboundEmail = {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  messageId: string;
  headers: Record<string, string>;
};
export type EmailSendResult = { providerMessageId: string; acceptedRecipientDigest?: string; relayResponseDigest?: string };
type DeliveryOutcome = { sent: boolean; errorCode?: string; providerMessageId?: string; permanent?: boolean; unknown?: boolean; acceptedRecipientDigest?: string; relayResponseDigest?: string };
export const COMMUNICATION_SEND_DEADLINE_MS = 60_000;
/** A permanent failure (e.g. SMTP 5xx or a rejected recipient) is not retried. */
export class PermanentEmailFailure extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export type EmailSender = (message: OutboundEmail, options?: { signal: AbortSignal }) => Promise<EmailSendResult>;

function mailDomain(address: string) {
  const domain = address.split("@").pop()?.replace(/[>\s]/g, "") ?? "";
  return /^[A-Za-z0-9.-]+$/.test(domain) ? domain : "openfront-law-firm.invalid";
}

/** SMTP sender from the same configuration as Keystone mail; null when unconfigured. */
export function smtpEmailSenderFromEnv(env: NodeJS.ProcessEnv = process.env): EmailSender | null {
  const host = env.SMTP_HOST?.trim();
  const from = env.SMTP_FROM?.trim();
  const port = Number(env.SMTP_PORT);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return async (message, options) => {
    // Own the actual TCP socket, including the socket underlying STARTTLS.
    // Nodemailer's non-pool transport.close alone does NOT cancel sendMail.
    let socket: Socket | undefined;
    const abort = () => socket?.destroy(new Error("smtp_canceled_outcome_unknown"));
    const transport = createTransport({ host, port, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      getSocket(_options: unknown, callback: (error: Error | null, socketOptions?: { connection?: Socket }) => void) {
        if (options?.signal.aborted) { callback(new Error("smtp_canceled_outcome_unknown"), {}); return; }
        socket = connect({ host, port });
        let settled = false;
        const finish = (error: Error | null) => {
          if (settled) return;
          settled = true;
          callback(error, error ? {} : { connection: socket });
        };
        socket.once("error", finish);
        socket.once("connect", () => finish(null));
      },
    });
    options?.signal.addEventListener("abort", abort, { once: true });
    let info: any;
    try {
      info = await transport.sendMail({
        from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        messageId: message.messageId,
        headers: message.headers,
      });
    } catch (error) {
      const responseCode = Number((error as { responseCode?: number })?.responseCode);
      if (responseCode >= 500 && responseCode < 600) throw new PermanentEmailFailure(`smtp_${responseCode}`);
      throw error;
    } finally {
      options?.signal.removeEventListener("abort", abort);
      socket?.destroy();
      transport.close();
    }
    const accepted = Array.isArray(info?.accepted) ? info.accepted.map((value: unknown) => String(value).toLowerCase()) : [];
    const rejected = Array.isArray(info?.rejected) ? info.rejected.map((value: unknown) => String(value).toLowerCase()) : [];
    if (accepted.length === 0 && rejected.includes(message.to.toLowerCase())) throw new PermanentEmailFailure("recipient_rejected");
    if (accepted.length !== 1 || accepted[0] !== message.to.toLowerCase()) throw new Error("smtp_acceptance_unknown");
    // Message-ID is caller correlation, NOT a relay receipt or deduplication promise.
    const response = String(info?.response ?? "");
    const relayId = /queued as\s+([A-Za-z0-9._-]+)/i.exec(response)?.[1] ?? "";
    return { providerMessageId: relayId, acceptedRecipientDigest: sha256Digest(accepted), relayResponseDigest: sha256Digest(response) }; 
  };
}

function retryDelayMs(attempts: number) {
  return Math.max(COMMUNICATION_LEASE_MS, Math.min(2 ** attempts * 60_000, 6 * 60 * 60_000));
}

async function settleMessageStatus(tx: any, messageId: string, now: Date) {
  await tx.$executeRaw`SELECT id FROM "CommunicationMessage" WHERE id = ${messageId} FOR UPDATE`;
  const [message, states] = await Promise.all([
    tx.communicationMessage.findUnique({ where: { id: messageId }, select: { id: true, status: true } }),
    tx.communicationDelivery.findMany({ where: { messageId }, select: { status: true } }),
  ]);
  const statuses = states.map((state: any) => state.status);
  const target = statuses.length && statuses.every((status: string) => status === "failed" || status === "bounced")
    ? "failed"
    : statuses.length && statuses.every((status: string) => ["sent", "delivered", "failed", "bounced"].includes(status)) && statuses.some((status: string) => status === "sent" || status === "delivered")
      ? "sent"
      : null;
  if (message && target && message.status === "queued") {
    assertLifecycleTransition("communicationMessage", message.status, target);
    await tx.communicationMessage.update({
      where: { id: message.id },
      data: { status: target, ...(target === "sent" ? { sentAt: now } : {}) },
    });
  }
}

async function recordOutcome(tx: any, delivery: any, attemptNumber: number, outcome: DeliveryOutcome, now: Date, terminal: boolean) {
  if (outcome.unknown) {
    await tx.communicationDelivery.update({ where: { id: delivery.id }, data: {
      errorCode: "smtp_outcome_unknown", errorMessage: "Acceptance is unconfirmed. Do not resend without reconciliation.",
      providerMetadata: { ...delivery.providerMetadata, dispatch: { ...delivery.providerMetadata?.dispatch, phase: "unknown", observedAt: now.toISOString() } },
    } });
    await tx.auditEvent.create({ data: { firmId: delivery.firmId, eventId: `communication-unknown:${delivery.id}:${attemptNumber}`, eventType: "communication.delivery_outcome_unknown", category: "integration", outcome: "failed", actorType: "system", occurredAt: now, metadata: { deliveryId: delivery.id, attemptNumber, effectOutcome: "unknown", errorCode: outcome.errorCode ?? null } } });
    return "unknown";
  }
  if (outcome.sent || terminal) {
    const toStatus = outcome.sent ? "sent" : "failed";
    assertLifecycleTransition("communicationDelivery", delivery.status, toStatus);
    await tx.communicationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: toStatus,
        providerMessageId: outcome.providerMessageId ?? "",
        errorCode: outcome.errorCode ?? "",
        errorMessage: "",
        providerMetadata: { ...delivery.providerMetadata, dispatch: { ...delivery.providerMetadata?.dispatch, phase: outcome.sent ? "relay_accepted" : "rejected", acceptedRecipientDigest: outcome.acceptedRecipientDigest ?? null, relayResponseDigest: outcome.relayResponseDigest ?? null } },
      },
    });
    await tx.auditEvent.create({
      data: {
        firmId: delivery.firmId,
        eventId: `communication-dispatch:${delivery.id}:${attemptNumber}`,
        eventType: `communication.delivery_${toStatus}`,
        category: "integration",
        outcome: outcome.sent ? "succeeded" : "failed",
        actorType: "system",
        matterId: delivery.matterId ?? null,
        occurredAt: now,
        metadata: {
          deliveryId: delivery.id,
          attemptNumber,
          errorCode: outcome.errorCode ?? null,
          providerMessageIdDigest: outcome.providerMessageId ? sha256Digest(outcome.providerMessageId) : null,
        },
      },
    });
    await settleMessageStatus(tx, delivery.messageId, now);
    return toStatus;
  }
  await tx.communicationDelivery.update({
    where: { id: delivery.id },
    data: { errorCode: outcome.errorCode ?? "send_failed" },
  });
  return "retry";
}

async function claimDelivery(prisma: any, deliveryId: string, clock: () => Date) {
  return runSerializableTransaction(prisma, async (tx: any) => {
    const identity = await tx.communicationDelivery.findUnique({ where: { id: deliveryId }, select: { firmId: true } });
    if (!identity) return { skipped: "missing" };
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`communication-delivery:${identity.firmId}:${deliveryId}`}))`;
    const delivery = await tx.communicationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        message: { include: { attachments: { select: { id: true } }, firm: { select: { status: true, supportEmail: true } } } },
      },
    });
    if (!delivery || delivery.status !== "pending" || delivery.channel !== "email") return { skipped: "not_pending" };
    if (delivery.integrationConnectionId || delivery.provider !== "smtp") return { skipped: "provider_adapter_required" };
    const now = clock(); // after the participating lock, including transaction retries
    const previousPhase = delivery.providerMetadata?.dispatch?.phase;
    if (previousPhase === "unknown") return { skipped: "outcome_unknown" };
    if (previousPhase === "not_dispatched") return { skipped: "admission_review_required" };
    if (previousPhase === "admitted") {
      if (delivery.lastAttemptAt && delivery.lastAttemptAt.getTime() + COMMUNICATION_LEASE_MS > now.getTime()) return { skipped: "in_flight" };
      return { settled: await recordOutcome(tx, delivery, delivery.attemptCount, { sent: false, unknown: true, errorCode: "send_observation_lost" }, now, false) };
    }
    if (delivery.attemptCount > 0) return { settled: await recordOutcome(tx, delivery, delivery.attemptCount, { sent: false, unknown: true, errorCode: "legacy_dispatch_lineage_missing" }, now, false) };
    if (delivery.lastAttemptAt && delivery.lastAttemptAt.getTime() + retryDelayMs(delivery.attemptCount) > now.getTime()) {
      return { skipped: "not_due" };
    }
    const message = delivery.message;
    if (!message || message.status !== "queued") return { skipped: "message_not_queued" };
    const fail = async (errorCode: string) => ({
      settled: await recordOutcome(tx, delivery, delivery.attemptCount, { sent: false, errorCode }, now, true),
    });
    if (delivery.attemptCount >= COMMUNICATION_MAX_ATTEMPTS) return fail("retries_exhausted");
    const snapshot = delivery.providerMetadata ?? {};
    if (snapshot.snapshotVersion !== COMMUNICATION_DELIVERY_SNAPSHOT_VERSION) return fail("snapshot_missing");
    if (snapshot.envelopeDigest !== communicationEnvelopeDigest(message)) return fail("envelope_changed");
    if ((snapshot.attachments ?? []).length || message.attachments.length) {
      // No storage adapter can stream the exact versions, so never send a message without them.
      return fail("attachment_storage_unavailable");
    }
    if (!isSingleEmailAddress(delivery.recipientAddress)) return fail("recipient_invalid");
    try {
      await assertCurrentCommunicationRecipient(tx, message, snapshot.participantId ?? "", delivery.recipientAddress);
    } catch { return fail("recipient_authority_revoked"); }
    if (message.firm?.status !== "active") return { skipped: "firm_inactive" };

    const attemptNumber = delivery.attemptCount + 1;
    await tx.communicationDelivery.update({
      where: { id: delivery.id },
      data: { attemptCount: attemptNumber, lastAttemptAt: clock() },
    });
    const replyTo = isSingleEmailAddress(message.firm?.supportEmail) ? message.firm.supportEmail : undefined;
    return {
      claim: {
        deliveryId: delivery.id,
        attemptNumber,
        email: {
          to: delivery.recipientAddress,
          replyTo,
          subject: message.subject || "(no subject)",
          text: message.body,
          headers: { "X-Openfront-Delivery-Id": delivery.id },
        },
      },
    };
  });
}

/** Durable send-admission linearization point, AFTER claim and BEFORE I/O.
 * Revocation before this transaction denies dispatch. After admission, a crash
 * or revocation cannot prove recall/nonacceptance: the outcome remains unknown. */
async function admitCommunicationSend(prisma: any, claim: any, clock: () => Date) {
  return runSerializableTransaction(prisma, async (tx: any) => {
    const identity = await tx.communicationDelivery.findUnique({ where: { id: claim.deliveryId }, select: { firmId: true } });
    if (!identity) return null;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`communication-delivery:${identity.firmId}:${claim.deliveryId}`}))`;
    const delivery = await tx.communicationDelivery.findUnique({ where: { id: claim.deliveryId }, include: { message: true } });
    if (!delivery || delivery.status !== "pending" || delivery.attemptCount !== claim.attemptNumber || !delivery.lastAttemptAt) return null;
    if (["admitted", "unknown"].includes(delivery.providerMetadata?.dispatch?.phase)) return null;
    if (!delivery.message || delivery.message.status !== "queued" || delivery.message.firmId !== delivery.firmId || delivery.message.matterId !== delivery.matterId) return null;
    await assertCurrentCommunicationOrigin(tx, delivery.message);
    await assertCurrentCommunicationRecipient(tx, delivery.message, delivery.providerMetadata?.participantId ?? "", delivery.recipientAddress);
    if (communicationEnvelopeDigest(delivery.message) !== delivery.providerMetadata?.envelopeDigest) return null;
    const now = clock();
    if (delivery.lastAttemptAt.getTime() + COMMUNICATION_LEASE_MS <= now.getTime() + COMMUNICATION_SEND_DEADLINE_MS + 1_000) return null;
    const claimId = randomUUID();
    await tx.communicationDelivery.update({ where: { id: delivery.id }, data: {
      errorCode: "smtp_send_admitted",
      providerMetadata: { ...delivery.providerMetadata, dispatch: { phase: "admitted", claimId, attemptNumber: claim.attemptNumber, admittedAt: now.toISOString(), envelopeDigest: delivery.providerMetadata.envelopeDigest } },
    } });
    await tx.auditEvent.create({ data: { firmId: delivery.firmId, eventId: `communication-admission:${delivery.id}:${claim.attemptNumber}`, eventType: "communication.send_admitted", category: "integration", outcome: "succeeded", actorType: "system", occurredAt: now, metadata: { deliveryId: delivery.id, attemptNumber: claim.attemptNumber, claimId, effectOutcome: "not_yet_observed" } } });
    return claimId;
  });
}

async function recordCommunicationAdmissionDenied(prisma: any, claim: any, clock: () => Date) {
  return runSerializableTransaction(prisma, async (tx: any) => {
    const identity = await tx.communicationDelivery.findUnique({ where: { id: claim.deliveryId }, select: { firmId: true } });
    if (!identity) return;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`communication-delivery:${identity.firmId}:${claim.deliveryId}`}))`;
    const delivery = await tx.communicationDelivery.findUnique({ where: { id: claim.deliveryId } });
    if (!delivery || delivery.status !== 'pending' || delivery.attemptCount !== claim.attemptNumber || ['admitted', 'unknown', 'not_dispatched'].includes(delivery.providerMetadata?.dispatch?.phase)) return;
    const now = clock();
    await tx.communicationDelivery.update({ where: { id: delivery.id }, data: { errorCode: 'smtp_not_dispatched', providerMetadata: { ...delivery.providerMetadata, dispatch: { phase: 'not_dispatched', attemptNumber: claim.attemptNumber, observedAt: now.toISOString() } } } });
    await tx.auditEvent.create({ data: { firmId: delivery.firmId, eventId: `communication-not-admitted:${delivery.id}:${claim.attemptNumber}`, eventType: 'communication.send_not_admitted', category: 'integration', outcome: 'denied', actorType: 'system', occurredAt: now, metadata: { deliveryId: delivery.id, attemptNumber: claim.attemptNumber, effectOutcome: 'not_dispatched', requiresReview: true } } });
  });
}

async function completeDelivery(prisma: any, claim: any, outcome: DeliveryOutcome, clock: () => Date) {
  return runSerializableTransaction(prisma, async (tx: any) => {
    const identity = await tx.communicationDelivery.findUnique({ where: { id: claim.deliveryId }, select: { firmId: true } });
    if (!identity) return "lease_lost";
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`communication-delivery:${identity.firmId}:${claim.deliveryId}`}))`;
    const delivery = await tx.communicationDelivery.findUnique({ where: { id: claim.deliveryId } });
    if (!delivery || delivery.status !== "pending" || delivery.attemptCount !== claim.attemptNumber || delivery.providerMetadata?.dispatch?.claimId !== claim.claimId) return "lease_lost";
    const now = clock();
    if (delivery.providerMetadata?.dispatch?.phase !== "admitted" || !delivery.lastAttemptAt || delivery.lastAttemptAt.getTime() + COMMUNICATION_LEASE_MS <= now.getTime()) {
      await tx.auditEvent.create({ data: { firmId: delivery.firmId, eventId: randomUUID(), eventType: "communication.late_observation", category: "integration", outcome: "failed", actorType: "system", occurredAt: now,
        metadata: { deliveryId: delivery.id, claimId: claim.claimId, attemptNumber: claim.attemptNumber, observation: outcome.sent ? "relay_accepted" : outcome.unknown ? "unknown" : "rejected", observationDigest: sha256Digest(outcome), effectOutcome: "requires_reconciliation" } } });
      if (delivery.providerMetadata?.dispatch?.phase === "admitted") await recordOutcome(tx, delivery, claim.attemptNumber, { sent: false, unknown: true, errorCode: "late_observation" }, now, false);
      return "late_observation";
    }
    const terminal = Boolean(outcome.permanent) || claim.attemptNumber >= COMMUNICATION_MAX_ATTEMPTS;
    return recordOutcome(tx, delivery, claim.attemptNumber, outcome, now, terminal);
  });
}

/**
 * Privileged email outbox for human-queued messages. Server-only (see run.ts),
 * never a GraphQL root: "sent" means the SMTP relay accepted the message;
 * "delivered" still requires authenticated provider events.
 */
export async function dispatchCommunicationDeliveries(
  prisma: any,
  options: { clock?: () => Date; limit?: number; sender?: EmailSender | null } = {},
): Promise<Record<string, number | string>> {
  const sender = options.sender === undefined ? smtpEmailSenderFromEnv() : options.sender;
  if (!sender) return { examined: 0, skipped: "email_unconfigured" };
  const clock = options.clock ?? (() => new Date());
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const candidates = await prisma.communicationDelivery.findMany({
    where: {
      status: "pending",
      channel: "email",
      provider: "smtp",
      integrationConnectionId: null,
      attemptCount: { lt: COMMUNICATION_MAX_ATTEMPTS + 1 },
      // UNKNOWN is persisted atomically with this code; it remains review-only,
      // never consuming the dispatchable window or automatically resending.
      errorCode: { notIn: ["smtp_outcome_unknown", "smtp_not_dispatched"] },
      OR: [
        { lastAttemptAt: null },
        ...Array.from({ length: COMMUNICATION_MAX_ATTEMPTS + 1 }, (_, attemptCount) => ({ attemptCount, lastAttemptAt: { lte: new Date(clock().getTime() - retryDelayMs(attemptCount)) } })),
      ],
      message: { status: "queued", firm: { status: "active" } },
    },
    orderBy: [{ lastAttemptAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });
  const summary: Record<string, number> = {};
  const count = (key: string) => { summary[key] = (summary[key] ?? 0) + 1; };
  const domain = mailDomain(process.env.SMTP_FROM ?? "");
  for (const candidate of candidates) {
    const claimed: any = await claimDelivery(prisma, candidate.id, clock);
    if (claimed.skipped) { count(`skipped:${claimed.skipped}`); continue; }
    if (claimed.settled) { count(claimed.settled); continue; }
    const claim = claimed.claim;
    let outcome: DeliveryOutcome;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    try {
      claim.claimId = await admitCommunicationSend(prisma, claim, clock);
      if (!claim.claimId) { await recordCommunicationAdmissionDenied(prisma, claim, clock); count("send_admission_denied"); continue; }
      const result = await Promise.race([
        sender({ ...claim.email, messageId: `<communication-delivery.${claim.deliveryId}@${domain}>` }, { signal: controller.signal }),
        new Promise<never>((_resolve, reject) => { deadline = setTimeout(() => { controller.abort(); reject(new Error("smtp_deadline_unknown")); }, COMMUNICATION_SEND_DEADLINE_MS); }),
      ]);
      outcome = { sent: true, ...result };
    } catch (error) {
      outcome = error instanceof PermanentEmailFailure
        ? { sent: false, errorCode: error.code, permanent: true }
        : { sent: false, errorCode: "smtp_unavailable", unknown: true };
    } finally { if (deadline) clearTimeout(deadline); controller.abort(); }
    // An admission failure is a local denial, not evidence of a failed SMTP effect.
    if (!claim.claimId) { await recordCommunicationAdmissionDenied(prisma, claim, clock); count("send_admission_denied"); continue; }
    count(await completeDelivery(prisma, claim, outcome, clock));
  }
  return { examined: candidates.length, ...summary };
}
