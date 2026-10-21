import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { evaluateRetentionDisposal } from "../lib/retention";
import { runSerializableTransaction } from "../lib/transactions";
import {
  assertMatterAccess,
  boundedReason,
  recordAuditEvent,
  requirePermission,
} from "./workflow-helpers";

async function lockRetentionResources(
  tx: any,
  firmId: string,
  targets: { policyId?: string | null; matterId?: string | null; contactId?: string | null; documentId?: string | null },
) {
  const keys = [
    targets.policyId ? `retention-policy:${firmId}:${targets.policyId}` : null,
    targets.matterId ? `retention-matter:${firmId}:${targets.matterId}` : null,
    targets.contactId ? `retention-contact:${firmId}:${targets.contactId}` : null,
    targets.documentId ? `retention-document:${firmId}:${targets.documentId}` : null,
  ].filter(Boolean).sort() as string[];
  for (const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export async function transitionRetentionPolicy(
  _root: unknown,
  args: { policyId: string; toStatus: "active" | "retired"; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const reason = boundedReason(args.reason, "Retention policy transition reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    await lockRetentionResources(tx, firmId, { policyId: args.policyId });
    const policy = await tx.retentionPolicy.findFirst({ where: { id: args.policyId, firmId } });
    if (!policy) throw new Error("Retention policy was not found in the active firm.");
    if (policy.status === args.toStatus) return { policy, replayed: true };
    assertLifecycleTransition("retentionPolicy", policy.status, args.toStatus);
    const updated = await tx.retentionPolicy.update({ where: { id: policy.id }, data: { status: args.toStatus } });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `retention.policy_${args.toStatus}`,
      category: "retention",
      actorUserId: userId,
      metadata: {
        policyId: policy.id,
        fromStatus: policy.status,
        toStatus: args.toStatus,
        policyTermsDigest: sha256Digest({
          code: policy.code,
          recordClass: policy.recordClass,
          trigger: policy.trigger,
          retentionDays: policy.retentionDays,
          practiceAreaId: policy.practiceAreaId,
          jurisdictionReference: policy.jurisdictionReference,
        }),
        reasonDigest: sha256Digest(reason),
      },
    });
    return { policy: updated, replayed: false };
  });
}

export async function assignDocumentRetentionPolicy(
  _root: unknown,
  args: { documentId: string; policyId: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  requirePermission(context, "canManageDocuments", { humanOnly: true });
  const reason = boundedReason(args.reason, "Retention policy assignment reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    const reference = await tx.document.findFirst({
      where: { id: args.documentId, firmId },
      select: { id: true, matterId: true },
    });
    if (!reference) throw new Error("Document was not found in the active firm.");
    await lockRetentionResources(tx, firmId, {
      policyId: args.policyId,
      documentId: reference.id,
      matterId: reference.matterId,
    });
    const [document, policy] = await Promise.all([
      tx.document.findFirst({ where: { id: reference.id, firmId } }),
      tx.retentionPolicy.findFirst({ where: { id: args.policyId, firmId, status: "active" } }),
    ]);
    if (!document || document.matterId !== reference.matterId) {
      throw new Error("Document retention scope changed concurrently; reload before retrying.");
    }
    if (document.matterId) await assertMatterAccess(tx, firmId, document.matterId, userId);
    if (!policy) throw new Error("Only an active retention policy can be assigned.");
    if (["archived", "disposed"].includes(document.status)) {
      throw new Error("A document retention policy is frozen after archival.");
    }
    if (document.retentionPolicyId === policy.id) return { document, replayed: true };
    const updated = await tx.document.update({ where: { id: document.id }, data: { retentionPolicyId: policy.id } });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "retention.document_policy_assigned",
      category: "retention",
      actorUserId: userId,
      matterId: document.matterId,
      documentId: document.id,
      metadata: {
        policyId: policy.id,
        priorPolicyId: document.retentionPolicyId,
        policyTermsDigest: sha256Digest({
          code: policy.code,
          trigger: policy.trigger,
          retentionDays: policy.retentionDays,
          jurisdictionReference: policy.jurisdictionReference,
        }),
        reasonDigest: sha256Digest(reason),
      },
    });
    return { document: updated, replayed: false };
  });
}

