import { assertCurrentCommandActor } from "./command-authority";
import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { assertCommandTarget, assertLifecycleTransition } from "../lib/lifecycles";
import { isGraphqlInt } from "../lib/int32";
import { runSerializableTransaction } from "../lib/transactions";
import {
  assertMatterAccess,
  assertMatterTeamCapability,
  boundedReason,
  optionalBoundedText,
  recordAuditEvent,
  requirePermission,
} from "./workflow-helpers";

function idempotencyKey(value: string) {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 160) {
    throw new Error("Idempotency key must be between 12 and 160 characters.");
  }
  return key;
}

function timestamp(value: string | null | undefined, label: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return parsed;
}

async function lineTotals(tx: any, invoiceId: string) {
  const [count, totals] = await Promise.all([
    tx.invoiceLine.count({ where: { invoiceId } }),
    tx.invoiceLine.aggregate({
      where: { invoiceId },
      _sum: {
        subtotalMinor: true,
        discountMinor: true,
        taxMinor: true,
        lineTotalMinor: true,
      },
    }),
  ]);
  return { count, totals: totals._sum };
}

export async function transitionInvoice(
  _root: unknown,
  args: {
    invoiceId: string;
    toStatus: "approved" | "issued" | "overdue" | "void";
    reason?: string | null;
    dueAt?: string | null;
  },
  context: Context,
) {
  assertCommandTarget("invoice", args.toStatus, ["approved", "issued", "overdue", "void"]);
  const { firmId, userId } = requirePermission(context, "canManageBilling", { humanOnly: true });
  const reason = args.toStatus === "void"
    ? boundedReason(args.reason, "Invoice void reason", 5, 2000)
    : optionalBoundedText(args.reason, "Invoice transition reason", 2000);
  const dueAt = timestamp(args.dueAt, "Invoice due date");
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageBilling");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${firmId}:${args.invoiceId}`}))`;
    const invoice = await tx.invoice.findFirst({
      where: { id: args.invoiceId, firmId },
      include: { lines: { select: { id: true, timeEntryId: true, expense: { select: { id: true } } } } },
    });
    if (!invoice) throw new Error("Invoice was not found in the active firm.");
    await assertMatterAccess(tx, firmId, invoice.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, invoice.matterId, userId, "canBill");
    if (invoice.status === args.toStatus) return { invoice, replayed: true };
    assertLifecycleTransition("invoice", invoice.status, args.toStatus);

    const { count, totals } = await lineTotals(tx, invoice.id);
    const timeIds = invoice.lines.flatMap((line: any) => line.timeEntryId ? [line.timeEntryId] : []);
    const expenseIds = invoice.lines.flatMap((line: any) => line.expense?.id ? [line.expense.id] : []);
    if (["approved", "issued"].includes(args.toStatus)) {
      if (!count) throw new Error("Invoice approval requires at least one immutable line snapshot.");
      if (
        ![totals.subtotalMinor, totals.discountMinor, totals.taxMinor, totals.lineTotalMinor, invoice.subtotalMinor, invoice.discountMinor, invoice.taxMinor, invoice.totalMinor].every((value) => isGraphqlInt(value ?? 0)) ||
        (totals.subtotalMinor ?? 0) !== invoice.subtotalMinor ||
        (totals.discountMinor ?? 0) !== invoice.discountMinor ||
        (totals.taxMinor ?? 0) !== invoice.taxMinor ||
        (totals.lineTotalMinor ?? 0) !== invoice.totalMinor ||
        invoice.totalMinor !== invoice.subtotalMinor - invoice.discountMinor + invoice.taxMinor
      ) {
        throw new Error("Invoice totals must exactly match immutable line snapshots.");
      }
      const [billableTimeCount, billableExpenseCount] = await Promise.all([
        timeIds.length ? tx.timeEntry.count({ where: { id: { in: timeIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true } }) : 0,
        expenseIds.length ? tx.expense.count({ where: { id: { in: expenseIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true } }) : 0,
      ]);
      if (billableTimeCount !== timeIds.length || billableExpenseCount !== expenseIds.length) {
        throw new Error("Every invoice source must remain approved, billable, and scoped to the invoice matter.");
      }
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: args.toStatus };
    if (args.toStatus === "issued") {
      const effectiveDueAt = dueAt ?? invoice.dueAt;
      if (!effectiveDueAt || effectiveDueAt < now) {
        throw new Error("Invoice issue requires a current or future due date.");
      }
      const [billedTime, billedExpenses] = await Promise.all([
        timeIds.length ? tx.timeEntry.updateMany({ where: { id: { in: timeIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true }, data: { status: "billed" } }) : { count: 0 },
        expenseIds.length ? tx.expense.updateMany({ where: { id: { in: expenseIds }, firmId, matterId: invoice.matterId, status: "approved", isBillable: true }, data: { status: "billed" } }) : { count: 0 },
      ]);
      if (billedTime.count !== timeIds.length || billedExpenses.count !== expenseIds.length) {
        throw new Error("Invoice sources changed before issue; the invoice was not issued.");
      }
      Object.assign(data, { issuedAt: now, dueAt: effectiveDueAt });
    }
    if (args.toStatus === "overdue") {
      if (!invoice.dueAt || invoice.dueAt >= now || invoice.balanceDueMinor <= 0) {
        throw new Error("Only an unpaid invoice past its due date can become overdue.");
      }
    }
    if (args.toStatus === "void") {
      const activeAllocations = await tx.paymentAllocation.count({
        where: {
          invoiceId: invoice.id,
          allocationType: "invoice",
          reversalAllocations: { none: {} },
        },
      });
      if (invoice.paidMinor !== 0 || activeAllocations) {
        throw new Error("An invoice with payment allocations must be reversed or refunded before voiding.");
      }
      if (["draft", "approved"].includes(invoice.status)) {
        const lineIds = invoice.lines.map((line: any) => line.id);
        await tx.invoiceLine.updateMany({
          where: { firmId, invoiceId: invoice.id },
          data: { timeEntryId: null },
        });
        if (lineIds.length) {
          await tx.expense.updateMany({
            where: { firmId, invoiceLineId: { in: lineIds } },
            data: { invoiceLineId: null },
          });
        }
      }
      Object.assign(data, {
        balanceDueMinor: 0,
        voidReason: reason,
        voidedAt: now,
      });
    }

    const updated = await tx.invoice.update({ where: { id: invoice.id }, data });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `invoice.${args.toStatus}`,
      category: "financial",
      actorUserId: userId,
      matterId: invoice.matterId,
      invoiceId: invoice.id,
      metadata: {
        fromStatus: invoice.status,
        toStatus: args.toStatus,
        draftSourceReservationsReleased: args.toStatus === "void" && ["draft", "approved"].includes(invoice.status),
      },
    });
    return { invoice: updated, replayed: false };
  });
}

