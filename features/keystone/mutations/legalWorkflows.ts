import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { assertCommandTarget, assertLifecycleTransition, canTransition } from "../lib/lifecycles";
import { runSerializableTransaction } from "../lib/transactions";
import {
  assertMatterAccess,
  assertMatterTeamCapability,
  boundedReason,
  optionalBoundedText,
  recordAuditEvent,
  requirePermission,
} from "./workflow-helpers";
import { blockingConflictCheckStatuses } from "../lib/conflict-status";
import { advanceIntakeAfterConflictClearance } from "./intakeWorkflows";

const conflictTermTypes = new Set(["person", "organization", "alias", "matter", "other"]);
const conflictMatchTypes = new Set(["exact_name", "alias", "fuzzy_name", "related_party", "matter_text", "manual"]);

async function assertConflictEvidenceSources(tx: any, firmId: string, userId: string, matches: any[], context: Context) {
  for (const match of matches) {
    const sourceIds = [match.matchedContactId, match.matchedMatterId, match.matchedMatterPartyId].filter(Boolean);
    if (sourceIds.length !== 1) {
      throw new Error("Conflict evidence is unclassified; link exactly one verified source before review.");
    }
    if (match.matterId) await assertMatterAccess(tx, firmId, match.matterId, userId);
    if (match.matchedMatterId) {
      if (match.sourceType !== "matter" || match.sourceId !== match.matchedMatterId) {
        throw new Error("Conflict matter evidence does not match its verified source identity.");
      }
      await assertMatterAccess(tx, firmId, match.matchedMatterId, userId);
    } else if (match.matchedMatterPartyId) {
      const matterId = match.matchedMatterParty?.matterId;
      if (
        !matterId || match.matchedMatterParty?.firmId !== firmId || match.sourceType !== "matter_party" ||
        match.sourceId !== match.matchedMatterPartyId
      ) {
        throw new Error("Conflict party evidence does not match its verified source identity.");
      }
      await assertMatterAccess(tx, firmId, matterId, userId);
    } else {
      if (!match.matchedContact || match.matchedContact.firmId !== firmId || match.sourceType !== "contact" || match.sourceId !== match.matchedContactId) {
        throw new Error("Conflict contact evidence does not match its verified source identity.");
      }
      requirePermission(context, "canReadPeople");
      await assertCurrentCommandActor(tx, context, "canReadPeople");
    }
  }
}

export async function requestConflictCheck(
  _root: unknown,
  args: {
    checkNumber: string;
    intakeId?: string | null;
    matterId?: string | null;
    initialTerm: string;
    termType: string;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks", { humanOnly: true });
  const checkNumber = String(args.checkNumber).trim();
  const initialTerm = String(args.initialTerm).trim();
  if (!checkNumber || checkNumber.length > 100) throw new Error("Conflict check number is required and must be 100 characters or fewer.");
  if (!initialTerm || initialTerm.length > 500) throw new Error("An initial conflict search term is required and must be 500 characters or fewer.");
  if (!conflictTermTypes.has(args.termType)) throw new Error("Unsupported conflict term type.");
  if (Boolean(args.intakeId) === Boolean(args.matterId)) throw new Error("A conflict check requires exactly one intake or matter scope.");
  const normalizedTerm = initialTerm.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalizedTerm) throw new Error("The initial conflict term must contain searchable characters.");
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict-number:${firmId}:${checkNumber}`}))`;
    if (args.matterId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${args.matterId}`}))`;
    const [intake, matter] = await Promise.all([
      args.intakeId ? tx.intake.findFirst({ where: { id: args.intakeId, firmId }, select: { id: true, primaryContactId: true } }) : null,
      args.matterId ? tx.matter.findFirst({ where: { id: args.matterId, firmId }, select: { id: true, clientId: true } }) : null,
    ]);
    if (args.intakeId && !intake) throw new Error("Intake was not found in the active firm.");
    if (args.matterId && !matter) throw new Error("Matter was not found in the active firm.");
    if (matter) await assertMatterAccess(tx, firmId, matter.id, userId);
    const check = await tx.conflictCheck.create({
      data: {
        firmId,
        intakeId: intake?.id ?? null,
        matterId: matter?.id ?? null,
        checkNumber,
        status: "requested",
        requestedById: userId,
        searchScope: "contacts_and_matters",
        searchVersion: "manual-v1",
      },
    });
    await tx.conflictSearchTerm.create({
      data: {
        firmId,
        matterId: matter?.id ?? null,
        checkId: check.id,
        term: initialTerm,
        normalizedTerm,
        termType: args.termType,
        sourceContactId: intake?.primaryContactId ?? matter?.clientId ?? null,
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "conflict.check_requested",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: matter?.id ?? null,
      intakeId: intake?.id ?? null,
      metadata: { checkId: check.id, initialTermDigest: sha256Digest(normalizedTerm), searchVersion: "manual-v1" },
    });
    return check;
  });
}

