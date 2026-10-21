import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { runSerializableTransaction } from "../lib/transactions";
import { assertCurrentCommandActor } from "./command-authority";
import { assertMatterAccess, boundedReason, optionalBoundedText, recordAuditEvent, requirePermission } from "./workflow-helpers";

const entryTypes = new Set(["filing", "order", "hearing", "notice", "service", "correspondence", "other"]);

type DocketEntryFields = {
  title: string;
  entryType: string;
  occurredAt: string;
  filedAt?: string | null;
  enteredAt?: string | null;
  description?: string | null;
  externalEntryId?: string | null;
  sourceUrl?: string | null;
  documentVersionId?: string | null;
};

function optionalInstant(value: string | null | undefined, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return date;
}

function normalizeEntry(fields: DocketEntryFields) {
  const title = String(fields.title ?? "").trim();
  if (!title || title.length > 300) throw new Error("Docket entry title is required and must be 300 characters or fewer.");
  if (!entryTypes.has(fields.entryType)) throw new Error("Unsupported docket entry type.");
  const occurredAt = optionalInstant(fields.occurredAt, "Entry date");
  if (!occurredAt) throw new Error("Entry date is required.");
  const sourceUrl = optionalBoundedText(fields.sourceUrl, "Source URL", 2000) ?? "";
  if (sourceUrl) {
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new Error("Source URL must be a valid https URL.");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Source URL must be a valid https URL.");
  }
  return {
    title,
    entryType: fields.entryType,
    occurredAt,
    filedAt: optionalInstant(fields.filedAt, "Filed date"),
    enteredAt: optionalInstant(fields.enteredAt, "Entered date"),
    description: optionalBoundedText(fields.description, "Description", 8000) ?? "",
    externalEntryId: optionalBoundedText(fields.externalEntryId, "Court entry number", 200) ?? "",
    sourceUrl,
  };
}

async function sameMatterVersion(tx: any, firmId: string, matterId: string, versionId: string | null | undefined) {
  if (!versionId) return null;
  const version = await tx.documentVersion.findFirst({
    where: { id: versionId, firmId, document: { matterId } },
    select: { id: true },
  });
  if (!version) throw new Error("The supporting document must be a version on this docket's matter.");
  return version.id;
}

/** Staff record a court docket entry by hand, as an unverified draft. Provider-fed
 * entries need an authenticated adapter; nothing here marks an entry verified. */
export async function recordDocketEntry(
  _root: unknown,
  args: { docketId: string } & DocketEntryFields,
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  const entry = normalizeEntry(args);
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    const docket = await tx.docket.findFirst({ where: { id: args.docketId, firmId }, select: { id: true, matterId: true, status: true } });
    if (!docket) throw new Error("Docket was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`docket:${firmId}:${docket.id}`}))`;
    await assertMatterAccess(tx, firmId, docket.matterId, userId);
    if (docket.status === "closed") throw new Error("A closed docket cannot receive new entries.");
    const documentVersionId = await sameMatterVersion(tx, firmId, docket.matterId, args.documentVersionId);
    const created = await tx.docketEntry.create({
      data: { firmId, matterId: docket.matterId, docketId: docket.id, status: "draft", isVerified: false, documentVersionId, ...entry },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "calendar.docket_entry_recorded",
      category: "legal_workflow",
      matterId: docket.matterId,
      metadata: { docketEntryId: created.id, docketId: docket.id, entryDigest: sha256Digest({ ...entry, documentVersionId }) },
    });
    return created;
  });
}

/** Corrects a draft entry before it is verified. Verified entries never change. */
export async function reviseDocketEntry(
  _root: unknown,
  args: { entryId: string } & DocketEntryFields,
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  const entry = normalizeEntry(args);
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    const reference = await tx.docketEntry.findFirst({ where: { id: args.entryId, firmId }, select: { id: true, docketId: true } });
    if (!reference) throw new Error("Docket entry was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`docket:${firmId}:${reference.docketId}`}))`;
    const current = await tx.docketEntry.findFirst({ where: { id: reference.id, firmId } });
    if (!current) throw new Error("Docket entry changed concurrently; reload before retrying.");
    await assertMatterAccess(tx, firmId, current.matterId, userId);
    if (current.isVerified || current.status !== "draft") throw new Error("Only an unverified draft docket entry can be revised.");
    const documentVersionId = await sameMatterVersion(tx, firmId, current.matterId, args.documentVersionId);
    const updated = await tx.docketEntry.update({ where: { id: current.id }, data: { ...entry, documentVersionId }, select: { id: true, status: true } });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "calendar.docket_entry_revised",
      category: "legal_workflow",
      matterId: current.matterId,
      metadata: { docketEntryId: current.id, entryDigest: sha256Digest({ ...entry, documentVersionId }) },
    });
    return updated;
  });
}

/** A person with calendar authority checks the entry against the court record and
 * records its outcome. The entry, and any deadline bound to it, then has verified
 * provenance; filed and entered entries need the date the court gives for that state. */
export async function verifyDocketEntry(
  _root: unknown,
  args: { entryId: string; toStatus: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageCalendar", { humanOnly: true });
  if (!["filed", "entered", "rejected", "withdrawn"].includes(args.toStatus)) throw new Error("Unsupported docket entry outcome.");
  const reason = boundedReason(args.reason, "Verification note", 3, 2000);
  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageCalendar");
    const reference = await tx.docketEntry.findFirst({ where: { id: args.entryId, firmId }, select: { id: true, docketId: true } });
    if (!reference) throw new Error("Docket entry was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`docket:${firmId}:${reference.docketId}`}))`;
    const current = await tx.docketEntry.findFirst({ where: { id: reference.id, firmId } });
    if (!current) throw new Error("Docket entry changed concurrently; reload before retrying.");
    await assertMatterAccess(tx, firmId, current.matterId, userId);
    if (current.isVerified) throw new Error("This docket entry is already verified.");
    assertLifecycleTransition("docketEntry", current.status, args.toStatus);
    if (args.toStatus === "filed" && !current.filedAt) throw new Error("Record the court's filed date before verifying a filing.");
    if (args.toStatus === "entered" && !current.enteredAt) throw new Error("Record the court's entered date before verifying an entry.");
    const now = new Date();
    const updated = await tx.docketEntry.update({
      where: { id: current.id },
      data: { status: args.toStatus, isVerified: true, verifiedById: userId, verifiedAt: now },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: "calendar.docket_entry_verified",
      category: "legal_workflow",
      matterId: current.matterId,
      metadata: { docketEntryId: current.id, fromStatus: current.status, toStatus: args.toStatus, reasonDigest: sha256Digest(reason) },
    });
    return updated;
  });
}