export async function placeRetentionHold(
  _root: unknown,
  args: {
    policyId?: string | null;
    matterId?: string | null;
    documentId?: string | null;
    contactId?: string | null;
    name: string;
    reason: string;
    authorityReference?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const name = boundedReason(args.name, "Hold name", 3, 300);
  const reason = boundedReason(args.reason, "Hold reason", 10, 4000);
  const authorityReference = args.authorityReference?.trim() || "";
  if (authorityReference.length > 1000) throw new Error("Hold authority reference is too long.");
  if (!args.matterId && !args.documentId && !args.contactId) throw new Error("A retention hold requires a matter, document, or contact target.");
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    const preliminaryDocument = args.documentId
      ? await tx.document.findFirst({ where: { id: args.documentId, firmId }, select: { id: true, matterId: true, contactId: true } })
      : null;
    if (args.documentId && !preliminaryDocument) throw new Error("Hold document was not found in the active firm.");
    if (preliminaryDocument && args.matterId && args.matterId !== preliminaryDocument.matterId) {
      throw new Error("Hold matter must match the selected document.");
    }
    if (preliminaryDocument && args.contactId && args.contactId !== preliminaryDocument.contactId) {
      throw new Error("Hold contact must match the selected document.");
    }
    const canonicalTargets = {
      matterId: preliminaryDocument?.matterId ?? args.matterId ?? null,
      contactId: args.contactId ?? null,
      documentId: args.documentId ?? null,
    };
    await lockRetentionResources(tx, firmId, canonicalTargets);
    const [matter, document, contact, policy] = await Promise.all([
      canonicalTargets.matterId ? tx.matter.findFirst({ where: { id: canonicalTargets.matterId, firmId }, select: { id: true } }) : null,
      args.documentId ? tx.document.findFirst({ where: { id: args.documentId, firmId }, select: { id: true, matterId: true, contactId: true, status: true } }) : null,
      canonicalTargets.contactId ? tx.contact.findFirst({ where: { id: canonicalTargets.contactId, firmId }, select: { id: true } }) : null,
      args.policyId ? tx.retentionPolicy.findFirst({ where: { id: args.policyId, firmId }, select: { id: true } }) : null,
    ]);
    if (canonicalTargets.matterId && !matter) throw new Error("Hold matter was not found in the active firm.");
    if (args.documentId && (!document || document.matterId !== canonicalTargets.matterId || (args.contactId && document.contactId !== args.contactId))) {
      throw new Error("Hold document scope changed while the hold was being placed.");
    }
    if (document?.status === "disposed") throw new Error("A hold cannot be placed after document disposal.");
    if (canonicalTargets.contactId && !contact) throw new Error("Hold contact was not found in the active firm.");
    if (args.policyId && !policy) throw new Error("Hold policy was not found in the active firm.");
    const matterId = canonicalTargets.matterId;
    if (matterId) await assertMatterAccess(tx, firmId, matterId, userId);
    const now = new Date();
    const hold = await tx.retentionHold.create({
      data: {
        firmId,
        policyId: args.policyId ?? null,
        matterId,
        documentId: args.documentId ?? null,
        contactId: canonicalTargets.contactId,
        name,
        status: "active",
        reason,
        authorityReference,
        createdById: userId,
        effectiveAt: now,
      },
    });
    const action = await tx.retentionAction.create({
      data: {
        firmId, policyId: args.policyId ?? null, holdId: hold.id, actionType: "hold_applied",
        resourceType: args.documentId ? "document" : args.contactId ? "contact" : "matter",
        matterId, documentId: args.documentId ?? null, contactId: canonicalTargets.contactId,
        performedById: userId, approvedById: userId, occurredAt: now,
        evidenceDigest: sha256Digest({ holdId: hold.id, matterId, documentId: args.documentId ?? null, contactId: args.contactId ?? null, reason }),
        metadata: { authorityReferenceDigest: authorityReference ? sha256Digest(authorityReference) : null },
      },
    });
    await recordAuditEvent(tx, {
      firmId, eventType: "retention.hold_applied", category: "retention", actorUserId: userId,
      matterId, contactId: canonicalTargets.contactId, documentId: args.documentId ?? null,
      metadata: { holdId: hold.id, retentionActionId: action.id },
    });
    return { hold, action };
  });
}

