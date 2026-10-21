import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
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

const intakeRoles = new Set(["prospective_client", "adverse_party", "related_party", "witness", "referrer", "other"]);
const matterRoles = new Set(["client", "claimant", "respondent", "opposing_party", "witness", "expert", "counsel", "adjudicator", "other"]);
const matterSides = new Set(["our_client", "adverse", "neutral", "unknown"]);
const closedIntakeStatuses = ["converted", "declined", "withdrawn"];

function contactName(contact: { contactType: string; firstName: string; lastName: string; organizationName: string }) {
  return contact.contactType === "organization"
    ? contact.organizationName.trim()
    : `${contact.firstName} ${contact.lastName}`.trim();
}

async function activeContact(tx: any, firmId: string, contactId: string) {
  const contact = await tx.contact.findFirst({
    where: { id: contactId, firmId, status: { not: "archived" } },
    select: { id: true, contactType: true, firstName: true, lastName: true, organizationName: true },
  });
  if (!contact) throw new Error("Contact is unavailable in the active firm.");
  return contact;
}

/** A changed party set invalidates earlier clearance. Cleared checks are terminal
 * evidence and stay as they are; a new requested check for the same scope blocks
 * intake progression, conversion and matter opening until someone reviews it. */
async function requireConflictReReview(
  tx: any,
  input: { firmId: string; userId: string; intakeId?: string | null; matterId?: string | null; contact: Awaited<ReturnType<typeof activeContact>>; cause: string },
) {
  const term = contactName(input.contact) || "Unnamed party";
  const normalizedTerm = term.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim() || "unnamed party";
  const check = await tx.conflictCheck.create({
    data: {
      firmId: input.firmId,
      intakeId: input.intakeId ?? null,
      matterId: input.matterId ?? null,
      checkNumber: `PARTY-${randomUUID()}`,
      status: "requested",
      requestedById: input.userId,
      searchScope: "contacts_and_matters",
      searchVersion: "manual-v1",
      summary: input.cause,
    },
    select: { id: true },
  });
  await tx.conflictSearchTerm.create({
    data: {
      firmId: input.firmId,
      matterId: input.matterId ?? null,
      checkId: check.id,
      term,
      normalizedTerm,
      termType: input.contact.contactType === "organization" ? "organization" : "person",
      sourceContactId: input.contact.id,
    },
  });
  return check.id;
}

export async function addIntakeParticipant(
  _root: unknown,
  args: { intakeId: string; contactId: string; participantRole: string; notes?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  if (!intakeRoles.has(args.participantRole)) throw new Error("Unsupported intake participant role.");
  const notes = optionalBoundedText(args.notes, "Notes", 2000) ?? "";
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${firmId}:${args.intakeId}`}))`;
    const intake = await tx.intake.findFirst({ where: { id: args.intakeId, firmId }, select: { id: true, status: true } });
    if (!intake) throw new Error("Intake was not found in the active firm.");
    if (closedIntakeStatuses.includes(intake.status)) throw new Error("A closed or converted intake's parties are fixed; maintain them on the matter.");
    const contact = await activeContact(tx, firmId, args.contactId);
    const duplicate = await tx.intakeParticipant.findFirst({
      where: { firmId, intakeId: intake.id, contactId: contact.id, participantRole: args.participantRole, status: "active" },
      select: { id: true },
    });
    if (duplicate) throw new Error("This contact already has that role on the intake.");
    const participant = await tx.intakeParticipant.create({
      data: { firmId, intakeId: intake.id, contactId: contact.id, participantRole: args.participantRole, status: "active", notes },
      select: { id: true, status: true },
    });
    const conflictCheckId = await requireConflictReReview(tx, {
      firmId, userId, intakeId: intake.id, contact, cause: "Party added to intake; review conflicts for the new party.",
    });
    await recordAuditEvent(tx, {
      firmId, actorUserId: userId, eventType: "intake.participant_added", category: "legal_workflow", intakeId: intake.id, contactId: contact.id,
      metadata: { participantId: participant.id, participantRole: args.participantRole, conflictCheckId },
    });
    return { ...participant, conflictCheckId };
  });
}

/** Corrects a participant's role or notes, or removes it. Removal keeps the row as
 * history; a role change is a new party relationship and needs conflict review. */
