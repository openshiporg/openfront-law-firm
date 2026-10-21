import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { isGraphqlInt } from "../lib/int32";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { runSerializableTransaction } from "../lib/transactions";
import { assertCurrentCommandActor } from "./command-authority";
import {
  assertMatterAccess,
  assertMatterTeamCapability,
  boundedReason,
  optionalBoundedText,
  recordAuditEvent,
  requirePermission,
} from "./workflow-helpers";

const feeStructures = new Set(["hourly", "flat_fee", "contingency", "hybrid", "pro_bono"]);

function optionalMinor(value: number | null | undefined, label: string) {
  if (value == null) return null;
  if (!isGraphqlInt(value) || value < 0) throw new Error(`${label} must be a non-negative whole minor-unit amount.`);
  return value;
}

async function lockRetainer(tx: any, firmId: string, matterId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${matterId}`}))`;
}

/** Prepares a draft fee agreement for a matter's client. The terms are fixed from
 * here on: generated CRUD cannot edit them, and a changed agreement is a new draft. */
export async function prepareRetainerAgreement(
  _root: unknown,
  args: {
    matterId: string;
    clientId: string;
    agreementNumber: string;
    feeStructure: string;
    currencyCode: string;
    rateCardId?: string | null;
    trustLedgerAccountId?: string | null;
    initialRetainerMinor?: number | null;
    evergreenThresholdMinor?: number | null;
    replenishmentAmountMinor?: number | null;
    contingencyBasisPoints?: number | null;
    termsSummary?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  const agreementNumber = String(args.agreementNumber ?? "").trim();
  if (!agreementNumber || agreementNumber.length > 100) throw new Error("Agreement number is required and must be 100 characters or fewer.");
  if (!feeStructures.has(args.feeStructure)) throw new Error("Unsupported fee structure.");
  const currencyCode = String(args.currencyCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("Agreement currency must be a three-letter code.");
  const initialRetainerMinor = optionalMinor(args.initialRetainerMinor, "Initial retainer");
  const evergreenThresholdMinor = optionalMinor(args.evergreenThresholdMinor, "Evergreen threshold");
  const replenishmentAmountMinor = optionalMinor(args.replenishmentAmountMinor, "Replenishment amount");
  const contingencyBasisPoints = args.contingencyBasisPoints ?? null;
  if (contingencyBasisPoints != null && (!Number.isInteger(contingencyBasisPoints) || contingencyBasisPoints < 0 || contingencyBasisPoints > 10_000)) {
    throw new Error("Contingency must be between 0 and 10,000 basis points.");
  }
  if (["contingency", "hybrid"].includes(args.feeStructure) !== (contingencyBasisPoints != null)) {
    throw new Error("Contingency basis points are required for contingency and hybrid fees, and only for them.");
  }
  const termsSummary = optionalBoundedText(args.termsSummary, "Terms summary", 4000) ?? "";

  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    await lockRetainer(tx, firmId, args.matterId);
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, args.matterId, userId, "canBill");
    const [matter, clientParties, rateCard, ledger, duplicate] = await Promise.all([
      tx.matter.findFirst({
        where: { id: args.matterId, firmId, status: { notIn: ["closing", "closed", "declined"] } },
        select: { id: true, clientId: true },
      }),
      tx.matterParty.count({ where: { firmId, matterId: args.matterId, contactId: args.clientId, partyRole: "client", status: "active" } }),
      args.rateCardId
        ? tx.rateCard.findFirst({ where: { id: args.rateCardId, firmId, status: "active", OR: [{ matterId: null }, { matterId: args.matterId }] }, select: { id: true, currencyCode: true } })
        : null,
      args.trustLedgerAccountId
        ? tx.trustLedgerAccount.findFirst({ where: { id: args.trustLedgerAccountId, firmId, matterId: args.matterId, clientId: args.clientId, status: "active" }, select: { id: true, currencyCode: true } })
        : null,
      tx.retainerAgreement.findFirst({ where: { firmId, agreementNumber }, select: { id: true } }),
    ]);
    if (!matter) throw new Error("Only an open matter in the active firm can receive a fee agreement.");
    if (matter.clientId !== args.clientId && !clientParties) throw new Error("The agreement client must be this matter's client.");
    if (args.rateCardId && !rateCard) throw new Error("Rate card must be active and apply to this matter.");
    if (rateCard && rateCard.currencyCode !== currencyCode) throw new Error("Rate card currency must match the agreement currency.");
    if (args.trustLedgerAccountId && !ledger) throw new Error("Trust ledger must be an active ledger for this matter and client.");
    if (ledger && ledger.currencyCode !== currencyCode) throw new Error("Trust ledger currency must match the agreement currency.");
    if (duplicate) throw new Error("Agreement number is already in use in this firm.");

    const agreement = await tx.retainerAgreement.create({
      data: {
        firmId,
        matterId: matter.id,
        clientId: args.clientId,
        rateCardId: rateCard?.id ?? null,
        trustLedgerAccountId: ledger?.id ?? null,
        agreementNumber,
        status: "draft",
        feeStructure: args.feeStructure,
        currencyCode,
        initialRetainerMinor,
        evergreenThresholdMinor,
        replenishmentAmountMinor,
        contingencyBasisPoints,
        termsSummary,
      },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "billing.retainer_prepared",
      category: "financial",
      matterId: matter.id,
      contactId: args.clientId,
      metadata: {
        retainerId: agreement.id,
        termsDigest: sha256Digest({ agreementNumber, feeStructure: args.feeStructure, currencyCode, rateCardId: rateCard?.id ?? null, trustLedgerAccountId: ledger?.id ?? null, initialRetainerMinor, evergreenThresholdMinor, replenishmentAmountMinor, contingencyBasisPoints, termsSummary }),
      },
    });
    return agreement;
  });
}

