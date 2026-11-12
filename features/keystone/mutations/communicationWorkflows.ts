import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { runSerializableTransaction } from "../lib/transactions";
import { boundPortalShare, portalShareCandidateWhere, portalShareHeaderSelect, portalShareIsCurrent } from "../lib/portal-share-binding";
import { assertCurrentCommandActor } from "./command-authority";
import {
  assertMatterAccess,
  boundedReason,
  recordAuditEvent,
  requirePermission,
  workflowActor,
} from "./workflow-helpers";

const participantRoles = new Set(["staff", "client", "external_counsel", "third_party"]);
const singleEmailAddress = /^[^\s@<>,;()"]+@[^\s@<>,;()"]+\.[^\s@<>,;()"]+$/;

export function isSingleEmailAddress(value: string | null | undefined) {
  return Boolean(value && value.length <= 254 && singleEmailAddress.test(value));
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