export async function transitionPayment(
  _root: unknown,
  args: {
    paymentId: string;
    toStatus: "authorized" | "captured" | "settled" | "failed" | "cancelled";
    eventId: string;
    providerPaymentId?: string | null;
    failureReason?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  if (!new Set<string>(["cancelled"]).has(args.toStatus)) {
    throw new Error("Payment provider outcomes are unavailable until authenticated provider ingress is configured.");
  }
  const eventId = idempotencyKey(args.eventId);
  const providerPaymentId = optionalBoundedText(args.providerPaymentId, "Provider payment ID", 500);
  const failureReason = args.toStatus === "failed"
    ? boundedReason(args.failureReason, "Payment failure reason", 3, 2000)
    : optionalBoundedText(args.failureReason, "Payment failure reason", 2000);
  const prisma = context.prisma as any;
  const auditEventId = `payment:${firmId}:${eventId}`;
  const requestDigest = sha256Digest({
    paymentId: args.paymentId,
    toStatus: args.toStatus,
    providerPaymentId: providerPaymentId ?? null,
    failureReason: failureReason ?? null,
  });

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auditEventId}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${firmId}:${args.paymentId}`}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: auditEventId } });
    const payment = await tx.payment.findFirst({
      where: { id: args.paymentId, firmId },
      include: { invoice: { select: { matterId: true } } },
    });
    if (!payment) throw new Error("Payment was not found in the active firm.");
    if (payment.matterId && payment.invoice?.matterId && payment.matterId !== payment.invoice.matterId) {
      throw new Error("Payment and invoice must use the same matter scope.");
    }
    const matterId = payment.matterId ?? payment.invoice?.matterId ?? null;
    if (matterId) {
      await assertMatterAccess(tx, firmId, matterId, userId);
      await assertMatterTeamCapability(tx, firmId, matterId, userId, "canBill");
    }
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Payment event ID was reused with a different payload.");
      }
      return { payment, replayed: true };
    }
    assertLifecycleTransition("payment", payment.status, args.toStatus);
    const now = new Date();
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: args.toStatus,
        ...(providerPaymentId ? { providerPaymentId } : {}),
        ...(args.toStatus === "authorized" ? { authorizedAt: now } : {}),
        ...(args.toStatus === "captured" ? { capturedAt: now } : {}),
        ...(args.toStatus === "settled" ? { settledAt: now } : {}),
        ...(args.toStatus === "failed" ? { failedAt: now, failureReason } : {}),
      },
    });
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: auditEventId,
        eventType: `payment.${args.toStatus}`,
        category: "financial",
        outcome: args.toStatus === "failed" ? "failed" : "succeeded",
        actorUserId: userId,
        actorType: "user",
        matterId,
        paymentId: payment.id,
        occurredAt: now,
        metadata: { fromStatus: payment.status, toStatus: args.toStatus, requestDigest },
      },
    });
    return { payment: updated, replayed: false };
  });
}

function invoiceStatusAfterPayment(invoice: any, paidMinor: number, now: Date) {
  if (paidMinor === invoice.totalMinor) return "paid";
  if (paidMinor > 0) return "partially_paid";
  return invoice.dueAt && invoice.dueAt < now ? "overdue" : "issued";
}

export async function allocatePayment(
  _root: unknown,
  args: {
    paymentId: string;
    invoiceId: string;
    amountMinor: number;
    idempotencyKey: string;
    note?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey);
  if (!isGraphqlInt(args.amountMinor) || args.amountMinor <= 0) {
    throw new Error("Payment allocation amount must be a positive database-range integer minor-unit value.");
  }
  const note = optionalBoundedText(args.note, "Allocation note", 1000);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`allocation:${firmId}:${key}`}))`;
    const replay = await tx.paymentAllocation.findFirst({
      where: { firmId, idempotencyKey: key },
      include: {
        invoice: { select: { matterId: true } },
        payment: { select: { matterId: true } },
      },
    });
    if (replay) {
      if (
        replay.paymentId !== args.paymentId ||
        replay.invoiceId !== args.invoiceId ||
        replay.amountMinor !== args.amountMinor ||
        replay.allocationType !== "invoice" ||
        replay.note !== (note ?? "")
      ) {
        throw new Error("Payment allocation idempotency key was reused with a different payload.");
      }
      if (!replay.invoice) throw new Error("Payment allocation replay invoice is unavailable.");
      await assertMatterAccess(tx, firmId, replay.invoice.matterId, userId);
      await assertMatterTeamCapability(tx, firmId, replay.invoice.matterId, userId, "canBill");
      if (replay.payment?.matterId) {
        await assertMatterAccess(tx, firmId, replay.payment.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.payment.matterId, userId, "canBill");
      }
      return { allocation: replay, replayed: true };
    }
    const [payment, invoice] = await Promise.all([
      tx.payment.findFirst({ where: { id: args.paymentId, firmId } }),
      tx.invoice.findFirst({ where: { id: args.invoiceId, firmId } }),
    ]);
    if (!payment || !invoice) throw new Error("Payment and invoice must exist in the active firm.");
    if (payment.matterId && payment.matterId !== invoice.matterId) {
      throw new Error("Payment and invoice must use the same matter scope.");
    }
    await assertMatterAccess(tx, firmId, invoice.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, invoice.matterId, userId, "canBill");
    if (!new Set(["captured", "settled"]).has(payment.status)) {
      throw new Error("Only a captured or settled payment can be allocated.");
    }
    if (payment.paymentType !== "operating") {
      throw new Error("Trust deposits require a controlled trust-funds application and cannot use operating payment allocation.");
    }
    if (!new Set(["issued", "partially_paid", "overdue"]).has(invoice.status)) {
      throw new Error("Payment can be allocated only to an open issued invoice.");
    }
    if (payment.currencyCode !== invoice.currencyCode) throw new Error("Payment and invoice currencies must match.");
    const sums = await tx.paymentAllocation.groupBy({
      by: ["allocationType"],
      where: { paymentId: payment.id },
      _sum: { amountMinor: true },
    });
    const allocated = sums.reduce((total: number, row: any) =>
      total + (row.allocationType === "reversal" ? -(row._sum.amountMinor ?? 0) : (row._sum.amountMinor ?? 0)), 0);
    const available = payment.amountMinor - payment.refundedMinor - allocated;
    if (args.amountMinor > available) throw new Error("Payment allocation exceeds the unallocated payment amount.");
    if (args.amountMinor > invoice.balanceDueMinor) throw new Error("Payment allocation exceeds the invoice balance.");

    const now = new Date();
    const allocation = await tx.paymentAllocation.create({
      data: {
        firmId,
        matterId: invoice.matterId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        idempotencyKey: key,
        allocationType: "invoice",
        amountMinor: args.amountMinor,
        currencyCode: payment.currencyCode,
        allocatedById: userId,
        allocatedAt: now,
        note: note ?? "",
      },
    });
    const paidMinor = invoice.paidMinor + args.amountMinor;
    const balanceDueMinor = invoice.totalMinor - paidMinor;
    if (!isGraphqlInt(paidMinor) || !isGraphqlInt(balanceDueMinor) || balanceDueMinor < 0) {
      throw new Error("Payment allocation exceeds the invoice integer range.");
    }
    const status = invoiceStatusAfterPayment(invoice, paidMinor, now);
    assertLifecycleTransition("invoice", invoice.status, status);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidMinor,
        balanceDueMinor,
        status,
        ...(status === "paid" ? { paidAt: now } : {}),
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "payment.allocated",
      category: "financial",
      actorUserId: userId,
      matterId: invoice.matterId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      metadata: { allocationId: allocation.id, amountMinor: args.amountMinor, currencyCode: payment.currencyCode },
    });
    return { allocation, replayed: false };
  });
}

