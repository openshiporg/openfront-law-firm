import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { isGraphqlInt } from "../lib/int32";
import { runSerializableTransaction } from "../lib/transactions";
import { priceMinutes, resolveHourlyRate, type HourlyRateRule } from "../../platform/billing/lib/ratePricing";
import {
  assertMatterAccess,
  assertMatterTeamCapability,
  boundedReason,
  optionalBoundedText,
  recordAuditEvent,
  requirePermission,
} from "./workflow-helpers";
import { blockingConflictCheckStatuses } from "../lib/conflict-status";

function durableKey(value: string) {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 160) {
    throw new Error("Idempotency key must be between 12 and 160 characters.");
  }
  return key;
}

async function transitionMatterRecord(options: {
  context: Context;
  permission: "canManageCalendar" | "canManageTasks" | "canManageBilling";
  model: "deadline" | "legalTask" | "timeEntry" | "expense";
  lifecycle: "deadline" | "legalTask" | "timeEntry" | "expense";
  id: string;
  toStatus: string;
  reason?: string | null;
  humanOnly?: boolean;
  validate?: (tx: any, item: any, userId: string, reason: string | null) => Promise<Record<string, unknown>>;
}) {
  const { firmId, userId } = requirePermission(options.context, options.permission, { humanOnly: options.humanOnly });
  const reason = optionalBoundedText(options.reason, "Transition reason", 2000);
  const prisma = options.context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, options.context, options.permission);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${options.model}:${firmId}:${options.id}`}))`;
    const item = await tx[options.model].findFirst({
      where: { id: options.id, firmId },
      ...(options.model === "legalTask" ? { include: { dependsOn: { select: { id: true, status: true } } } } : {}),
    });
    if (!item) throw new Error("The selected work record was not found in the active firm.");
    await assertMatterAccess(tx, firmId, item.matterId, userId);
    if (options.model === "timeEntry" || options.model === "expense") {
      await assertMatterTeamCapability(tx, firmId, item.matterId, userId, "canBill");
    }
    if (item.status === options.toStatus) return { item, replayed: true };
    assertLifecycleTransition(options.lifecycle, item.status, options.toStatus);
    const additional = options.validate ? await options.validate(tx, item, userId, reason) : {};
    const updated = await tx[options.model].update({
      where: { id: item.id },
      data: { status: options.toStatus, ...additional },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `${options.model}.${options.toStatus}`,
      category: options.model === "timeEntry" || options.model === "expense" ? "financial" : "legal_workflow",
      actorUserId: userId,
      matterId: item.matterId,
      metadata: { recordId: item.id, fromStatus: item.status, toStatus: options.toStatus, reasonDigest: reason ? sha256Digest(reason) : null },
    });
    return { item: updated, replayed: false };
  });
}

export async function transitionIntake(
  _root: unknown,
  args: { intakeId: string; toStatus: string; reason?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  if (args.toStatus === "converted") throw new Error("Intake conversion requires the atomic convertIntakeToMatter operation.");
  const reason = optionalBoundedText(args.reason, "Intake transition reason", 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${firmId}:${args.intakeId}`}))`;
    const intake = await tx.intake.findFirst({ where: { id: args.intakeId, firmId } });
    if (!intake) throw new Error("Intake was not found in the active firm.");
    if (intake.status === args.toStatus) return { intake, replayed: true };
    assertLifecycleTransition("intake", intake.status, args.toStatus);
    if (["consultation", "decision"].includes(args.toStatus)) {
      const [cleared, unresolved] = await Promise.all([
        tx.conflictCheck.count({ where: { firmId, intakeId: intake.id, status: "cleared" } }),
        tx.conflictCheck.count({
          where: { firmId, intakeId: intake.id, status: { in: [...blockingConflictCheckStatuses] } },
        }),
      ]);
      if (!cleared || unresolved) throw new Error("Intake cannot advance without a cleared conflict review and no blocking check.");
    }
    const now = new Date();
    const updated = await tx.intake.update({
      where: { id: intake.id },
      data: {
        status: args.toStatus,
        ...(["declined", "withdrawn"].includes(args.toStatus) ? { declineReason: reason ?? "" } : {}),
        ...(["declined", "withdrawn"].includes(args.toStatus) ? { decidedAt: now } : {}),
      },
    });
    await recordAuditEvent(tx, {
      firmId, eventType: `intake.${args.toStatus}`, category: "legal_workflow", actorUserId: userId,
      intakeId: intake.id,
      metadata: { fromStatus: intake.status, toStatus: args.toStatus, reasonDigest: reason ? sha256Digest(reason) : null },
    });
    return { intake: updated, replayed: false };
  });
}