export async function addConflictSearchTerm(
  _root: unknown,
  args: {
    checkId: string;
    term: string;
    normalizedTerm: string;
    termType: string;
    sourceContactId?: string | null;
    includeAliases?: boolean | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks");
  const term = boundedReason(args.term, "Conflict search term", 1, 500);
  const normalizedTerm = boundedReason(args.normalizedTerm, "Normalized conflict search term", 1, 500);
  if (!conflictTermTypes.has(args.termType)) throw new Error("Conflict search term type is unsupported.");
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({ where: { id: args.checkId, firmId } });
    if (!check || !new Set(["requested", "running"]).has(check.status)) {
      throw new Error("Conflict terms may be recorded only before review.");
    }
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    if (args.sourceContactId && !await tx.contact.findFirst({ where: { id: args.sourceContactId, firmId }, select: { id: true } })) {
      throw new Error("Conflict source contact was not found in the active firm.");
    }
    return tx.conflictSearchTerm.create({
      data: {
        firmId, matterId: check.matterId, checkId: check.id, term, normalizedTerm,
        termType: args.termType, sourceContactId: args.sourceContactId ?? null,
        includeAliases: args.includeAliases !== false,
      },
    });
  });
}

export async function addConflictMatch(
  _root: unknown,
  args: {
    checkId: string;
    matchType: string;
    matchedContactId?: string | null;
    matchedMatterId?: string | null;
    matchedMatterPartyId?: string | null;
    score?: number | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks");
  if (!conflictMatchTypes.has(args.matchType)) throw new Error("Conflict match type is unsupported.");
  if (args.score != null && (!Number.isInteger(args.score) || args.score < 0 || args.score > 100)) throw new Error("Conflict match score is invalid.");
  const sources = [args.matchedContactId, args.matchedMatterId, args.matchedMatterPartyId].filter(Boolean);
  if (sources.length !== 1) throw new Error("Conflict candidates require exactly one linked contact, matter, or matter party source.");
  if (args.matchType === "matter_text" && !args.matchedMatterId) {
    throw new Error("Matter-text candidates must link to their source matter.");
  }
  if (args.matchType === "related_party" && !args.matchedMatterPartyId && !args.matchedContactId) {
    throw new Error("Related-party candidates must link to their source party or contact.");
  }
  if (args.matchedContactId) requirePermission(context, "canReadPeople");
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    if (args.matchedContactId) await assertCurrentCommandActor(tx, context, "canReadPeople");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({ where: { id: args.checkId, firmId } });
    if (!check || !new Set(["requested", "running"]).has(check.status)) {
      throw new Error("Conflict matches may be recorded only before review.");
    }
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    if (args.matchedMatterId) await assertMatterAccess(tx, firmId, args.matchedMatterId, userId);
    const [contact, matter, party] = await Promise.all([
      args.matchedContactId ? tx.contact.findFirst({ where: { id: args.matchedContactId, firmId }, select: { id: true } }) : null,
      args.matchedMatterId ? tx.matter.findFirst({ where: { id: args.matchedMatterId, firmId }, select: { id: true } }) : null,
      args.matchedMatterPartyId ? tx.matterParty.findFirst({ where: { id: args.matchedMatterPartyId, firmId }, select: { id: true, matterId: true } }) : null,
    ]);
    if (args.matchedContactId && !contact) throw new Error("Matched contact was not found in the active firm.");
    if (args.matchedMatterId && !matter) throw new Error("Matched matter was not found in the active firm.");
    if (args.matchedMatterPartyId && !party) throw new Error("Matched matter party was not found in the active firm.");
    if (party?.matterId) await assertMatterAccess(tx, firmId, party.matterId, userId);
    const sourceType = args.matchedMatterId ? "matter" : args.matchedMatterPartyId ? "matter_party" : "contact";
    const sourceId = args.matchedMatterId ?? args.matchedMatterPartyId ?? args.matchedContactId!;
    const matchedValue = args.matchedMatterId
      ? "Linked matter source"
      : args.matchedMatterPartyId
        ? "Linked matter-party source"
        : "Linked contact source";
    return tx.conflictMatch.create({
      data: {
        firmId, matterId: check.matterId, checkId: check.id, status: "potential",
        matchType: args.matchType, matchedContactId: args.matchedContactId ?? null,
        matchedMatterId: args.matchedMatterId ?? null, matchedMatterPartyId: args.matchedMatterPartyId ?? null,
        score: args.score ?? null, matchedValue, evidenceExcerpt: "",
        sourceType, sourceId,
      },
    });
  });
}

