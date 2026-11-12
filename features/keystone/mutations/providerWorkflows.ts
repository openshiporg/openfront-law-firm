import { assertCurrentCommandActor } from "./command-authority";
import { deliverWebhook } from "../webhooks/webhook-sender";
import { assertWebhookWireIdentity } from "../webhooks/wire-contract";
import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { assertCommandTarget, assertLifecycleTransition } from "../lib/lifecycles";
import { encryptSecret, secretDigest } from "../lib/secret-envelope";
import { runSerializableTransaction } from "../lib/transactions";
import {
  assertMatterAccess,
  boundedReason,
  optionalBoundedText,
  recordAuditEvent,
  requirePermission,
  workflowActor,
} from "./workflow-helpers";

function eventId(value: string) {
  const id = value?.trim();
  if (!id || id.length < 8 || id.length > 300) throw new Error("Provider event ID is invalid.");
  return id;
}

function digest(value: string | null | undefined, label: string, required = false) {
  const normalized = value?.trim() ?? "";
  if (required && !/^[a-f0-9]{64}$/i.test(normalized)) throw new Error(`${label} must be a SHA-256 digest.`);
  if (normalized && !/^[a-f0-9]{64}$/i.test(normalized)) throw new Error(`${label} must be a SHA-256 digest.`);
  return normalized || null;
}

export async function rotateIntegrationCredential(
  _root: unknown,
  args: {
    connectionId: string;
    credentialType: "credentials" | "oauth_access" | "oauth_refresh" | "webhook_secret";
    secret: string;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations", { humanOnly: true });
  if (!new Set(["credentials", "oauth_access", "oauth_refresh", "webhook_secret"]).has(args.credentialType)) {
    throw new Error("Integration credential type is unsupported.");
  }
  const field = {
    credentials: "credentialsEncrypted",
    oauth_access: "oauthAccessToken",
    oauth_refresh: "oauthRefreshToken",
    webhook_secret: "webhookSecretDigest",
  }[args.credentialType]!;
  const protectedValue = args.credentialType === "webhook_secret"
    ? secretDigest(args.secret)
    : encryptSecret(args.secret);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    const connection = await tx.integrationConnection.findFirst({ where: { id: args.connectionId, firmId } });
    if (!connection || connection.status === "revoked") {
      throw new Error("Active integration connection was not found in the selected firm.");
    }
    const updated = await tx.integrationConnection.update({
      where: { id: connection.id },
      data: { [field]: protectedValue },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "integration.credential_rotated",
      category: "integration",
      actorUserId: userId,
      metadata: { connectionId: connection.id, credentialType: args.credentialType },
    });
    return updated;
  });
}

export async function rotateWebhookSigningSecret(
  _root: unknown,
  args: { subscriptionId: string; secret: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations", { humanOnly: true });
  const secret = args.secret ?? "";
  if (secret.length < 32 || secret.length > 4096 || secret.trim() !== secret) {
    throw new Error("Webhook signing secret must be 32-4096 characters without surrounding whitespace.");
  }
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-subscription:${firmId}:${args.subscriptionId}`}))`;
    const subscription = await tx.webhookSubscription.findFirst({
      where: { id: args.subscriptionId, firmId },
      select: { id: true, status: true },
    });
    if (!subscription || subscription.status === "revoked") {
      throw new Error("Active webhook subscription was not found in the selected firm.");
    }
    const updated = await tx.webhookSubscription.update({
      where: { id: subscription.id },
      data: { signingSecretEncrypted: encryptSecret(secret), signingSecretDigest: secretDigest(secret) },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "integration.webhook_signing_secret_rotated",
      category: "integration",
      actorUserId: userId,
      metadata: { subscriptionId: subscription.id },
    });
    return updated;
  });
}