// Intake roles map to matter party roles; referrers are not parties to the matter.
const intakePartyMapping: Record<string, { partyRole: string; side: string }> = {
  prospective_client: { partyRole: "client", side: "our_client" },
  adverse_party: { partyRole: "opposing_party", side: "adverse" },
  related_party: { partyRole: "other", side: "unknown" },
  witness: { partyRole: "witness", side: "neutral" },
  other: { partyRole: "other", side: "unknown" },
};

export async function convertIntakeToMatter(
  _root: unknown,
  args: {
    intakeId: string;
    matterNumber: string;
    title: string;
    responsibleAttorneyId: string;
    officeId?: string | null;
    practiceAreaId?: string | null;
    reason: string;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  requirePermission(context, "canManageIntake", { humanOnly: true });
  requirePermission(context, "canResolveConflicts", { humanOnly: true });
  if (!String(args.matterNumber).trim() || String(args.matterNumber).length > 100) throw new Error("Matter number is required.");
  if (!String(args.title).trim() || String(args.title).length > 500) throw new Error("Matter title is required.");
  const reason = boundedReason(args.reason, "Conversion reason", 10, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await assertCurrentCommandActor(tx, context, "canResolveConflicts");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake-conversion:${firmId}:${args.intakeId}`}))`;
    const intake = await tx.intake.findFirst({ where: { id: args.intakeId, firmId }, include: { convertedMatter: true } });
    if (!intake) throw new Error("Intake was not found in the active firm.");
    if (intake.convertedMatter) {
      if (intake.status !== "converted") throw new Error("Existing intake conversion evidence is inconsistent.");
    } else if (intake.status !== "decision") {
      throw new Error("Intake must be at the engagement decision stage before conversion.");
    }
    const [clearedChecks, blockingChecks, attorney, office, practiceArea] = await Promise.all([
      tx.conflictCheck.findMany({ where: { firmId, intakeId: intake.id, status: "cleared" }, select: { id: true } }),
      tx.conflictCheck.count({ where: { firmId, intakeId: intake.id, status: { in: [...blockingConflictCheckStatuses] } } }),
      tx.user.findFirst({ where: { id: args.responsibleAttorneyId, status: "active", firmMemberships: { some: { firmId, status: "active" } } }, select: { id: true } }),
      args.officeId ? tx.office.findFirst({ where: { id: args.officeId, firmId }, select: { id: true } }) : null,
      args.practiceAreaId ? tx.practiceArea.findFirst({ where: { id: args.practiceAreaId, firmId, status: "active" }, select: { id: true } }) : null,
    ]);
    if (!clearedChecks.length || blockingChecks) throw new Error("Conversion requires a cleared conflict review and no blocking check.");
    if (!attorney) throw new Error("Responsible attorney must be active in the firm.");
    if (args.officeId && !office) throw new Error("Office was not found in the active firm.");
    if (args.practiceAreaId && !practiceArea) throw new Error("Practice area was not found in the active firm.");
    if (intake.convertedMatter) {
      const existing = intake.convertedMatter;
      if (
        existing.clientId !== intake.primaryContactId ||
        existing.matterNumber !== args.matterNumber.trim() ||
        existing.title !== args.title.trim() ||
        existing.responsibleAttorneyId !== attorney.id ||
        (existing.officeId ?? null) !== (office?.id ?? null) ||
        (existing.practiceAreaId ?? null) !== (practiceArea?.id ?? null)
      ) {
        throw new Error("Existing intake conversion cannot be replayed with different matter identity or authority.");
      }
      return { matter: existing, replayed: true };
    }
    const numberTaken = await tx.matter.findFirst({ where: { firmId, matterNumber: args.matterNumber.trim() }, select: { id: true } });
    if (numberTaken) throw new Error("Matter number is already in use in this firm.");
    const now = new Date();
    const matter = await tx.matter.create({
      data: {
        firmId,
        matterNumber: args.matterNumber.trim(),
        title: args.title.trim(),
        status: "proposed",
        confidentiality: "standard",
        clientId: intake.primaryContactId,
        responsibleAttorneyId: attorney.id,
        officeId: office?.id ?? null,
        practiceAreaId: practiceArea?.id ?? null,
        openedAt: now,
      },
    });
    const clearedCheckIds = clearedChecks.map((check: any) => check.id);
    const openedMatter = await tx.matter.update({
      where: { id: matter.id },
      data: {
        status: "open",
        openedAt: now,
        authorizedUsers: { connect: { id: attorney.id } },
      },
    });
    await Promise.all([
      tx.matterTeamMember.create({
        data: {
          firmId, matterId: matter.id, userId: attorney.id, officeId: office?.id ?? null,
          teamRole: "responsible_attorney", status: "active", canAccessRestricted: true,
          canEdit: true, canBill: true, assignedAt: now,
        },
      }),
      tx.conflictCheck.updateMany({ where: { firmId, id: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.conflictSearchTerm.updateMany({ where: { firmId, checkId: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.conflictMatch.updateMany({ where: { firmId, checkId: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.conflictDisposition.updateMany({ where: { firmId, checkId: { in: clearedCheckIds } }, data: { matterId: matter.id } }),
      tx.intake.update({
        where: { id: intake.id },
        data: { status: "converted", decidedAt: now, convertedMatterId: matter.id },
      }),
      tx.matterStatusEvent.create({
        data: {
          firmId, matterId: matter.id, fromStatus: "proposed", toStatus: "open", action: "intake.converted",
          reason, actorUserId: userId, occurredAt: now,
        },
      }),
    ]);
    // Intake participants were searched by the cleared checks above; they carry onto the
    // matter as parties. The primary contact becomes the firm's client.
    const participants = await tx.intakeParticipant.findMany({
      where: { firmId, intakeId: intake.id, status: "active" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { contactId: true, participantRole: true },
    });
    const partyKeys = new Set<string>();
    const partyIds: string[] = [];
    const clientParticipants = participants.some((participant: any) => participant.contactId === intake.primaryContactId && participant.participantRole === "prospective_client")
      ? participants
      : [{ contactId: intake.primaryContactId, participantRole: "prospective_client" }, ...participants];
    for (const participant of clientParticipants) {
      const party = intakePartyMapping[participant.participantRole as string];
      if (!party) continue;
      const isPrimaryClient = participant.contactId === intake.primaryContactId && party.partyRole === "client";
      const key = `${participant.contactId}:${party.partyRole}`;
      if (partyKeys.has(key)) continue;
      partyKeys.add(key);
      const created = await tx.matterParty.create({
        data: {
          firmId, matterId: matter.id, contactId: participant.contactId, partyRole: party.partyRole, side: party.side,
          status: "active", isPrimaryClient, notes: "",
        },
        select: { id: true },
      });
      partyIds.push(created.id);
    }
    await tx.contact.updateMany({
      where: { id: intake.primaryContactId, firmId, status: { in: ["prospective_client", "former_client", "other"] } },
      data: { status: "client" },
    });
    await recordAuditEvent(tx, {
      firmId, eventType: "intake.converted_to_matter", category: "legal_workflow", actorUserId: userId,
      matterId: matter.id, intakeId: intake.id, contactId: intake.primaryContactId,
      metadata: { responsibleAttorneyId: attorney.id, conflictCheckIds: clearedCheckIds, matterPartyIds: partyIds, reasonDigest: sha256Digest(reason) },
    });
    return { matter: openedMatter, replayed: false };
  });
}

export async function reviseDraftDeadline(
  _root: unknown,
  args: { deadlineId: string; title?: string | null; dueAt?: string | null; timezone?: string | null; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  const reason = boundedReason(args.reason, "Deadline revision reason", 5, 2000);
  const title = args.title?.trim();
  const timezone = args.timezone?.trim();
  const dueAt = args.dueAt ? new Date(args.dueAt) : null;
  if (title != null && (!title || title.length > 500)) throw new Error("Deadline title is invalid.");
  if (timezone != null && (!timezone || timezone.length > 100)) throw new Error("Deadline timezone is invalid.");
  if (args.dueAt && Number.isNaN(dueAt!.getTime())) throw new Error("Deadline due date is invalid.");
  if (title == null && timezone == null && dueAt == null) throw new Error("Deadline revision requires a changed snapshot field.");
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`deadline:${firmId}:${args.deadlineId}`}))`;
    const deadline = await tx.deadline.findFirst({ where: { id: args.deadlineId, firmId } });
    if (!deadline || deadline.status !== "draft" || deadline.isVerified) {
      throw new Error("Only an unverified draft deadline can be revised.");
    }
    await assertMatterAccess(tx, firmId, deadline.matterId, userId);
    const updated = await tx.deadline.update({
      where: { id: deadline.id },
      data: {
        ...(title != null ? { title } : {}),
        ...(timezone != null ? { timezone } : {}),
        ...(dueAt != null ? { dueAt } : {}),
      },
    });
    await recordAuditEvent(tx, {
      firmId, eventType: "deadline.draft_revised", category: "legal_workflow", actorUserId: userId,
      matterId: deadline.matterId, metadata: { deadlineId: deadline.id, reasonDigest: sha256Digest(reason) },
    });
    return updated;
  });
}

export async function transitionDeadline(
  _root: unknown,
  args: { deadlineId: string; toStatus: string; reason?: string | null },
  context: Context,
) {
  return transitionMatterRecord({
    context, permission: "canManageCalendar", model: "deadline", lifecycle: "deadline",
    id: args.deadlineId, toStatus: args.toStatus, reason: args.reason, humanOnly: true,
    validate: async (_tx, item, userId, reason) => {
      if (args.toStatus === "waived" && !reason) throw new Error("Deadline waiver requires a reason.");
      if (args.toStatus === "completed" && !item.isVerified) throw new Error("An unverified deadline cannot be completed.");
      if (args.toStatus === "pending" && !reason) throw new Error("Deadline verification requires a reason.");
      const now = new Date();
      return {
        ...(args.toStatus === "completed" ? { completedAt: now } : {}),
        ...(args.toStatus === "pending" ? {
          isVerified: true,
          verifiedById: userId,
          verifiedAt: now,
        } : {}),
      };
    },
  });
}

export async function transitionLegalTask(
  _root: unknown,
  args: { taskId: string; toStatus: string; reason?: string | null },
  context: Context,
) {
  return transitionMatterRecord({
    context, permission: "canManageTasks", model: "legalTask", lifecycle: "legalTask",
    id: args.taskId, toStatus: args.toStatus, reason: args.reason,
    validate: async (_tx, item, _userId, reason) => {
      if (args.toStatus === "completed" && item.dependsOn?.some((dependency: any) => dependency.status !== "completed")) {
        throw new Error("Task cannot be completed while dependencies remain unfinished.");
      }
      if (args.toStatus === "blocked" && !reason) throw new Error("Blocking a task requires a reason.");
      return {
        completedAt: args.toStatus === "completed" ? new Date() : null,
        blockedReason: args.toStatus === "blocked" ? reason : "",
      };
    },
  });
}

export async function transitionTimeEntry(
  _root: unknown,
  args: { timeEntryId: string; toStatus: string; reason?: string | null },
  context: Context,
) {
  if (!["submitted", "approved", "draft", "written_off"].includes(args.toStatus)) {
    throw new Error("Time billing state can change only through invoice assembly and issue operations.");
  }
  if (args.toStatus === "written_off") boundedReason(args.reason, "Time write-off reason", 5, 2000);
  return transitionMatterRecord({
    context, permission: "canManageBilling", model: "timeEntry", lifecycle: "timeEntry",
    id: args.timeEntryId, toStatus: args.toStatus, reason: args.reason, humanOnly: true,
    validate: async (tx, item, userId) => args.toStatus === "approved"
      ? { approvedById: userId, approvedAt: new Date(), ...(await priceUnpricedTime(tx, item)) }
      : args.toStatus === "draft" ? { approvedById: null, approvedAt: null } : {},
  });
}

/**
 * Billable time approved without an amount is priced at approval from the firm's active
 * hourly rate rules (same precedence as the Billing rates screen), because approved time
 * is immutable afterwards. No applicable rule leaves it unpriced.
 */
async function priceUnpricedTime(tx: any, item: any) {
  if (!item?.isBillable || item.amountMinor !== null && item.amountMinor !== undefined) return {};
  const matter = await tx.matter.findFirst({ where: { id: item.matterId, firmId: item.firmId }, select: { practiceAreaId: true } });
  const rows = await tx.rateRule.findMany({
    where: { firmId: item.firmId, rateType: "hourly", rateCard: { status: "active" } },
    take: 500,
    select: { id: true, amountMinor: true, currencyCode: true, priority: true, effectiveFrom: true, effectiveTo: true, matterId: true, userId: true, practiceAreaId: true, rateCard: { select: { id: true, name: true, status: true, matterId: true, effectiveFrom: true, effectiveTo: true } } },
  });
  const rules: HourlyRateRule[] = rows.map((row: any) => ({
    id: row.id, amountMinor: row.amountMinor, currencyCode: row.currencyCode, priority: row.priority,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null, effectiveTo: row.effectiveTo?.toISOString() ?? null,
    matter: row.matterId ? { id: row.matterId } : null, user: row.userId ? { id: row.userId } : null,
    practiceArea: row.practiceAreaId ? { id: row.practiceAreaId } : null,
    rateCard: row.rateCard ? { id: row.rateCard.id, name: row.rateCard.name, status: row.rateCard.status, matter: row.rateCard.matterId ? { id: row.rateCard.matterId } : null, effectiveFrom: row.rateCard.effectiveFrom?.toISOString() ?? null, effectiveTo: row.rateCard.effectiveTo?.toISOString() ?? null } : null,
  }));
  const rule = resolveHourlyRate(rules, { matterId: item.matterId, userId: item.userId ?? null, practiceAreaId: matter?.practiceAreaId ?? null, workDate: item.workDate ?? item.createdAt });
  if (!rule) return {};
  return { rateMinor: rule.amountMinor, amountMinor: priceMinutes(rule.amountMinor, Number(item.durationMinutes) || 0), currencyCode: rule.currencyCode };
}

export async function transitionExpense(
  _root: unknown,
  args: { expenseId: string; toStatus: string; reason?: string | null },
  context: Context,
) {
  if (!["submitted", "approved", "draft", "written_off"].includes(args.toStatus)) {
    throw new Error("Expense billing and reimbursement states require their controlled financial operations.");
  }
  if (args.toStatus === "written_off") boundedReason(args.reason, "Expense write-off reason", 5, 2000);
  return transitionMatterRecord({
    context, permission: "canManageBilling", model: "expense", lifecycle: "expense",
    id: args.expenseId, toStatus: args.toStatus, reason: args.reason, humanOnly: true,
    validate: async (_tx, _item, userId) => args.toStatus === "approved"
      ? { approvedById: userId, approvedAt: new Date() }
      : args.toStatus === "draft" ? { approvedById: null, approvedAt: null } : {},
  });
}

export async function assembleDraftInvoice(
  _root: unknown,
  args: {
    idempotencyKey: string;
    invoiceNumber: string;
    matterId: string;
    clientId: string;
    timeEntryIds?: string[] | null;
    expenseIds?: string[] | null;
    retainerId?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  const key = durableKey(args.idempotencyKey);
  const retainerId = args.retainerId?.trim() || null;
  const timeEntryIds = [...new Set(args.timeEntryIds ?? [])].sort();
  const expenseIds = [...new Set(args.expenseIds ?? [])].sort();
  if (!timeEntryIds.length && !expenseIds.length) throw new Error("Invoice assembly requires approved time or expense sources.");
  if (timeEntryIds.length + expenseIds.length > 200) throw new Error("Invoice assembly is limited to 200 source records per draft.");
  const requestDigest = sha256Digest({
    invoiceNumber: args.invoiceNumber.trim(), matterId: args.matterId, clientId: args.clientId,
    timeEntryIds, expenseIds,
    ...(retainerId ? { retainerId } : {}),
  });
  const eventId = `invoice-assembly:${firmId}:${key}`;
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId } });
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Invoice idempotency key was reused with a different payload.");
      }
      const invoice = await tx.invoice.findFirst({ where: { id: replay.metadata?.invoiceId, firmId } });
      if (!invoice) throw new Error("Invoice replay evidence references a missing invoice.");
      await assertMatterAccess(tx, firmId, invoice.matterId, userId);
      await assertMatterTeamCapability(tx, firmId, invoice.matterId, userId, "canBill");
      return { invoice, replayed: true };
    }
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, args.matterId, userId, "canBill");
    const sourceLockKeys = [
      ...timeEntryIds.map((id) => `billing-source:${firmId}:time:${id}`),
      ...expenseIds.map((id) => `billing-source:${firmId}:expense:${id}`),
    ].sort();
    for (const sourceLockKey of sourceLockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceLockKey}))`;
    }
    const matter = await tx.matter.findFirst({ where: { id: args.matterId, firmId, clientId: args.clientId }, select: { id: true } });
    if (!matter) throw new Error("Invoice client must match the selected active-firm matter.");
    const [timeEntries, expenses] = await Promise.all([
      tx.timeEntry.findMany({ where: { id: { in: timeEntryIds }, firmId, matterId: args.matterId, status: "approved", isBillable: true, invoiceLine: null } }),
      tx.expense.findMany({ where: { id: { in: expenseIds }, firmId, matterId: args.matterId, status: "approved", isBillable: true, invoiceLine: null } }),
    ]);
    if (timeEntries.length !== timeEntryIds.length || expenses.length !== expenseIds.length) {
      throw new Error("Every invoice source must be approved, billable, unbilled, and scoped to the selected matter.");
    }
    const currencies = new Set([...timeEntries, ...expenses].map((item: any) => item.currencyCode));
    if (currencies.size !== 1) throw new Error("Invoice sources must use one currency.");
    const currencyCode = String([...currencies][0]);
    // An invoice may bill under the matter's active fee agreement, never another
    // matter's, client's or currency's, and never a draft or terminated one.
    if (retainerId) {
      const retainer = await tx.retainerAgreement.findFirst({
        where: { id: retainerId, firmId, matterId: args.matterId, clientId: args.clientId, status: "active", currencyCode },
        select: { id: true },
      });
      if (!retainer) throw new Error("The fee agreement must be active for this matter, client and currency.");
    }
    const sourceLines = [
      ...timeEntries.map((entry: any) => ({ type: "time", sourceId: entry.id, description: entry.description, amountMinor: entry.amountMinor, serviceDate: entry.workDate })),
      ...expenses.map((expense: any) => ({ type: "expense", sourceId: expense.id, description: expense.description, amountMinor: expense.amountMinor, serviceDate: expense.incurredAt })),
    ];
    if (sourceLines.some((line) => !isGraphqlInt(line.amountMinor) || line.amountMinor < 0)) {
      throw new Error("Every invoice source requires a non-negative database-range minor-unit snapshot amount.");
    }
    const totalMinor = sourceLines.reduce((total, line) => total + line.amountMinor, 0);
    if (!isGraphqlInt(totalMinor)) throw new Error("Invoice source total exceeds the supported database integer range.");
    const invoice = await tx.invoice.create({
      data: {
        firmId, matterId: args.matterId, clientId: args.clientId, invoiceNumber: args.invoiceNumber.trim(),
        status: "draft", currencyCode, subtotalMinor: totalMinor, discountMinor: 0, taxMinor: 0,
        totalMinor, paidMinor: 0, balanceDueMinor: totalMinor,
        ...(retainerId ? { retainerId } : {}),
      },
    });
    for (const line of sourceLines) {
      await tx.invoiceLine.create({
        data: {
          firmId, matterId: args.matterId, invoiceId: invoice.id, lineType: line.type,
          description: line.description, quantity: 1, unitAmountMinor: line.amountMinor,
          subtotalMinor: line.amountMinor, discountMinor: 0, taxMinor: 0, lineTotalMinor: line.amountMinor,
          currencyCode, sourceRecordId: line.sourceId, serviceDate: line.serviceDate,
          ...(line.type === "time" ? { timeEntryId: line.sourceId } : { expense: { connect: { id: line.sourceId } } }),
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        firmId, eventId, eventType: "invoice.draft_assembled", category: "financial", outcome: "succeeded",
        actorUserId: userId, actorType: "user", matterId: args.matterId, invoiceId: invoice.id,
        occurredAt: new Date(), metadata: { requestDigest, invoiceId: invoice.id, sourceCount: sourceLines.length },
      },
    });
    return { invoice, replayed: false };
  });
}