export async function reversePaymentAllocation(
  _root: unknown,
  args: { allocationId: string; idempotencyKey: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey);
  const reason = boundedReason(args.reason, "Allocation reversal reason", 5, 1000);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`allocation:${firmId}:${key}`}))`;
    const replay = await tx.paymentAllocation.findFirst({
      where: { firmId, idempotencyKey: key },
      include: {
        invoice: { select: { matterId: true } },
        payment: { select: { matterId: true } },
      },
    });
    if (replay) {
      if (
        replay.reversesAllocationId !== args.allocationId ||
        replay.allocationType !== "reversal" ||
        replay.note !== reason
      ) {
        throw new Error("Allocation reversal idempotency key was reused with a different payload.");
      }
      if (!replay.invoice) throw new Error("Allocation reversal replay invoice is unavailable.");
      await assertMatterAccess(tx, firmId, replay.invoice.matterId, userId);
      await assertMatterTeamCapability(tx, firmId, replay.invoice.matterId, userId, "canBill");
      if (replay.payment?.matterId) {
        await assertMatterAccess(tx, firmId, replay.payment.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.payment.matterId, userId, "canBill");
      }
      return { allocation: replay, replayed: true };
    }
    const original = await tx.paymentAllocation.findFirst({
      where: { id: args.allocationId, firmId, allocationType: "invoice" },
      include: { invoice: true, payment: true, reversalAllocations: true },
    });
    if (!original || !original.invoice || !original.payment) {
      throw new Error("Original invoice allocation was not found in the active firm.");
    }
    if (original.reversalAllocations.length) throw new Error("Payment allocation already has a reversal.");
    await assertMatterAccess(tx, firmId, original.invoice.matterId, userId);
    await assertMatterTeamCapability(tx, firmId, original.invoice.matterId, userId, "canBill");
    const now = new Date();
    const reversal = await tx.paymentAllocation.create({
      data: {
        firmId,
        matterId: original.matterId,
        paymentId: original.paymentId,
        invoiceId: original.invoiceId,
        idempotencyKey: key,
        allocationType: "reversal",
        amountMinor: original.amountMinor,
        currencyCode: original.currencyCode,
        allocatedById: userId,
        allocatedAt: now,
        reversesAllocationId: original.id,
        note: reason,
      },
    });
    const paidMinor = original.invoice.paidMinor - original.amountMinor;
    if (!isGraphqlInt(paidMinor) || paidMinor < 0) throw new Error("Allocation reversal would make invoice paid amount negative or exceed its supported range.");
    const status = invoiceStatusAfterPayment(original.invoice, paidMinor, now);
    await tx.invoice.update({
      where: { id: original.invoice.id },
      data: {
        paidMinor,
        balanceDueMinor: original.invoice.totalMinor - paidMinor,
        status,
        paidAt: null,
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "payment.allocation_reversed",
      category: "financial",
      actorUserId: userId,
      matterId: original.invoice.matterId,
      invoiceId: original.invoice.id,
      paymentId: original.payment.id,
      metadata: { allocationId: original.id, reversalId: reversal.id },
    });
    return { allocation: reversal, replayed: false };
  });
}

const refundReasons = new Set(["overpayment", "duplicate", "matter_closed", "client_request", "other"]);

export async function requestRefund(
  _root: unknown,
  args: {
    paymentId: string;
    amountMinor: number;
    reason: string;
    explanation: string;
    idempotencyKey: string;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey);
  if (!refundReasons.has(args.reason)) throw new Error("Unsupported refund reason.");
  if (!isGraphqlInt(args.amountMinor) || args.amountMinor <= 0) {
    throw new Error("Refund amount must be a positive database-range integer minor-unit value.");
  }
  const explanation = boundedReason(args.explanation, "Refund explanation", 10, 4000);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${firmId}:${key}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund-payment:${firmId}:${args.paymentId}`}))`;
    const replay = await tx.refund.findFirst({
      where: { firmId, idempotencyKey: key },
      include: {
        payment: { select: { matterId: true } },
        invoice: { select: { matterId: true } },
      },
    });
    if (replay) {
      if (
        replay.paymentId !== args.paymentId ||
        replay.amountMinor !== args.amountMinor ||
        replay.reason !== args.reason ||
        replay.explanation !== explanation
      ) {
        throw new Error("Refund idempotency key was reused with a different payload.");
      }
      if (replay.matterId) {
        await assertMatterAccess(tx, firmId, replay.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.matterId, userId, "canBill");
      }
      if (replay.payment?.matterId) {
        await assertMatterAccess(tx, firmId, replay.payment.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.payment.matterId, userId, "canBill");
      }
      if (replay.invoice?.matterId) {
        await assertMatterAccess(tx, firmId, replay.invoice.matterId, userId);
        await assertMatterTeamCapability(tx, firmId, replay.invoice.matterId, userId, "canBill");
      }
      return { refund: replay, replayed: true };
    }
    const payment = await tx.payment.findFirst({
      where: { id: args.paymentId, firmId },
      include: { invoice: { select: { matterId: true } } },
    });
    if (!payment || !new Set(["captured", "settled"]).has(payment.status)) {
      throw new Error("Only a captured or settled active-firm payment can be refunded.");
    }
    if (payment.matterId && payment.invoice?.matterId && payment.matterId !== payment.invoice.matterId) {
      throw new Error("Payment and invoice must use the same matter scope.");
    }
    const matterId = payment.matterId ?? payment.invoice?.matterId ?? null;
    if (matterId) {
      await assertMatterAccess(tx, firmId, matterId, userId);
      await assertMatterTeamCapability(tx, firmId, matterId, userId, "canBill");
    }
    const [pending, allocationSums] = await Promise.all([
      tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: { in: ["requested", "approved", "processing"] },
        },
        _sum: { amountMinor: true },
      }),
      tx.paymentAllocation.groupBy({
        by: ["allocationType"],
        where: { paymentId: payment.id },
        _sum: { amountMinor: true },
      }),
    ]);
    const allocated = allocationSums.reduce((total: number, row: any) =>
      total + (row.allocationType === "reversal" ? -(row._sum.amountMinor ?? 0) : (row._sum.amountMinor ?? 0)), 0);
    const available = payment.amountMinor - payment.refundedMinor - (pending._sum.amountMinor ?? 0) - allocated;
    if (args.amountMinor > available) {
      throw new Error("Refund requests exceed the unallocated captured payment amount.");
    }
    const refund = await tx.refund.create({
      data: {
        firmId,
        matterId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        refundNumber: `REF-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        idempotencyKey: key,
        status: "requested",
        reason: args.reason,
        amountMinor: args.amountMinor,
        currencyCode: payment.currencyCode,
        explanation,
        requestedById: userId,
        requestedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "refund.requested",
      category: "financial",
      actorUserId: userId,
      matterId,
      invoiceId: payment.invoiceId,
      paymentId: payment.id,
      metadata: { refundId: refund.id, amountMinor: args.amountMinor, currencyCode: payment.currencyCode },
    });
    return { refund, replayed: false };
  });
}