export async function releaseRetentionHold(
  _root: unknown,
  args: { holdId: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const reason = boundedReason(args.reason, "Hold release reason", 10, 4000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`retention-hold:${firmId}:${args.holdId}`}))`;
    const hold = await tx.retentionHold.findFirst({ where: { id: args.holdId, firmId } });
    if (!hold) throw new Error("Retention hold was not found in the active firm.");
    if (hold.matterId) await assertMatterAccess(tx, firmId, hold.matterId, userId);
    if (hold.status === "released") return { hold, replayed: true };
    assertLifecycleTransition("retentionHold", hold.status, "released");
    const now = new Date();
    const released = await tx.retentionHold.update({
      where: { id: hold.id },
      data: {
        status: "released",
        releasedById: userId,
        releasedAt: now,
        releaseReason: reason,
      },
    });
    const action = await tx.retentionAction.create({
      data: {
        firmId,
        policyId: hold.policyId,
        holdId: hold.id,
        actionType: "hold_released",
        resourceType: hold.documentId ? "document" : hold.contactId ? "contact" : "matter",
        matterId: hold.matterId,
        documentId: hold.documentId,
        contactId: hold.contactId,
        performedById: userId,
        approvedById: userId,
        evidenceDigest: sha256Digest({
          holdId: hold.id,
          reason,
          releasedAt: now.toISOString(),
          releasedBy: userId,
        }),
        occurredAt: now,
        metadata: { reasonDigest: sha256Digest(reason) },
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "retention.hold_released",
      category: "retention",
      actorUserId: userId,
      matterId: hold.matterId,
      contactId: hold.contactId,
      documentId: hold.documentId,
      metadata: { holdId: hold.id, retentionActionId: action.id },
    });
    return { hold: released, replayed: false };
  });
}

function documentEligibility(document: any) {
  const policy = document.retentionPolicy;
  if (!policy || policy.status !== "active" || policy.recordClass !== "document") {
    throw new Error("Document requires an active document retention policy.");
  }
  let triggerAt: Date | null = null;
  if (policy.trigger === "document_archived") triggerAt = document.archivedAt;
  if (policy.trigger === "matter_closed") triggerAt = document.matter?.closedAt ?? null;
  if (policy.trigger === "record_created") triggerAt = document.createdAt;
  if (policy.trigger === "manual") {
    throw new Error("Manual retention policies require a future controlled policy operation before disposal.");
  }
  if (!triggerAt) throw new Error("Retention policy trigger has not occurred for this document.");
  return new Date(triggerAt.getTime() + policy.retentionDays * 24 * 60 * 60_000);
}

export async function disposeRetainedDocument(
  _root: unknown,
  args: { documentId: string; reason: string; confirmation: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageRetention", { humanOnly: true });
  const reason = boundedReason(args.reason, "Disposal reason", 10, 4000);
  const confirmation = args.confirmation?.trim();
  if (confirmation !== `DISPOSE ${args.documentId}`) {
    throw new Error("Disposal confirmation must exactly identify the document.");
  }
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageRetention");
    const unlockedDocument = await tx.document.findFirst({
      where: { id: args.documentId, firmId },
      select: { matterId: true, contactId: true },
    });
    if (!unlockedDocument) throw new Error("Document was not found in the active firm.");
    await lockRetentionResources(tx, firmId, { ...unlockedDocument, documentId: args.documentId });
    const document = await tx.document.findFirst({
      where: { id: args.documentId, firmId },
      include: { retentionPolicy: true, matter: true },
    });
    if (!document) throw new Error("Document was not found in the active firm.");
    if (document.matterId) await assertMatterAccess(tx, firmId, document.matterId, userId);
    if (document.status === "disposed") {
      const action = await tx.retentionAction.findFirst({
        where: { firmId, documentId: document.id, actionType: "disposed" },
        orderBy: { occurredAt: "desc" },
      });
      return { document, action, replayed: true };
    }
    if (document.status !== "archived") throw new Error("Only an archived document can enter disposal.");
    const eligibleAt = documentEligibility(document);
    const holds = await tx.retentionHold.findMany({
      where: {
        firmId,
        status: "active",
        OR: [
          { documentId: document.id },
          ...(document.matterId ? [{ matterId: document.matterId }] : []),
          ...(document.contactId ? [{ contactId: document.contactId }] : []),
        ],
      },
      select: { id: true, status: true, releasedAt: true },
    });
    const evaluation = evaluateRetentionDisposal({
      now: new Date(),
      eligibleAt: eligibleAt.toISOString(),
      holds: holds.map((hold: any) => ({
        status: hold.status,
        releasedAt: hold.releasedAt?.toISOString() ?? null,
      })),
      approved: true,
    });
    if (!evaluation.allowed) throw new Error(evaluation.reason);
    assertLifecycleTransition("document", document.status, "disposed");
    const now = new Date();
    const evidenceDigest = sha256Digest({
      documentId: document.id,
      policyId: document.retentionPolicyId,
      eligibleAt: eligibleAt.toISOString(),
      disposedAt: now.toISOString(),
      approvedBy: userId,
      reason,
      versionCount: await tx.documentVersion.count({ where: { documentId: document.id } }),
    });
    const disposed = await tx.document.update({
      where: { id: document.id },
      data: { status: "disposed", disposedAt: now },
    });
    const action = await tx.retentionAction.create({
      data: {
        firmId,
        policyId: document.retentionPolicyId,
        actionType: "disposed",
        resourceType: "document",
        matterId: document.matterId,
        documentId: document.id,
        performedById: userId,
        approvedById: userId,
        evidenceDigest,
        occurredAt: now,
        metadata: {
          eligibleAt: eligibleAt.toISOString(),
          reasonDigest: sha256Digest(reason),
          logicalDisposalOnly: true,
        },
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "retention.document_disposed",
      category: "retention",
      actorUserId: userId,
      matterId: document.matterId,
      documentId: document.id,
      metadata: { retentionActionId: action.id, evidenceDigest, logicalDisposalOnly: true },
    });
    return { document: disposed, action, replayed: false };
  });
}
