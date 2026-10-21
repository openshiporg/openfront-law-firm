import type { Context } from ".keystone/types";

import { isInteractiveHumanSession, type Session } from "../access";
import { sha256Digest } from "../lib/digests";
import { assertLifecycleTransition } from "../lib/lifecycles";
import { runSerializableTransaction } from "../lib/transactions";
import { assertCurrentCommandActor } from "./command-authority";
import { boundedReason, optionalBoundedText, recordAuditEvent, requirePermission } from "./workflow-helpers";

const consultationOutcomes = new Set(["pending", "recommend_engagement", "decline", "follow_up"]);
const reservedStatuses = ["requested", "scheduled"];

function instant(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return date;
}

/** Host locks are taken in a stable order so a reschedule between two hosts cannot deadlock. */
async function lockHosts(tx: any, firmId: string, hostIds: Array<string | null | undefined>) {
  for (const hostId of [...new Set(hostIds.filter(Boolean) as string[])].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consultation-host:${firmId}:${hostId}`}))`;
  }
}

function projection(row: any) {
  return { id: row.id, status: row.status };
}

/** Staff confirm a requested consultation, or move a scheduled one, to a host and time.
 * The booked service title, fee and snapshot are never rewritten. */
export async function scheduleConsultation(
  _root: unknown,
  args: { consultationId: string; startsAt: string; endsAt: string; hostId: string; officeId?: string | null; location?: string | null; reason?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  const startsAt = instant(args.startsAt, "Start");
  const endsAt = instant(args.endsAt, "End");
  if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000) {
    throw new Error("A consultation must end after it starts and last at most eight hours.");
  }
  const location = optionalBoundedText(args.location, "Location", 300);
  const reason = optionalBoundedText(args.reason, "Scheduling reason", 2000);

  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    const reference = await tx.consultation.findFirst({ where: { id: args.consultationId, firmId }, select: { id: true, hostId: true } });
    if (!reference) throw new Error("Consultation was not found in the active firm.");
    await lockHosts(tx, firmId, [reference.hostId, args.hostId]);
    const consultation = await tx.consultation.findFirst({ where: { id: reference.id, firmId } });
    if (!consultation || consultation.hostId !== reference.hostId) throw new Error("Consultation changed concurrently; reload before retrying.");
    if (consultation.status !== "scheduled") assertLifecycleTransition("consultation", consultation.status, "scheduled");

    const host = await tx.firmMembership.findFirst({
      where: { firmId, userId: args.hostId, status: "active", role: { status: "active", canManageIntake: true }, user: { status: "active" } },
      select: { userId: true },
    });
    if (!host) throw new Error("The host must be an active firm member who can take consultations.");
    const office = args.officeId
      ? await tx.office.findFirst({ where: { id: args.officeId, firmId, status: "active" }, select: { id: true, timezone: true } })
      : null;
    if (args.officeId && !office) throw new Error("The selected active office is unavailable in this firm.");

    const overlapping = await tx.consultation.count({
      where: { firmId, hostId: host.userId, id: { not: consultation.id }, status: { in: reservedStatuses }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (overlapping) throw new Error("The host already has a consultation at that time.");

    const updated = await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: "scheduled",
        startsAt,
        endsAt,
        hostId: host.userId,
        ...(office ? { officeId: office.id, timezone: office.timezone || consultation.timezone } : {}),
        ...(location != null ? { location } : {}),
      },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: consultation.status === "scheduled" ? "consultation.rescheduled" : "consultation.scheduled",
      category: "legal_workflow",
      intakeId: consultation.intakeId,
      metadata: {
        consultationId: consultation.id,
        previous: { status: consultation.status, hostId: consultation.hostId, startsAt: consultation.startsAt?.toISOString() ?? null, endsAt: consultation.endsAt?.toISOString() ?? null },
        next: { hostId: host.userId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
        ...(reason ? { reasonDigest: sha256Digest(reason) } : {}),
      },
    });
    return projection(updated);
  });
}