export async function changeIntakeParticipant(
  _root: unknown,
  args: { participantId: string; participantRole?: string | null; notes?: string | null; remove?: boolean | null; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  const reason = boundedReason(args.reason, "Change reason", 3, 2000);
  if (args.participantRole && !intakeRoles.has(args.participantRole)) throw new Error("Unsupported intake participant role.");
  const notes = optionalBoundedText(args.notes, "Notes", 2000);
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    const reference = await tx.intakeParticipant.findFirst({ where: { id: args.participantId, firmId }, select: { id: true, intakeId: true } });
    if (!reference) throw new Error("Intake participant was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${firmId}:${reference.intakeId}`}))`;
    const participant = await tx.intakeParticipant.findFirst({ where: { id: reference.id, firmId }, include: { intake: { select: { status: true } } } });
    if (!participant || participant.status !== "active") throw new Error("Only an active intake participant can be changed.");
    if (closedIntakeStatuses.includes(participant.intake.status)) throw new Error("A closed or converted intake's parties are fixed; maintain them on the matter.");
    const roleChanged = Boolean(args.participantRole && args.participantRole !== participant.participantRole);
    if (!args.remove && !roleChanged && notes == null) throw new Error("A role, notes or removal change is required.");
    const updated = await tx.intakeParticipant.update({
      where: { id: participant.id },
      data: args.remove
        ? { status: "removed" }
        : { ...(roleChanged ? { participantRole: args.participantRole } : {}), ...(notes != null ? { notes } : {}) },
      select: { id: true, status: true },
    });
    const conflictCheckId = roleChanged && !args.remove
      ? await requireConflictReReview(tx, {
          firmId, userId, intakeId: participant.intakeId, contact: await activeContact(tx, firmId, participant.contactId),
          cause: "Intake party role changed; review conflicts for the corrected relationship.",
        })
      : null;
    await recordAuditEvent(tx, {
      firmId, actorUserId: userId, eventType: args.remove ? "intake.participant_removed" : "intake.participant_changed",
      category: "legal_workflow", intakeId: participant.intakeId, contactId: participant.contactId,
      metadata: { participantId: participant.id, previousRole: participant.participantRole, nextRole: roleChanged ? args.participantRole : participant.participantRole, conflictCheckId, reasonDigest: sha256Digest(reason) },
    });
    return { ...updated, conflictCheckId };
  });
}

export async function addMatterParty(
  _root: unknown,
  args: { matterId: string; contactId: string; partyRole: string; side?: string | null; representedById?: string | null; counselContactId?: string | null; isPrimaryClient?: boolean | null; notes?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  if (!matterRoles.has(args.partyRole)) throw new Error("Unsupported matter party role.");
  const side = args.side?.trim() || "unknown";
  if (!matterSides.has(side)) throw new Error("Unsupported matter party side.");
  if (args.isPrimaryClient && args.partyRole !== "client") throw new Error("Only a client party can be the primary client.");
  const notes = optionalBoundedText(args.notes, "Notes", 2000) ?? "";
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${args.matterId}`}))`;
    await assertMatterAccess(tx, firmId, args.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, args.matterId, userId, "canEdit");
    const matter = await tx.matter.findFirst({ where: { id: args.matterId, firmId }, select: { id: true, status: true, clientId: true } });
    if (!matter || ["closed", "declined"].includes(matter.status)) throw new Error("Parties can be added only to an active matter.");
    if (args.isPrimaryClient && args.contactId !== matter.clientId) throw new Error("The primary client party must match the matter client.");
    const contact = await activeContact(tx, firmId, args.contactId);
    for (const relatedId of [args.representedById, args.counselContactId]) {
      if (relatedId) await activeContact(tx, firmId, relatedId);
    }
    const [duplicate, primary] = await Promise.all([
      tx.matterParty.findFirst({ where: { firmId, matterId: matter.id, contactId: contact.id, partyRole: args.partyRole, status: "active" }, select: { id: true } }),
      args.isPrimaryClient ? tx.matterParty.findFirst({ where: { firmId, matterId: matter.id, isPrimaryClient: true, status: "active" }, select: { id: true } }) : null,
    ]);
    if (duplicate) throw new Error("This contact already has that role on the matter.");
    if (primary) throw new Error("The matter already has an active primary client party.");
    const party = await tx.matterParty.create({
      data: {
        firmId, matterId: matter.id, contactId: contact.id, partyRole: args.partyRole, side, status: "active",
        representedById: args.representedById || null, counselContactId: args.counselContactId || null,
        isPrimaryClient: Boolean(args.isPrimaryClient), notes,
      },
      select: { id: true, status: true },
    });
    const conflictCheckId = await requireConflictReReview(tx, {
      firmId, userId, matterId: matter.id, contact, cause: "Party added to matter; review conflicts for the new party.",
    });
    await recordAuditEvent(tx, {
      firmId, actorUserId: userId, eventType: "matter.party_added", category: "legal_workflow", matterId: matter.id, contactId: contact.id,
      metadata: { partyId: party.id, partyRole: args.partyRole, side, conflictCheckId },
    });
    return { ...party, conflictCheckId };
  });
}