export async function reviewRefund(
  _root: unknown,
  args: { refundId: string; decision: "approve" | "cancel"; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  if (!new Set(["approve", "cancel"]).has(args.decision)) throw new Error("Refund decision is invalid.");
  const reason = boundedReason(args.reason, "Refund review reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${firmId}:${args.refundId}`}))`;
    const refund = await tx.refund.findFirst({
      where: { id: args.refundId, firmId },
      include: { invoice: { select: { matterId: true } } },
    });
    if (!refund) throw new Error("Refund was not found in the active firm.");
    const matterId = refund.matterId ?? refund.invoice?.matterId ?? null;
    if (matterId) await assertMatterAccess(tx, firmId, matterId, userId);
    const target = args.decision === "approve" ? "approved" : "cancelled";
    if (refund.status === target) return { refund, replayed: true };
    if (refund.status !== "requested") throw new Error("Refund is no longer awaiting review.");
    if (args.decision === "approve" && refund.requestedById === userId) {
      throw new Error("Refund approval requires a different human reviewer.");
    }
    assertLifecycleTransition("refund", refund.status, target);
    const now = new Date();
    const reviewed = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: target,
        approvedById: args.decision === "approve" ? userId : null,
        approvedAt: args.decision === "approve" ? now : null,
        ...(args.decision === "cancel" ? { failureReason: reason } : {}),
      },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: `refund.${target}`,
      category: "financial",
      actorUserId: userId,
      matterId,
      invoiceId: refund.invoiceId,
      paymentId: refund.paymentId,
      metadata: { refundId: refund.id },
    });
    return { refund: reviewed, replayed: false };
  });
}