/** Moves an agreement through draft → sent → accepted → active → completed, or to
 * terminated. Acceptance binds an existing signed document version on the same matter;
 * no acceptance or signature is ever recorded without that version. */
export async function transitionRetainerAgreement(
  _root: unknown,
  args: { retainerId: string; toStatus: string; signedDocumentVersionId?: string | null; effectiveAt?: string | null; reason?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  if (!["sent", "accepted", "active", "completed", "terminated"].includes(args.toStatus)) throw new Error("Unsupported fee agreement status.");
  const reason = args.toStatus === "terminated"
    ? boundedReason(args.reason, "Termination reason", 5, 2000)
    : optionalBoundedText(args.reason, "Reason", 2000);
  const effectiveAt = args.effectiveAt ? new Date(args.effectiveAt) : null;
  if (effectiveAt && Number.isNaN(effectiveAt.getTime())) throw new Error("Effective date is invalid.");

  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    const reference = await tx.retainerAgreement.findFirst({ where: { id: args.retainerId, firmId }, select: { id: true, matterId: true } });
    if (!reference) throw new Error("Fee agreement was not found in the active firm.");
    await lockRetainer(tx, firmId, reference.matterId);
    await assertMatterAccess(tx, firmId, reference.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, reference.matterId, userId, "canBill");
    const agreement = await tx.retainerAgreement.findFirst({ where: { id: reference.id, firmId } });
    if (!agreement || agreement.matterId !== reference.matterId) throw new Error("Fee agreement changed concurrently; reload before retrying.");
    assertLifecycleTransition("retainer", agreement.status, args.toStatus);

    const now = new Date();
    const data: Record<string, unknown> = { status: args.toStatus };
    if (args.toStatus === "sent") data.sentAt = now;
    if (args.toStatus === "accepted") {
      if (!args.signedDocumentVersionId) throw new Error("Acceptance requires the signed agreement's document version.");
      const version = await tx.documentVersion.findFirst({
        where: { id: args.signedDocumentVersionId, firmId, document: { matterId: agreement.matterId, status: { notIn: ["archived", "disposed"] } } },
        select: { id: true },
      });
      if (!version) throw new Error("The signed agreement must be a document version on this matter.");
      data.signedDocumentVersionId = version.id;
      data.acceptedAt = now;
    }
    if (args.toStatus === "active") {
      if (!agreement.signedDocumentVersionId || !agreement.acceptedAt) throw new Error("Only an accepted agreement with signed evidence can become active.");
      if ((agreement.initialRetainerMinor ?? 0) > 0 && !agreement.trustLedgerAccountId) {
        throw new Error("An agreement that takes a retainer deposit needs the client's trust ledger before it becomes active.");
      }
      if (agreement.trustLedgerAccountId) {
        const ledger = await tx.trustLedgerAccount.findFirst({ where: { id: agreement.trustLedgerAccountId, firmId, status: "active" }, select: { id: true } });
        if (!ledger) throw new Error("The agreement's trust ledger is no longer active.");
      }
      data.effectiveAt = effectiveAt ?? now;
    }
    if (args.toStatus === "terminated") data.terminatedAt = now;

    const updated = await tx.retainerAgreement.update({ where: { id: agreement.id }, data, select: { id: true, status: true } });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: `billing.retainer_${args.toStatus}`,
      category: "financial",
      matterId: agreement.matterId,
      contactId: agreement.clientId,
      metadata: {
        retainerId: agreement.id,
        fromStatus: agreement.status,
        toStatus: args.toStatus,
        signedDocumentVersionId: data.signedDocumentVersionId ?? agreement.signedDocumentVersionId ?? null,
        ...(reason ? { reasonDigest: sha256Digest(reason) } : {}),
      },
    });
    return updated;
  });
}