export async function transitionIntegrationConnection(
  _root: unknown,
  args: { connectionId: string; toStatus: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations", { humanOnly: true });
  const reason = boundedReason(args.reason, "Integration transition reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`integration:${firmId}:${args.connectionId}`}))`;
    const connection = await tx.integrationConnection.findFirst({ where: { id: args.connectionId, firmId } });
    if (!connection) throw new Error("Integration connection was not found in the active firm.");
    if (connection.status === args.toStatus) return { connection, replayed: true };
    assertLifecycleTransition("integrationConnection", connection.status, args.toStatus);
    const now = new Date();
    const updated = await tx.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: args.toStatus,
        ...(args.toStatus === "needs_reauth" ? { lastErrorAt: now, lastError: reason } : {}),
        ...(args.toStatus === "active" ? { lastError: "" } : {}),
        ...(args.toStatus === "revoked" ? {
          credentialsEncrypted: "",
          oauthAccessToken: "",
          oauthRefreshToken: "",
          webhookSecretDigest: "",
        } : {}),
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `integration.connection_${args.toStatus}`,
      category: "integration",
      actorUserId: userId,
      metadata: { connectionId: connection.id, fromStatus: connection.status, reasonDigest: sha256Digest(reason) },
    });
    return { connection: updated, replayed: false };
  });
}

export async function enqueueWebhookDelivery(
  _root: unknown,
  args: {
    connectionId: string;
    subscriptionId: string;
    eventId: string;
    eventType: string;
    matterId?: string | null;
    payload?: unknown;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations");
  const deliveryEventId = eventId(args.eventId);
  const eventType = optionalBoundedText(args.eventType, "Webhook event type", 300);
  if (!eventType) throw new Error("Webhook event type is required.");
  assertWebhookWireIdentity(deliveryEventId, eventType);
  const prisma = context.prisma as any;
  const created = await runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-delivery:${firmId}:${deliveryEventId}`}))`;
    const [connection, subscription] = await Promise.all([
      tx.integrationConnection.findFirst({ where: { id: args.connectionId, firmId }, select: { id: true, status: true } }),
      tx.webhookSubscription.findFirst({ where: { id: args.subscriptionId, firmId }, select: { id: true, status: true, connectionId: true, endpointUrl: true, eventTypes: true } }),
    ]);
    if (!connection || connection.status !== "active") throw new Error("Webhook delivery requires an active connection.");
    if (!subscription || subscription.status !== "active" || subscription.connectionId !== connection.id) {
      throw new Error("Webhook subscription must be active and belong to the selected connection.");
    }
    if (!Array.isArray(subscription.eventTypes) || !subscription.eventTypes.includes(eventType)) {
      throw new Error("Webhook subscription is not subscribed to this event type.");
    }
    if (args.matterId) await assertMatterAccess(tx, firmId, args.matterId, userId);
    const existing = await tx.webhookDelivery.findFirst({ where: { firmId, eventId: deliveryEventId } });
    if (existing) throw new Error("Webhook delivery event ID already exists in the active firm.");
    const delivery = await tx.webhookDelivery.create({
      data: {
        firmId, matterId: args.matterId ?? null, connectionId: connection.id,
        subscriptionId: subscription.id, eventId: deliveryEventId, eventType,
        status: "pending", payload: args.payload ?? null, destinationUrl: subscription.endpointUrl,
        attemptCount: 0,
      },
    });
    await recordAuditEvent(tx, {
      firmId, eventType: "webhook.delivery_enqueued", category: "integration",
      ...workflowActor(context, userId), matterId: args.matterId ?? null,
      metadata: { deliveryId: delivery.id, connectionId: connection.id, subscriptionId: subscription.id, authenticationType: context.session?.authenticationType ?? "human", credentialId: context.session?.credentialId ?? null, requestDigest: sha256Digest({ eventId: deliveryEventId, eventType, payload: args.payload ?? null, destinationUrl: subscription.endpointUrl }) },
    });
    return delivery;
  });
  // Sent on this request, after the record is committed. A failure stays visible for a staff Retry.
  const sent = await deliverWebhook(prisma, created.id, { actor: workflowActor(context, userId) }).catch(() => null);
  return { id: created.id, status: sent?.status ?? created.status };
}