export async function transitionConflictCheck(
  _root: unknown,
  args: {
    checkId: string;
    toStatus: "running" | "review_required" | "failed" | "cancelled";
    summary?: string | null;
  },
  context: Context,
) {
  assertCommandTarget("conflict-check", args.toStatus, ["running", "review_required", "failed", "cancelled"]);
  const { firmId, userId } = requirePermission(context, "canRunConflictChecks");
  const summary = args.toStatus === "failed"
    ? boundedReason(args.summary, "Conflict-check failure reason", 3, 2000)
    : args.toStatus === "review_required"
      ? boundedReason(args.summary, "Completed conflict-search summary", 10, 2000)
      : optionalBoundedText(args.summary, "Conflict-check summary", 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({ where: { id: args.checkId, firmId } });
    if (!check) throw new Error("Conflict check was not found in the active firm.");
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    if (check.status === args.toStatus) return { check, replayed: true };
    assertLifecycleTransition("conflictCheck", check.status, args.toStatus);
    if (args.toStatus === "review_required") {
      const termCount = await tx.conflictSearchTerm.count({ where: { firmId, checkId: check.id } });
      if (!termCount || !check.searchVersion) {
        throw new Error("Conflict review requires nonempty search terms and explicit search-version evidence.");
      }
    }
    const now = new Date();
    const updated = await tx.conflictCheck.update({
      where: { id: check.id },
      data: {
        status: args.toStatus,
        ...(args.toStatus === "running" ? { startedAt: now } : {}),
        ...(args.toStatus === "review_required" ? { summary } : {}),
        ...(args.toStatus === "failed" ? { failureReason: summary, completedAt: now } : {}),
        ...(args.toStatus === "cancelled" ? { completedAt: now } : {}),
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `conflict.check_${args.toStatus}`,
      category: "legal_workflow",
      actorUserId: userId,
      matterId: check.matterId,
      intakeId: check.intakeId,
      metadata: { checkId: check.id, fromStatus: check.status, toStatus: args.toStatus },
    });
    return { check: updated, replayed: false };
  });
}

const dispositionOutcomes = new Set([
  "clear",
  "conflict",
  "needs_more_information",
  "approved_exception",
]);

export async function recordConflictDisposition(
  _root: unknown,
  args: {
    checkId: string;
    matchId?: string | null;
    outcome: string;
    rationale: string;
    conditions?: string | null;
    policyReference?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canResolveConflicts", { humanOnly: true });
  if (!dispositionOutcomes.has(args.outcome)) throw new Error("Unsupported conflict disposition outcome.");
  const rationale = boundedReason(args.rationale, "Disposition rationale", 10, 4000);
  const conditions = optionalBoundedText(args.conditions, "Disposition conditions", 4000);
  const policyReference = optionalBoundedText(args.policyReference, "Policy reference", 500);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canResolveConflicts");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({
      where: { id: args.checkId, firmId },
      include: {
        matches: {
          include: {
            matchedContact: { select: { id: true, firmId: true } },
            matchedMatterParty: { select: { matterId: true, firmId: true } },
          },
        },
      },
    });
    if (!check || check.status !== "review_required") {
      throw new Error("Conflict check must be awaiting review in the active firm.");
    }
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    await assertConflictEvidenceSources(tx, firmId, userId, check.matches, context);

    let match: any = null;
    if (args.matchId) {
      match = check.matches.find((candidate: any) => candidate.id === args.matchId) ?? null;
      if (!match) throw new Error("Conflict match was not found on the selected check.");
    }

    const disposition = await tx.conflictDisposition.create({
      data: {
        firmId,
        matterId: check.matterId ?? match?.matterId ?? null,
        checkId: check.id,
        matchId: match?.id ?? null,
        outcome: args.outcome,
        reviewerId: userId,
        rationale,
        conditions: conditions ?? "",
        policyReference: policyReference ?? "",
        decidedAt: new Date(),
      },
    });

    if (match) {
      const target = args.outcome === "clear"
        ? "cleared"
        : args.outcome === "needs_more_information"
          ? "reviewing"
          : "escalated";
      if (match.status !== target && canTransition("conflictMatch", match.status, target)) {
        await tx.conflictMatch.update({
          where: { id: match.id },
          data: { status: target, reviewedById: userId, reviewedAt: new Date() },
        });
      }
    }

    await recordAuditEvent(tx, {
      firmId,
      eventType: "conflict.disposition_recorded",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: check.matterId,
      intakeId: check.intakeId,
      metadata: {
        checkId: check.id,
        matchId: match?.id ?? null,
        outcome: args.outcome,
        dispositionId: disposition.id,
      },
    });
    return disposition;
  });
}

