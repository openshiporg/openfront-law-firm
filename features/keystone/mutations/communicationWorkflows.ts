import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { runSerializableTransaction } from "../lib/transactions";
import { boundPortalShare, portalShareCandidateWhere, portalShareHeaderSelect, portalShareIsCurrent } from "../lib/portal-share-binding";
import { assertCurrentCommandActor, type AuthorityContext } from "./command-authority";
import { loadActiveHumanSession } from "../lib/machine-auth";
import type { Session } from "../access";
import {
  assertMatterAccess,
  boundedReason,
  recordAuditEvent,
  requirePermission,
  workflowActor,
} from "./workflow-helpers";

export const COMMUNICATION_DELIVERY_SNAPSHOT_VERSION = 1;
const MAX_RECIPIENTS = 50;
const participantRoles = new Set(["staff", "client", "external_counsel", "third_party"]);
const singleEmailAddress = /^[^\s@<>,;()"]+@[^\s@<>,;()"]+\.[^\s@<>,;()"]+$/;

export function isSingleEmailAddress(value: string | null | undefined) {
  return Boolean(value && value.length <= 254 && singleEmailAddress.test(value));
}

/** The digest the outbox re-checks before sending: the queued envelope cannot drift. */
export function communicationEnvelopeDigest(message: { subject?: string | null; body?: string | null }) {
  return sha256Digest({ subject: message.subject ?? "", body: message.body ?? "" });
}

export function communicationQueueDigest(message: any, deliveries: any[]) {
  return sha256Digest({ messageId: message.id, firmId: message.firmId, matterId: message.matterId ?? null,
    threadId: message.threadId, envelopeDigest: communicationEnvelopeDigest(message),
    deliveries: deliveries.map(delivery => ({ id: delivery.id, channel: delivery.channel, provider: delivery.provider,
      integrationConnectionId: delivery.integrationConnectionId ?? null, recipientAddress: delivery.recipientAddress,
      participantId: delivery.providerMetadata?.participantId ?? null,
      envelopeDigest: delivery.providerMetadata?.envelopeDigest ?? null,
      snapshotVersion: delivery.providerMetadata?.snapshotVersion ?? null,
      attachments: delivery.providerMetadata?.attachments ?? [],
    })).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

/** Queue provenance is mandatory. A creator ID or eligible recipient alone is
 * not authority to send. Legacy intents without this binding require review. */
export async function assertCurrentCommunicationOrigin(tx: any, message: any) {
  const origin = await tx.auditEvent.findFirst({ where: { firmId: message.firmId, eventType: "communication.message_queued", metadata: { path: ["messageId"], equals: message.id } } });
  const deliveries = await tx.communicationDelivery.findMany({ where: { messageId: message.id } });
  if (!origin?.actorUserId || origin.actorAgentId || origin.actorType !== "user" || origin.metadata?.authenticationType !== "human" || origin.metadata?.requestDigest !== communicationQueueDigest(message, deliveries)) throw new Error("Original queue intent requires review.");
  // Only the audited human-only queue operation can establish this provenance;
  // reload its current identity/role, never upgrade a machine from its owner ID.
  const current = await loadActiveHumanSession(tx, origin.actorUserId, message.firmId);
  if (!current) throw new Error("Original sender authority is no longer current.");
  const withSession = (session: Session): AuthorityContext => ({ session, withSession });
  await assertCurrentCommandActor(tx, withSession(current), "canManageCommunications");
  if (message.matterId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-team:${message.firmId}:${message.matterId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${message.firmId}:${message.matterId}`}))`;
    await tx.$executeRaw`SELECT id FROM "Matter" WHERE id = ${message.matterId} AND firm = ${message.firmId} FOR SHARE`;
    await assertCurrentCommandActor(tx, withSession(current), "canReadMatters");
    await assertMatterAccess(tx, message.firmId, message.matterId, current.itemId);
  }
}

async function lockThread(tx: any, firmId: string, threadId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`communication-thread:${firmId}:${threadId}`}))`;
}

type ParticipantIdentity = {
  userId?: string;
  contactId?: string | null;
  portalAccountId?: string;
  displayAddress: string;
};

async function resolveParticipantIdentity(
  tx: any,
  firmId: string,
  thread: { id: string; matterId: string | null },
  args: { participantRole: string; userId?: string | null; contactId?: string | null; portalAccountId?: string | null; contactMethodId?: string | null; address?: string },
): Promise<ParticipantIdentity> {
  const identities = [args.userId, args.contactId, args.portalAccountId].filter(Boolean);
  if (identities.length !== 1) throw new Error("Choose exactly one staff member, contact or portal account.");
  if (args.contactMethodId && !args.contactId) throw new Error("A contact method can be chosen only for a contact participant.");

  if (args.userId) {
    if (args.participantRole !== "staff") throw new Error("Firm users can join a thread only as staff.");
    const membership = await tx.firmMembership.findFirst({
      where: { firmId, userId: args.userId, status: "active", user: { status: "active" }, role: { firmId, status: "active", canReadCommunications: true, ...(thread.matterId ? { canReadMatters: true } : {}) } },
      select: { user: { select: { email: true } } },
    });
    if (!membership) throw new Error("Staff participant must be an active member of the active firm.");
    // The participant inherits the thread; walls and restricted-team rules apply to them too.
    if (thread.matterId) await assertMatterAccess(tx, firmId, thread.matterId, args.userId);
    return { userId: args.userId, displayAddress: membership.user?.email ?? "" };
  }

  if (args.participantRole === "staff") throw new Error("Staff participants must be firm users.");

  if (args.portalAccountId) {
    if (args.participantRole !== "client") throw new Error("Portal accounts can join a thread only as clients.");
    const account = await tx.portalAccount.findFirst({
      where: { id: args.portalAccountId, firmId, status: "active" },
      select: { id: true, email: true, contactId: true, contact: { select: { firmId: true, status: true } } },
    });
    if (!account || account.contact?.firmId !== firmId || account.contact.status === "archived" || !thread.matterId) throw new Error("Portal participant must be a current account/contact on this matter.");
    const identity = { firmId, portalAccountId: account.id, contactId: account.contactId };
    let after: string | undefined;
    let admitted = false;
    for (let page = 0; page < 32 && !admitted; page++) {
      const shares = await tx.portalShare.findMany({
        where: { ...portalShareCandidateWhere(identity, new Date()), matterId: thread.matterId, resourceType: "communication_thread", communicationThreadId: thread.id, ...(after ? { id: { gt: after } } : {}) },
        select: portalShareHeaderSelect, orderBy: { id: "asc" }, take: 32,
      });
      for (const candidate of shares) {
        const share = boundPortalShare(candidate, identity);
        if (share && await portalShareIsCurrent(tx, share)) { admitted = true; break; }
      }
      if (shares.length < 32) break;
      after = shares[shares.length - 1].id;
    }
    if (!admitted) throw new Error("Portal recipient needs a current message-capable share of this exact thread.");
    return { portalAccountId: account.id, contactId: account.contactId ?? null, displayAddress: account.email ?? "" };
  }

  const contact = await tx.contact.findFirst({
    where: { id: args.contactId, firmId, status: { not: "archived" } },
    select: { id: true, primaryEmail: true },
  });
  if (!contact) throw new Error("Contact participant must be an active contact in the active firm.");
  if (args.contactMethodId) {
    const method = await tx.contactMethod.findFirst({
      where: { id: args.contactMethodId, firmId, contactId: contact.id, methodType: "email", canContact: true },
      select: { value: true },
    });
    if (!method) throw new Error("Contact method must be a contactable email address of this contact.");
    return { contactId: contact.id, displayAddress: method.value };
  }
  const method = await tx.contactMethod.findFirst({
    where: { firmId, contactId: contact.id, methodType: "email", value: args.address ?? contact.primaryEmail, canContact: true }, select: { value: true },
  });
  if (!method) throw new Error("Choose a currently contactable email method before preparing this recipient.");
  return { contactId: contact.id, displayAddress: method.value };
}

/** Recheck the exact recipient at EVERY preparation/queue/claim/send boundary.
 * A frozen address is evidence of intent, never continuing disclosure authority. */
export async function assertCurrentCommunicationRecipient(tx: any, message: { firmId: string; threadId: string; matterId: string | null }, participantId: string, expectedAddress?: string) {
  await tx.$executeRaw`SELECT id FROM "Firm" WHERE id = ${message.firmId} FOR SHARE`;
  await tx.$executeRaw`SELECT id FROM "CommunicationThread" WHERE id = ${message.threadId} AND firm = ${message.firmId} FOR SHARE`;
  await tx.$executeRaw`SELECT id FROM "CommunicationParticipant" WHERE id = ${participantId} AND firm = ${message.firmId} FOR SHARE`;
  if (message.matterId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-team:${message.firmId}:${message.matterId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ethical-wall-matter:${message.firmId}:${message.matterId}`}))`;
    await tx.$executeRaw`SELECT id FROM "Matter" WHERE id = ${message.matterId} AND firm = ${message.firmId} FOR SHARE`;
  }
  const thread = await tx.communicationThread.findFirst({
    where: { id: message.threadId, firmId: message.firmId, matterId: message.matterId, status: "open", firm: { status: "active" } },
    select: { id: true, matterId: true },
  });
  const participant = await tx.communicationParticipant.findFirst({
    where: { id: participantId, firmId: message.firmId, threadId: message.threadId, matterId: message.matterId, status: "active" },
  });
  if (!thread || !participant) throw new Error("Recipient or thread is no longer available.");
  if (participant.userId) {
    await tx.$executeRaw`SELECT u.id FROM "User" u JOIN "FirmMembership" m ON m."user" = u.id JOIN "Role" r ON r.id = m.role AND r.firm = m.firm WHERE u.id = ${participant.userId} AND m.firm = ${message.firmId} FOR SHARE OF u,m,r`;
  }
  if (participant.portalAccountId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${message.firmId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${message.firmId}:${participant.portalAccountId}`}))`;
    await tx.$executeRaw`SELECT id FROM "PortalAccount" WHERE id = ${participant.portalAccountId} AND firm = ${message.firmId} FOR SHARE`;
  }
  if (participant.contactId) {
    await tx.$executeRaw`SELECT id FROM "Contact" WHERE id = ${participant.contactId} AND firm = ${message.firmId} FOR SHARE`;
    await tx.$executeRaw`SELECT id FROM "ContactMethod" WHERE contact = ${participant.contactId} AND firm = ${message.firmId} ORDER BY id FOR SHARE`;
  }
  const current = await resolveParticipantIdentity(tx, message.firmId, thread, {
    participantRole: participant.participantRole, userId: participant.userId,
    portalAccountId: participant.portalAccountId, contactId: participant.portalAccountId ? undefined : participant.contactId, address: expectedAddress ?? participant.displayAddress,
  });
  const address = expectedAddress ?? participant.displayAddress;
  if (!isSingleEmailAddress(current.displayAddress) || current.displayAddress !== address) throw new Error("Recipient address or contactability changed; prepare a new reviewed envelope.");
  return participant;
}

export async function addCommunicationParticipant(
  _root: unknown,
  args: {
    threadId: string;
    participantRole: string;
    userId?: string | null;
    contactId?: string | null;
    portalAccountId?: string | null;
    contactMethodId?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageCommunications", { humanOnly: true });
  if (!participantRoles.has(args.participantRole)) throw new Error("Participant role is not available through this command.");
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    await lockThread(tx, firmId, args.threadId);
    const thread = await tx.communicationThread.findFirst({
      where: { id: args.threadId, firmId },
      select: { id: true, status: true, matterId: true },
    });
    if (!thread) throw new Error("Communication thread was not found in the active firm.");
    if (thread.matterId) await assertMatterAccess(tx, firmId, thread.matterId, userId);
    if (thread.status !== "open") throw new Error("Participants can be added only to open threads.");
    const identity = await resolveParticipantIdentity(tx, firmId, thread, args);
    const existing = await tx.communicationParticipant.findFirst({
      where: {
        firmId,
        threadId: thread.id,
        status: "active",
        userId: identity.userId ?? null,
        contactId: identity.contactId ?? null,
        portalAccountId: identity.portalAccountId ?? null,
      },
    });
    if (existing) {
      if (existing.participantRole !== args.participantRole) {
        throw new Error("This identity already participates in the thread with a different role.");
      }
      await assertCurrentCommunicationRecipient(tx, { firmId, threadId: thread.id, matterId: thread.matterId }, existing.id, existing.displayAddress);
      return { participant: existing, replayed: true };
    }
    const participant = await tx.communicationParticipant.create({
      data: {
        firmId,
        matterId: thread.matterId ?? null,
        threadId: thread.id,
        userId: identity.userId ?? null,
        contactId: identity.contactId ?? null,
        portalAccountId: identity.portalAccountId ?? null,
        participantRole: args.participantRole,
        status: "active",
        displayAddress: identity.displayAddress,
        addedAt: new Date(),
      },
    });
    await assertCurrentCommunicationRecipient(tx, { firmId, threadId: thread.id, matterId: thread.matterId }, participant.id, participant.displayAddress);
    await recordAuditEvent(tx, {
      firmId,
      eventType: "communication.participant_added",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: thread.matterId ?? null,
      contactId: identity.contactId ?? null,
      metadata: {
        threadId: thread.id,
        participantId: participant.id,
        participantRole: args.participantRole,
        identityDigest: sha256Digest({ ...identity, participantRole: args.participantRole }),
      },
    });
    return { participant, replayed: false };
  });
}

export async function removeCommunicationParticipant(
  _root: unknown,
  args: { participantId: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageCommunications", { humanOnly: true });
  const reason = boundedReason(args.reason, "Participant removal reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    const identity = await tx.communicationParticipant.findFirst({
      where: { id: args.participantId, firmId },
      select: { threadId: true },
    });
    if (!identity) throw new Error("Communication participant was not found in the active firm.");
    await lockThread(tx, firmId, identity.threadId);
    const participant = await tx.communicationParticipant.findFirst({ where: { id: args.participantId, firmId } });
    if (!participant) throw new Error("Communication participant was not found in the active firm.");
    if (participant.matterId) await assertMatterAccess(tx, firmId, participant.matterId, userId);
    if (participant.status === "removed") return { participant, replayed: true };
    const removed = await tx.communicationParticipant.update({
      where: { id: participant.id },
      data: { status: "removed", removedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "communication.participant_removed",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: participant.matterId ?? null,
      contactId: participant.contactId ?? null,
      metadata: { threadId: participant.threadId, participantId: participant.id, reasonDigest: sha256Digest(reason) },
    });
    return { participant: removed, replayed: false };
  });
}

/**
 * Human-reviewed envelope preparation. Each pending delivery snapshots the
 * resolved destination, the exact envelope digest and attachment versions so
 * the outbox can refuse to send anything that drifted after approval.
 */
export async function prepareCommunicationDeliveries(
  _root: unknown,
  args: { messageId: string; participantIds: string[]; integrationConnectionId?: string | null; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageCommunications", { humanOnly: true });
  const reason = boundedReason(args.reason, "Delivery preparation reason", 5, 2000);
  const participantIds = [...new Set((args.participantIds ?? []).map((id) => id?.trim()).filter(Boolean))].sort();
  if (!participantIds.length || participantIds.length > MAX_RECIPIENTS) {
    throw new Error(`Choose between 1 and ${MAX_RECIPIENTS} thread participants.`);
  }
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageCommunications");
    // Same lock as queueCommunicationMessage: preparation and queueing are serialized.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`message:${firmId}:${args.messageId}`}))`;
    const message = await tx.communicationMessage.findFirst({
      where: { id: args.messageId, firmId },
      include: {
        attachments: {
          select: { id: true, firmId: true, checksumSha256: true, byteSize: true, document: { select: { matterId: true, status: true } } },
        },
        deliveries: { select: { id: true, status: true, providerMetadata: true } },
      },
    });
    if (!message) throw new Error("Communication message was not found in the active firm.");
    if (message.matterId) await assertMatterAccess(tx, firmId, message.matterId, userId);
    if (message.status !== "draft") throw new Error("Deliveries can be prepared only for draft messages.");
    if (message.direction !== "outbound") throw new Error("Only outbound messages have deliveries.");
    if (message.channel !== "email") {
      throw new Error("Only email delivery preparation is available; portal and SMS delivery adapters are not configured.");
    }
    if (message.deliveries.some((delivery: any) => delivery.status !== "pending")) {
      throw new Error("A message with delivery outcomes cannot be re-prepared.");
    }
    await lockThread(tx, firmId, message.threadId);
    const participants = await tx.communicationParticipant.findMany({
      where: { id: { in: participantIds }, firmId, threadId: message.threadId, status: "active" },
      select: { id: true, userId: true, contactId: true, portalAccountId: true, displayAddress: true },
      orderBy: { id: "asc" },
    });
    if (participants.length !== participantIds.length) {
      throw new Error("Every recipient must be an active participant of this message's thread.");
    }
    for (const participant of participants) {
      if (!isSingleEmailAddress(participant.displayAddress)) {
        throw new Error("Every email recipient needs one valid email address on the thread participant.");
      }
      await assertCurrentCommunicationRecipient(tx, message, participant.id, participant.displayAddress);
    }
    const attachments = message.attachments.map((attachment: any) => {
      if (
        attachment.firmId !== firmId ||
        attachment.document?.status === "disposed" ||
        (message.matterId && attachment.document?.matterId !== message.matterId)
      ) {
        throw new Error("Attachments must be current versions from this firm and matter.");
      }
      return { versionId: attachment.id, checksumSha256: attachment.checksumSha256, byteSize: attachment.byteSize };
    }).sort((left: any, right: any) => left.versionId.localeCompare(right.versionId));

    let connection: { id: string; provider: string } | null = null;
    if (args.integrationConnectionId) {
      connection = await tx.integrationConnection.findFirst({
        where: { id: args.integrationConnectionId, firmId, status: "active", category: "email" },
        select: { id: true, provider: true },
      });
      if (!connection) throw new Error("Delivery connection must be an active email integration in the active firm.");
    }
    const provider = connection?.provider ?? "smtp";
    const envelopeDigest = communicationEnvelopeDigest(message);
    const snapshots = participants.map((participant: any) => ({
      snapshotVersion: COMMUNICATION_DELIVERY_SNAPSHOT_VERSION,
      participantId: participant.id,
      envelopeDigest,
      attachments,
      destination: { channel: "email", provider, connectionId: connection?.id ?? null },
    }));
    const preparationDigest = sha256Digest({
      messageId: message.id,
      snapshots,
      recipients: participants.map((participant: any) => participant.displayAddress),
    });
    if (
      message.deliveries.length === snapshots.length &&
      message.deliveries.every((delivery: any) => delivery.providerMetadata?.preparationDigest === preparationDigest)
    ) {
      return { message, deliveries: message.deliveries, replayed: true };
    }
    // Draft-only replacement: nothing has been queued, sent or attempted yet.
    const replaced = message.deliveries.length;
    if (replaced) await tx.communicationDelivery.deleteMany({ where: { firmId, messageId: message.id, status: "pending" } });
    const deliveries = [];
    for (const [index, participant] of participants.entries()) {
      deliveries.push(await tx.communicationDelivery.create({
        data: {
          firmId,
          matterId: message.matterId ?? null,
          messageId: message.id,
          integrationConnectionId: connection?.id ?? null,
          channel: "email",
          status: "pending",
          recipientContactId: participant.contactId ?? null,
          recipientAddress: participant.displayAddress,
          provider,
          attemptCount: 0,
          providerMetadata: { ...snapshots[index], preparationDigest },
        },
      }));
    }
    await recordAuditEvent(tx, {
      firmId,
      eventType: "communication.deliveries_prepared",
      category: "integration",
      ...workflowActor(context, userId),
      matterId: message.matterId ?? null,
      metadata: {
        messageId: message.id,
        deliveryCount: deliveries.length,
        replacedPendingCount: replaced,
        preparationDigest,
        reasonDigest: sha256Digest(reason),
      },
    });
    return { message, deliveries, replayed: false };
  });
}