/** Staff revoke of a webhook subscription: terminal, stops sends and drops the signing secret. */
export async function revokeWebhookSubscription(
  _root: unknown,
  args: { subscriptionId: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations", { humanOnly: true });
  const reason = boundedReason(args.reason, "Webhook revoke reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook-subscription:${firmId}:${args.subscriptionId}`}))`;
    const subscription = await tx.webhookSubscription.findFirst({ where: { id: args.subscriptionId, firmId }, select: { id: true, status: true } });
    if (!subscription) throw new Error("Webhook subscription was not found in the active firm.");
    if (subscription.status === "revoked") return { id: subscription.id, status: "revoked" };
    const updated = await tx.webhookSubscription.update({
      where: { id: subscription.id },
      data: { status: "revoked", signingSecretEncrypted: "", signingSecretDigest: "" },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "integration.webhook_subscription_revoked",
      category: "integration",
      actorUserId: userId,
      metadata: { subscriptionId: subscription.id, fromStatus: subscription.status, reasonDigest: sha256Digest(reason) },
    });
    return updated;
  });
}

/** Staff Retry for a failed, dead-lettered or interrupted webhook delivery: one more send now. */
export async function retryWebhookDelivery(
  _root: unknown,
  args: { deliveryId: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntegrations");
  const prisma = context.prisma as any;
  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: args.deliveryId, firmId }, select: { id: true, matterId: true } });
  if (!delivery) throw new Error("Webhook delivery was not found in the active firm.");
  await assertCurrentCommandActor(prisma, context, "canManageIntegrations");
  if (delivery.matterId) await assertMatterAccess(prisma, firmId, delivery.matterId, userId);
  const result = await deliverWebhook(prisma, delivery.id, { force: true, actor: workflowActor(context, userId) });
  if (result.outcome === "skipped") throw new Error(result.reason === "not_retryable" ? "This delivery is already sent or being sent." : "This delivery could not be retried.");
  return { id: delivery.id, status: result.status };
}

export async function addDocumentSigner(
  _root: unknown,
  args: {
    requestId: string;
    contactId?: string | null;
    portalAccountId?: string | null;
    name: string;
    email: string;
    signingOrder?: number | null;
    providerSignerId?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const name = optionalBoundedText(args.name, "Signer name", 300);
  const email = optionalBoundedText(args.email, "Signer email", 320);
  const providerSignerId = optionalBoundedText(args.providerSignerId, "Provider signer ID", 500);
  const signingOrder = args.signingOrder ?? 1;
  if (!name || !email || !email.includes("@")) throw new Error("Signer name and email are required.");
  if (!Number.isInteger(signingOrder) || signingOrder < 1 || signingOrder > 1000) throw new Error("Signer order is invalid.");
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-request:${firmId}:${args.requestId}`}))`;
    const request = await tx.signatureRequest.findFirst({ where: { id: args.requestId, firmId } });
    if (!request || request.status !== "draft") throw new Error("Signers may be added only before provider handoff.");
    if (request.matterId) await assertMatterAccess(tx, firmId, request.matterId, userId);
    if (args.contactId && !await tx.contact.findFirst({ where: { id: args.contactId, firmId }, select: { id: true } })) {
      throw new Error("Signer contact was not found in the active firm.");
    }
    if (args.portalAccountId && !await tx.portalAccount.findFirst({ where: { id: args.portalAccountId, firmId }, select: { id: true } })) {
      throw new Error("Signer portal account was not found in the active firm.");
    }
    const signer = await tx.documentSigner.create({
      data: {
        firmId,
        matterId: request.matterId,
        requestId: request.id,
        contactId: args.contactId ?? null,
        portalAccountId: args.portalAccountId ?? null,
        name,
        email,
        signingOrder,
        status: "pending",
        providerSignerId: providerSignerId ?? "",
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "signature.signer_added",
      category: "integration",
      actorUserId: userId,
      matterId: request.matterId,
      metadata: { requestId: request.id, signerId: signer.id, identityDigest: sha256Digest({ name, email, signingOrder }) },
    });
    return signer;
  });
}