export async function recordRefundProviderOutcome(
  _root: unknown,
  args: {
    refundId: string;
    toStatus: "processing" | "succeeded" | "failed";
    eventId: string;
    providerRefundId?: string | null;
    failureReason?: string | null;
  },
  context: Context,
) {
  requirePermission(context, "canManagePayments", { humanOnly: true });
  throw new Error("Refund provider outcomes are unavailable until authenticated provider ingress is configured.");
  const { firmId, userId } = requirePermission(context, "canManagePayments", { humanOnly: true });
  const eventId = idempotencyKey(args.eventId);
  const providerRefundId = optionalBoundedText(args.providerRefundId, "Provider refund ID", 500);
  const failureReason = args.toStatus === "failed"
    ? boundedReason(args.failureReason, "Refund failure reason", 3, 2000)
    : optionalBoundedText(args.failureReason, "Refund failure reason", 2000);
  const auditEventId = `refund:${firmId}:${eventId}`;
  const requestDigest = sha256Digest({
    refundId: args.refundId,
    toStatus: args.toStatus,
    providerRefundId: providerRefundId ?? null,
    failureReason: failureReason ?? null,
  });
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePayments");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auditEventId}))`;
    const initialRefund = await tx.refund.findFirst({
      where: { id: args.refundId, firmId },
      select: { paymentId: true },
    });
    if (!initialRefund) throw new Error("Refund was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund-payment:${firmId}:${initialRefund.paymentId}`}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: auditEventId } });
    const refund = await tx.refund.findFirst({
      where: { id: args.refundId, firmId },
      include: { payment: true, trustTransactions: { include: { entries: true } } },
    });
    if (!refund) throw new Error("Refund was not found in the active firm.");
    if (refund.matterId) await assertMatterAccess(tx, firmId, refund.matterId, userId);
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Refund provider event ID was reused with a different payload.");
      }
      return { refund, replayed: true };
    }
    assertLifecycleTransition("refund", refund.status, args.toStatus);
    if (args.toStatus === "succeeded" && refund.payment.paymentType === "trust_deposit") {
      const posting = refund.trustTransactions[0];
      const entryTotal = (bucket: string, direction: string) => posting?.entries.reduce(
        (total: number, entry: any) => entry.accountingBucket === bucket && entry.direction === direction
          ? total + entry.amountMinor
          : total,
        0,
      ) ?? 0;
      if (
        refund.trustTransactions.length !== 1 ||
        posting.transactionType !== "disbursement" ||
        posting.trustAccountId !== refund.payment.trustAccountId ||
        posting.currencyCode !== refund.currencyCode ||
        entryTotal("client_liability", "debit") !== refund.amountMinor ||
        entryTotal("bank_control", "credit") !== refund.amountMinor ||
        entryTotal("client_liability", "credit") !== 0 ||
        entryTotal("bank_control", "debit") !== 0
      ) {
        throw new Error("A successful trust-deposit refund requires its exact posted trust liability disbursement.");
      }
    }
    if (args.toStatus === "succeeded" && refund.payment.refundedMinor + refund.amountMinor > refund.payment.amountMinor) {
      throw new Error("Refund outcome would exceed the captured payment amount.");
    }
    const now = new Date();
    const updated = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: args.toStatus,
        providerRefundId: providerRefundId ?? "",
        processedAt: args.toStatus === "processing" ? null : now,
        failureReason: args.toStatus === "failed" ? failureReason : "",
      },
    });
    if (args.toStatus === "succeeded") {
      await tx.payment.update({
        where: { id: refund.paymentId },
        data: { refundedMinor: { increment: refund.amountMinor } },
      });
    }
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: auditEventId,
        eventType: `refund.${args.toStatus}`,
        category: "financial",
        outcome: args.toStatus === "failed" ? "failed" : "succeeded",
        actorUserId: userId,
        actorType: "user",
        matterId: refund.matterId,
        invoiceId: refund.invoiceId,
        paymentId: refund.paymentId,
        occurredAt: now,
        metadata: { refundId: refund.id, requestDigest },
      },
    });
    return { refund: updated, replayed: false };
  });
}