/** Staff close a consultation: completed (with an outcome), cancelled or no-show. */
export async function transitionConsultation(
  _root: unknown,
  args: { consultationId: string; toStatus: string; outcome?: string | null; reason?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageIntake", { humanOnly: true });
  if (!["completed", "cancelled", "no_show"].includes(args.toStatus)) throw new Error("Consultations close as completed, cancelled or no-show.");
  const outcome = args.outcome?.trim() || null;
  if (outcome && !consultationOutcomes.has(outcome)) throw new Error("Unsupported consultation outcome.");
  if (outcome && args.toStatus !== "completed") throw new Error("Only a completed consultation records an outcome.");
  const reason = args.toStatus === "cancelled"
    ? boundedReason(args.reason, "Cancellation reason", 3, 2000)
    : optionalBoundedText(args.reason, "Reason", 2000);

  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    const reference = await tx.consultation.findFirst({ where: { id: args.consultationId, firmId }, select: { id: true, hostId: true } });
    if (!reference) throw new Error("Consultation was not found in the active firm.");
    await lockHosts(tx, firmId, [reference.hostId]);
    const consultation = await tx.consultation.findFirst({ where: { id: reference.id, firmId } });
    if (!consultation) throw new Error("Consultation changed concurrently; reload before retrying.");
    assertLifecycleTransition("consultation", consultation.status, args.toStatus);
    if (args.toStatus !== "cancelled" && (!consultation.startsAt || consultation.startsAt > new Date())) {
      throw new Error("A consultation can be completed or marked no-show only after its scheduled start.");
    }
    const updated = await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: args.toStatus,
        ...(outcome ? { outcome } : {}),
        ...(args.toStatus === "cancelled" ? { cancellationReason: reason ?? "" } : {}),
      },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      eventType: `consultation.${args.toStatus}`,
      category: "legal_workflow",
      intakeId: consultation.intakeId,
      metadata: { consultationId: consultation.id, fromStatus: consultation.status, outcome, ...(reason ? { reasonDigest: sha256Digest(reason) } : {}) },
    });
    return projection(updated);
  });
}

/** The customer who booked a consultation may cancel it while it is still upcoming.
 * Ownership is the account on the consultation itself, re-read in this transaction. */
export async function cancelOwnConsultation(
  _root: unknown,
  args: { consultationId: string; reason?: string | null },
  context: Context,
) {
  const session = context.session as Session | undefined;
  if (!isInteractiveHumanSession(session)) throw new Error("Sign in to manage your consultation.");
  const reason = optionalBoundedText(args.reason, "Cancellation reason", 1000);

  return runSerializableTransaction(context.prisma as any, async (tx: any) => {
    const account = await tx.user.findFirst({ where: { id: session.itemId, status: "active" }, select: { id: true } });
    const reference = account
      ? await tx.consultation.findFirst({ where: { id: args.consultationId, accountId: account.id }, select: { id: true, firmId: true, hostId: true } })
      : null;
    // A foreign or missing consultation reads exactly like an unavailable one.
    if (!reference) throw new Error("This consultation is unavailable.");
    await lockHosts(tx, reference.firmId, [reference.hostId]);
    const consultation = await tx.consultation.findFirst({ where: { id: reference.id, accountId: session.itemId } });
    if (!consultation || !reservedStatuses.includes(consultation.status)) throw new Error("This consultation can no longer be cancelled online.");
    if (consultation.startsAt && consultation.startsAt <= new Date()) throw new Error("This consultation has already started; contact the firm.");
    const updated = await tx.consultation.update({
      where: { id: consultation.id },
      data: { status: "cancelled", cancellationReason: reason ? `Cancelled by client: ${reason}` : "Cancelled by client" },
      select: { id: true, status: true },
    });
    await recordAuditEvent(tx, {
      firmId: consultation.firmId,
      actorUserId: session.itemId,
      actorType: "customer",
      eventType: "consultation.cancelled_by_client",
      category: "legal_workflow",
      intakeId: consultation.intakeId,
      metadata: { consultationId: consultation.id, fromStatus: consultation.status },
    });
    return projection(updated);
  });
}