export async function transitionDocumentSigner(
  _root: unknown,
  args: {
    signerId: string;
    toStatus: "viewed" | "signed" | "declined";
    providerEventId: string;
    evidenceDigest: string;
  },
  context: Context,
) {
  requirePermission(context, "canManageDocuments", { humanOnly: true });
  throw new Error("Signature signer certification is unavailable until authenticated provider ingress is configured.");
  const { firmId, userId } = requirePermission(context, "canManageDocuments");
  const providerEventId = eventId(args.providerEventId);
  const evidenceDigest = digest(args.evidenceDigest, "Signature evidence digest", true)!;
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature:${firmId}:${providerEventId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document-signer:${firmId}:${args.signerId}`}))`;
    const replay = await tx.signatureEvent.findFirst({ where: { firmId, providerEventId } });
    const signerIdentity = await tx.documentSigner.findFirst({ where: { id: args.signerId, firmId }, select: { requestId: true } });
    if (!signerIdentity) throw new Error("Document signer was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-request:${firmId}:${signerIdentity.requestId}`}))`;
    const signer = await tx.documentSigner.findFirst({
      where: { id: args.signerId, firmId },
      include: { request: true },
    });
    if (!signer) throw new Error("Document signer was not found in the active firm.");
    if (signer.matterId) await assertMatterAccess(tx, firmId, signer.matterId, userId);
    if (replay) {
      if (
        replay.signerId !== signer.id ||
        replay.requestId !== signer.requestId ||
        replay.eventType !== `signer.${args.toStatus}` ||
        replay.evidence?.digest !== evidenceDigest
      ) {
        throw new Error("Signer provider event ID was reused with a different payload.");
      }
      return { request: signer.request, signer, event: replay, replayed: true };
    }
    if (!new Set(["sent", "partially_signed"]).has(signer.request.status)) {
      throw new Error("Signer evidence requires a signature request that has been sent.");
    }
    assertLifecycleTransition("signer", signer.status, args.toStatus);
    const now = new Date();
    const updated = await tx.documentSigner.update({
      where: { id: signer.id },
      data: {
        status: args.toStatus,
        ...(args.toStatus === "viewed" ? { viewedAt: now } : {}),
        ...(args.toStatus === "signed" ? { signedAt: now } : {}),
        ...(args.toStatus === "declined" ? { declinedAt: now } : {}),
      },
    });
    const signatureEvent = await tx.signatureEvent.create({
      data: {
        firmId,
        matterId: signer.matterId,
        requestId: signer.requestId,
        signerId: signer.id,
        eventType: `signer.${args.toStatus}`,
        providerEventId,
        occurredAt: now,
        evidence: { digest: evidenceDigest },
      },
    });
    return { request: signer.request, signer: updated, event: signatureEvent, replayed: false };
  });
}