export async function changeMatterParty(
  _root: unknown,
  args: { partyId: string; partyRole?: string | null; side?: string | null; notes?: string | null; remove?: boolean | null; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageMatters", { humanOnly: true });
  const reason = boundedReason(args.reason, "Change reason", 3, 2000);
  if (args.partyRole && !matterRoles.has(args.partyRole)) throw new Error("Unsupported matter party role.");
  if (args.side && !matterSides.has(args.side)) throw new Error("Unsupported matter party side.");
  const notes = optionalBoundedText(args.notes, "Notes", 2000);
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMatters");
    const reference = await tx.matterParty.findFirst({ where: { id: args.partyId, firmId }, select: { id: true, matterId: true } });
    if (!reference) throw new Error("Matter party was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matter:${firmId}:${reference.matterId}`}))`;
    await assertMatterAccess(tx, firmId, reference.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, reference.matterId, userId, "canEdit");
    const party = await tx.matterParty.findFirst({ where: { id: reference.id, firmId } });
    if (!party || party.status !== "active") throw new Error("Only an active matter party can be changed.");
    const roleChanged = Boolean(args.partyRole && args.partyRole !== party.partyRole);
    const sideChanged = Boolean(args.side && args.side !== party.side);
    if (!args.remove && !roleChanged && !sideChanged && notes == null) throw new Error("A role, side, notes or removal change is required.");
    const matter = await tx.matter.findFirst({ where: { id: party.matterId, firmId }, select: { clientId: true, status: true } });
    if (!matter || ["closed", "declined"].includes(matter.status)) throw new Error("Only parties on an active matter can be changed.");
    if (party.isPrimaryClient && party.contactId !== matter.clientId) throw new Error("Inconsistent primary client requires reviewed correction.");
    if ((args.remove || roleChanged) && (party.isPrimaryClient || party.partyRole === "client" && party.contactId === matter.clientId)) {
      throw new Error("The authoritative matter client cannot be removed or replaced through party maintenance.");
    }
    const updated = await tx.matterParty.update({
      where: { id: party.id },
      data: args.remove
        ? { status: "removed", isPrimaryClient: false }
        : { ...(roleChanged ? { partyRole: args.partyRole } : {}), ...(sideChanged ? { side: args.side } : {}), ...(notes != null ? { notes } : {}) },
      select: { id: true, status: true },
    });
    const conflictCheckId = (roleChanged || sideChanged) && !args.remove
      ? await requireConflictReReview(tx, {
          firmId, userId, matterId: party.matterId, contact: await activeContact(tx, firmId, party.contactId),
          cause: "Matter party relationship changed; review conflicts for the corrected relationship.",
        })
      : null;
    await recordAuditEvent(tx, {
      firmId, actorUserId: userId, eventType: args.remove ? "matter.party_removed" : "matter.party_changed",
      category: "legal_workflow", matterId: party.matterId, contactId: party.contactId,
      metadata: {
        partyId: party.id,
        previous: { partyRole: party.partyRole, side: party.side },
        next: { partyRole: roleChanged ? args.partyRole : party.partyRole, side: sideChanged ? args.side : party.side },
        conflictCheckId,
        reasonDigest: sha256Digest(reason),
      },
    });
    return { ...updated, conflictCheckId };
  });
}