export async function finalizeConflictCheck(
  _root: unknown,
  args: { checkId: string; outcome: "cleared" | "conflict_found"; summary: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canResolveConflicts", { humanOnly: true });
  if (!new Set(["cleared", "conflict_found"]).has(args.outcome)) {
    throw new Error("Conflict check outcome must be cleared or conflict_found.");
  }
  const summary = boundedReason(args.summary, "Conflict review summary", 10, 4000);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canResolveConflicts");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conflict:${firmId}:${args.checkId}`}))`;
    const check = await tx.conflictCheck.findFirst({
      where: { id: args.checkId, firmId },
      include: {
        terms: { select: { id: true }, take: 1 },
        matches: {
          include: {
            matchedContact: { select: { id: true, firmId: true } },
            matchedMatterParty: { select: { matterId: true, firmId: true } },
            dispositions: { orderBy: { decidedAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!check) throw new Error("Conflict check was not found in the active firm.");
    if (check.matterId) await assertMatterAccess(tx, firmId, check.matterId, userId);
    await assertConflictEvidenceSources(tx, firmId, userId, check.matches, context);
    if (check.status === args.outcome) return { check, replayed: true };
    if (check.status !== "review_required") throw new Error("Conflict check is not awaiting final review.");
    if (!check.terms.length || !check.searchVersion) {
      throw new Error("Conflict clearance requires nonempty search terms and explicit completed-search evidence.");
    }
    const latestOutcomes = check.matches.map((match: any) => match.dispositions[0]?.outcome ?? null);
    if (latestOutcomes.some((outcome: string | null) => !outcome || outcome === "needs_more_information")) {
      throw new Error("Every conflict match requires a final disposition before check completion.");
    }
    const hasConflict = latestOutcomes.includes("conflict");
    if (args.outcome === "cleared" && hasConflict) {
      throw new Error("A check with an unresolved conflict disposition cannot be cleared.");
    }
    if (args.outcome === "conflict_found" && !hasConflict) {
      throw new Error("Conflict-found completion requires at least one conflict disposition.");
    }
    assertLifecycleTransition("conflictCheck", check.status, args.outcome);
    const now = new Date();
    const completed = await tx.conflictCheck.update({
      where: { id: check.id },
      data: {
        status: args.outcome,
        summary,
        reviewedById: userId,
        reviewedAt: now,
        completedAt: now,
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "conflict.check_finalized",
      category: "legal_workflow",
      actorUserId: userId,
      matterId: check.matterId,
      intakeId: check.intakeId,
      metadata: { checkId: check.id, outcome: args.outcome },
    });
    // Only a clearance can move the intake on; conflict_found leaves it where it is.
    if (args.outcome === "cleared" && check.intakeId) {
      await advanceIntakeAfterConflictClearance(tx, context, { firmId, userId, intakeId: check.intakeId, checkId: check.id });
    }
    return { check: completed, replayed: false };
  });
}

const reasonedMatterStates = new Set(["on_hold", "closing", "closed", "declined"]);

export async function changeMatterConfidentiality(
  _root: unknown,
  args: { matterId: string; confidentiality: "standard" | "restricted"; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageEthicalWalls", { humanOnly: true });
  if (!new Set(["standard", "restricted"]).has(args.confidentiality)) {
    throw new Error("Matter confidentiality is invalid.");
  }
  const reason = boundedReason(args.reason, "Confidentiality change reason", 10, 4000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageEthicalWalls");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter-confidentiality:${firmId}:${args.matterId}`}))`;
    const matter = await tx.matter.findFirst({
      where: { id: args.matterId, firmId },
      select: { id: true, confidentiality: true },
    });
    if (!matter) throw new Error("Matter was not found in the active firm.");
    await assertMatterAccess(tx, firmId, matter.id, userId);
    if (matter.confidentiality === args.confidentiality) return { matter, replayed: true };
    if (args.confidentiality === "restricted") {
      const authorizedTeam = await tx.matterTeamMember.count({
        where: { firmId, matterId: matter.id, status: "active", canAccessRestricted: true },
      });
      if (!authorizedTeam) throw new Error("Restricting a matter requires at least one active restricted-access team member.");
    }
    const updated = await tx.matter.update({
      where: { id: matter.id },
      data: { confidentiality: args.confidentiality },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "matter.confidentiality_changed",
      category: "authorization",
      actorUserId: userId,
      matterId: matter.id,
      metadata: {
        fromConfidentiality: matter.confidentiality,
        toConfidentiality: args.confidentiality,
        reasonDigest: sha256Digest(reason),
      },
    });
    return { matter: updated, replayed: false };
  });
}

export async function transitionMatter(
  _root: unknown,
  args: { matterId: string; toStatus: string; reason?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageMatters");
  const reason = reasonedMatterStates.has(args.toStatus)
    ? boundedReason(args.reason, "Matter transition reason", 5, 4000)
    : optionalBoundedText(args.reason, "Matter transition reason", 4000);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${args.matterId}`}))`;
    const matter = await tx.matter.findFirst({
      where: { id: args.matterId, firmId },
      select: { id: true, status: true, confidentiality: true },
    });
    if (!matter) throw new Error("Matter was not found in the active firm.");
    await assertMatterAccess(tx, firmId, matter.id, userId);
    await assertMatterTeamCapability(tx, firmId, matter.id, userId, "canEdit");
    if (matter.status === args.toStatus) return { matter, replayed: true };
    assertLifecycleTransition("matter", matter.status, args.toStatus);

    if (matter.status === "pending_conflict" && args.toStatus === "open") {
      // Same blocking set as intake conversion: a pending, running, review-required or
      // failed check outweighs any earlier clearance. New matter checks take this
      // matter lock, so none can appear between this read and the transition.
      const [cleared, blocking] = await Promise.all([
        tx.conflictCheck.count({ where: { firmId, matterId: matter.id, status: "cleared" } }),
        tx.conflictCheck.count({ where: { firmId, matterId: matter.id, status: { in: [...blockingConflictCheckStatuses] } } }),
      ]);
      if (!cleared || blocking) {
        throw new Error("Opening a matter requires a cleared conflict check and no pending, failed or conflict-found check.");
      }
    }

    if (args.toStatus === "closed") {
      const openInvoices = await tx.invoice.count({
        where: {
          firmId,
          matterId: matter.id,
          status: { not: "void" },
          balanceDueMinor: { gt: 0 },
        },
      });
      if (openInvoices) throw new Error("Matter closure requires all non-void invoice balances to be resolved.");
      const [credits, debits] = await Promise.all([
        tx.trustLedgerEntry.aggregate({
          where: {
            firmId,
            ledgerAccount: { matterId: matter.id },
            accountingBucket: "client_liability",
            direction: "credit",
          },
          _sum: { amountMinor: true },
        }),
        tx.trustLedgerEntry.aggregate({
          where: {
            firmId,
            ledgerAccount: { matterId: matter.id },
            accountingBucket: "client_liability",
            direction: "debit",
          },
          _sum: { amountMinor: true },
        }),
      ]);
      if ((credits._sum.amountMinor ?? 0) !== (debits._sum.amountMinor ?? 0)) {
        throw new Error("Matter closure requires a zero client trust-ledger balance.");
      }
    }

    const now = new Date();
    const updated = await tx.matter.update({
      where: { id: matter.id },
      data: {
        status: args.toStatus,
        ...(args.toStatus === "open" && matter.status !== "on_hold" ? { openedAt: now } : {}),
        ...(args.toStatus === "closed" ? { closedAt: now, closureReason: reason } : {}),
      },
    });
    const event = await tx.matterStatusEvent.create({
      data: {
        firmId,
        matterId: matter.id,
        fromStatus: matter.status,
        toStatus: args.toStatus,
        action: "matter.transition",
        reason: reason ?? "",
        actorUserId: userId,
        actorAgentId: (context.session as any)?.agentPrincipalId ?? null,
        occurredAt: now,
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "matter.transitioned",
      category: "legal_workflow",
      actorUserId: (context.session as any)?.authenticationType === "agent" ? null : userId,
      actorAgentId: (context.session as any)?.agentPrincipalId ?? null,
      matterId: matter.id,
      metadata: { fromStatus: matter.status, toStatus: args.toStatus, eventId: event.id },
    });
    return { matter: updated, event, replayed: false };
  });
}