export async function transitionSignatureRequest(
  _root: unknown,
  args: {
    requestId: string;
    toStatus: "sent" | "partially_signed" | "completed" | "declined" | "expired" | "cancelled";
    providerEventId: string;
    actorReference?: string | null;
    evidenceDigest: string;
  },
  context: Context,
) {
  const { session, firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  if (args.toStatus !== "cancelled") {
    throw new Error("Signature provider outcomes are unavailable until authenticated provider ingress is configured.");
  }
  const providerEventId = eventId(args.providerEventId);
  const actorReference = optionalBoundedText(args.actorReference, "Signature actor reference", 500);
  const evidenceDigest = digest(args.evidenceDigest, "Signature evidence digest", true)!;
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature:${firmId}:${providerEventId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-request:${firmId}:${args.requestId}`}))`;
    const replay = await tx.signatureEvent.findFirst({ where: { firmId, providerEventId } });
    const request = await tx.signatureRequest.findFirst({
      where: { id: args.requestId, firmId },
      include: { signers: { select: { id: true, status: true } } },
    });
    if (!request) throw new Error("Signature request was not found in the active firm.");
    if (request.matterId) await assertMatterAccess(tx, firmId, request.matterId, userId);
    if (replay) {
      if (
        replay.requestId !== args.requestId ||
        replay.signerId != null ||
        replay.eventType !== `signature.${args.toStatus}` ||
        replay.actorReference !== (actorReference ?? "") ||
        replay.evidence?.digest !== evidenceDigest
      ) {
        throw new Error("Signature provider event ID was reused with a different payload.");
      }
      return { request, event: replay, replayed: true };
    }
    assertLifecycleTransition("signatureRequest", request.status, args.toStatus);
    const signerStatuses = request.signers.map((signer: any) => signer.status);
    if (args.toStatus === "sent" && signerStatuses.length === 0) {
      throw new Error("Sending a signature request requires at least one immutable signer.");
    }
    if (args.toStatus === "partially_signed" && (!signerStatuses.includes("signed") || signerStatuses.every((status: string) => status === "signed"))) {
      throw new Error("A partially signed request requires some, but not all, signers to be signed.");
    }
    if (args.toStatus === "completed" && (!signerStatuses.length || signerStatuses.some((status: string) => status !== "signed"))) {
      throw new Error("Completing a signature request requires every signer to have controlled signed evidence.");
    }
    if (args.toStatus === "declined" && !signerStatuses.includes("declined")) {
      throw new Error("Declining a signature request requires controlled signer decline evidence.");
    }
    const now = new Date();
    const updated = await tx.signatureRequest.update({
      where: { id: request.id },
      data: {
        status: args.toStatus,
        ...(args.toStatus === "sent" ? { sentAt: now } : {}),
        ...(args.toStatus === "completed" ? { completedAt: now } : {}),
      },
    });
    const signatureEvent = await tx.signatureEvent.create({
      data: {
        firmId,
        matterId: request.matterId,
        requestId: request.id,
        eventType: `signature.${args.toStatus}`,
        providerEventId,
        actorReference: actorReference ?? "",
        occurredAt: now,
        evidence: { digest: evidenceDigest },
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `signature.${args.toStatus}`,
      category: "integration",
      ...workflowActor(context, userId),
      matterId: request.matterId,
      metadata: {
        signatureRequestId: request.id,
        signatureEventId: signatureEvent.id,
        evidenceDigest,
        credentialId: session.credentialId ?? null,
      },
    });
    return { request: updated, event: signatureEvent, replayed: false };
  });
}

export async function transitionDocument(
  _root: unknown,
  args: { documentId: string; toStatus: "active" | "archived"; reason: string },
  context: Context,
) {
  assertCommandTarget("document", args.toStatus, ["active", "archived"]);
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const reason = boundedReason(args.reason, "Document transition reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document:${firmId}:${args.documentId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`retention-document:${firmId}:${args.documentId}`}))`;
    const document = await tx.document.findFirst({ where: { id: args.documentId, firmId } });
    if (!document) throw new Error("Document was not found in the active firm.");
    if (document.matterId) await assertMatterAccess(tx, firmId, document.matterId, userId);
    if (document.status === args.toStatus) return { document, replayed: true };
    assertLifecycleTransition("document", document.status, args.toStatus);
    if (args.toStatus === "active" && !document.currentVersionId) {
      throw new Error("Publishing a document requires an immutable current version.");
    }
    const now = new Date();
    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        status: args.toStatus,
        archivedAt: args.toStatus === "archived" ? now : null,
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `document.${args.toStatus}`,
      category: "legal_workflow",
      actorUserId: userId,
      matterId: document.matterId,
      documentId: document.id,
      metadata: { fromStatus: document.status, reasonDigest: sha256Digest(reason) },
    });
    return { document: updated, replayed: false };
  });
}
