import type { Context } from ".keystone/types";
import { randomUUID } from "node:crypto";
import { isHumanIdentitySession } from "../access";
import { prismaWithoutGraphQLErrorConversion, runSerializableTransaction } from "../lib/transactions";
import { createPayment, getPaymentStatus, refundPayment } from "../utils/paymentProviderAdapter";
import { reconcilePaymentByProviderId } from "./portalPayments";
import { recordAuditEvent } from "./workflow-helpers";

/**
 * Paid consultations (Clio Grow / Calendly-style): a practice area with a consultation
 * fee takes card payment through Stripe Checkout right after the request is made. The
 * time is held for the checkout window; an unpaid request is released afterwards. A
 * client cancellation before the start refunds the fee to the card in full.
 */
export const CONSULTATION_PAYMENT_WINDOW_MS = 35 * 60_000;
export const consultationPaymentKey = (consultationId: string) => `consultation:${consultationId}`;
export const consultationIdFromPaymentKey = (key: string | null | undefined) => /^consultation:([^:]+)$/.exec(key ?? "")?.[1] ?? null;
const OPERATING_PROVIDER = "pp_stripe_operating";

export type ConsultationPaymentState = "none" | "due" | "paid" | "refunded" | "expired";

/** Pure: the client-facing payment state of one consultation. */
export function consultationPaymentState(row: { feeMinor: number; status: string }, payment: { status: string; amountMinor: number; refundedMinor?: number | null } | null): ConsultationPaymentState {
  if (row.feeMinor <= 0) return "none";
  if (payment && ["captured", "settled"].includes(payment.status)) {
    return (payment.refundedMinor ?? 0) >= payment.amountMinor ? "refunded" : "paid";
  }
  return row.status === "requested" ? "due" : "expired";
}

/** Pure: an unpaid paid-consultation request older than the checkout window no longer holds its time. */
export function unpaidRequestExpired(row: { feeMinor: number; status: string; createdAt: Date }, paid: boolean, now = Date.now()) {
  return row.feeMinor > 0 && row.status === "requested" && !paid && now - row.createdAt.getTime() > CONSULTATION_PAYMENT_WINDOW_MS;
}

/** Releases held times whose fee was never paid. Runs inside the booking/availability transaction. */
export async function releaseUnpaidConsultations(tx: any, firmId: string) {
  const cutoff = new Date(Date.now() - CONSULTATION_PAYMENT_WINDOW_MS);
  const stale = await tx.consultation.findMany({ where: { firmId, status: "requested", feeMinor: { gt: 0 }, createdAt: { lt: cutoff } }, select: { id: true, intakeId: true, feeMinor: true, status: true, createdAt: true }, take: 50 });
  for (const row of stale) {
    const payment = await tx.payment.findFirst({ where: { firmId, idempotencyKey: consultationPaymentKey(row.id) }, select: { status: true } });
    if (!unpaidRequestExpired(row, Boolean(payment && ["captured", "settled"].includes(payment.status)))) continue;
    await tx.consultation.update({ where: { id: row.id }, data: { status: "cancelled", cancellationReason: "Consultation fee was not paid; the time was released." } });
    if (payment) await tx.payment.updateMany({ where: { firmId, idempotencyKey: consultationPaymentKey(row.id), status: "pending" }, data: { status: "cancelled", failedAt: new Date(), failureReason: "Checkout window ended" } });
    await recordAuditEvent(tx, { firmId, eventType: "consultation.payment_expired", category: "financial", intakeId: row.intakeId, metadata: { consultationId: row.id } });
  }
}

function webBase() {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").origin;
}

async function ownedConsultation(prisma: any, context: Context, consultationId: string) {
  const session = context.session as any;
  if (!isHumanIdentitySession(session) || session.listKey !== "User") throw new Error("Sign in to manage your consultation.");
  const row = await prisma.consultation.findFirst({ where: { id: String(consultationId), accountId: session.itemId }, include: { participants: { select: { id: true, primaryEmail: true }, take: 1 }, account: { select: { email: true } } } });
  if (!row) throw new Error("This consultation is unavailable.");
  return row;
}

export async function consultationPaymentFor(prisma: any, consultation: { id: string; firmId: string }) {
  return prisma.payment.findFirst({ where: { firmId: consultation.firmId, idempotencyKey: consultationPaymentKey(consultation.id) } });
}

/** Customer: open (or reopen) Stripe Checkout for an unpaid consultation fee. */
export async function startConsultationPayment(_root: unknown, args: { consultationId: string }, context: Context) {
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const consultation = await ownedConsultation(prisma, context, args.consultationId);
  if (consultation.feeMinor <= 0) throw new Error("This consultation has no fee.");
  if (consultation.status !== "requested") throw new Error("This consultation can no longer be paid online.");
  if (Date.now() - consultation.createdAt.getTime() > CONSULTATION_PAYMENT_WINDOW_MS - 5 * 60_000) throw new Error("The time held for payment has ended. Request a new time.");
  const payer = consultation.participants[0];
  if (!payer) throw new Error("This consultation is unavailable.");
  const provider = await prisma.paymentProvider.findFirst({ where: { firmId: consultation.firmId, code: OPERATING_PROVIDER, isInstalled: true } });
  if (!provider) throw new Error("Online payment is not configured for this firm.");
  const key = consultationPaymentKey(consultation.id);
  let payment = await prisma.payment.findFirst({ where: { firmId: consultation.firmId, idempotencyKey: key } });
  if (payment && ["captured", "settled"].includes(payment.status)) return { url: null, paymentId: payment.id, status: "paid" };
  if (!payment) {
    payment = await prisma.payment.create({ data: {
      firmId: consultation.firmId, payerId: payer.id, paymentNumber: `PAY-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
      idempotencyKey: key, paymentType: "operating", status: "pending", amountMinor: consultation.feeMinor, refundedMinor: 0,
      currencyCode: consultation.currencyCode, providerCode: provider.code, paymentProviderId: provider.id,
    } });
  }
  // A reopened checkout gets a fresh Stripe idempotency key per attempt minute.
  const attempt = `${key}:${Math.floor(Date.now() / 60_000)}`;
  const page = `${webBase()}/account/appointments/${encodeURIComponent(consultation.id)}`;
  const result = await createPayment({
    provider, amount: payment.amountMinor, currency: payment.currencyCode, paymentId: payment.id, firmId: consultation.firmId, idempotencyKey: attempt,
    successUrl: `${page}?paid=1`, cancelUrl: page,
    consultation: { id: consultation.id, number: consultation.id, title: `${consultation.serviceTitle} consultation fee`, email: consultation.account?.email || payer.primaryEmail || undefined },
  });
  if (!result?.checkoutUrl) throw new Error("Payment provider did not return a checkout URL.");
  await prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: result.checkoutSessionId, status: "pending" } });
  return { url: result.checkoutUrl, paymentId: payment.id, status: "due" };
}

/** After a captured consultation payment: a consultation already cancelled is refunded at once. */
export async function afterConsultationPaymentCaptured(prisma: any, paymentId: string) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId } });
  const consultationId = consultationIdFromPaymentKey(payment?.idempotencyKey);
  if (!payment || !consultationId) return;
  const consultation = await prisma.consultation.findFirst({ where: { id: consultationId, firmId: payment.firmId } });
  if (!consultation) return;
  await recordAuditEvent(prisma, { firmId: payment.firmId, eventType: "consultation.fee_paid", category: "financial", intakeId: consultation.intakeId, paymentId: payment.id, metadata: { consultationId, amountMinor: payment.amountMinor } }).catch(() => undefined);
  if (consultation.status === "cancelled") await refundConsultationFee(prisma, { firmId: payment.firmId, consultationId, actorUserId: consultation.accountId, explanation: "Consultation was released before its payment completed." });
}

/** Customer: confirm the fee after returning from Checkout (the webhook does the same server-side). */
export async function reconcileConsultationPayment(_root: unknown, args: { consultationId: string }, context: Context) {
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const consultation = await ownedConsultation(prisma, context, args.consultationId);
  const payment = await consultationPaymentFor(prisma, consultation);
  if (!payment?.providerPaymentId) return { status: consultationPaymentState(consultation, payment) };
  if (!["captured", "settled"].includes(payment.status)) {
    const result = await reconcilePaymentByProviderId(prisma, payment.id, payment.firmId, payment.payerId);
    if (result.status === "captured" && !(result as any).replayed) await afterConsultationPaymentCaptured(prisma, payment.id);
  }
  return { status: consultationPaymentState(consultation, await consultationPaymentFor(prisma, consultation)) };
}

/** Refunds a captured consultation fee to the card in full and records the refund. Idempotent. */
export async function refundConsultationFee(prisma: any, input: { firmId: string; consultationId: string; actorUserId: string | null; explanation: string }) {
  const key = `${consultationPaymentKey(input.consultationId)}:refund`;
  const prior = await prisma.refund.findFirst({ where: { firmId: input.firmId, idempotencyKey: key } });
  if (prior) return prior;
  const payment = await prisma.payment.findFirst({ where: { firmId: input.firmId, idempotencyKey: consultationPaymentKey(input.consultationId) }, include: { paymentProvider: true } });
  if (!payment || !["captured", "settled"].includes(payment.status) || !payment.paymentProvider || !payment.providerPaymentId) return null;
  const amountMinor = payment.amountMinor - (payment.refundedMinor ?? 0);
  if (amountMinor <= 0) return null;
  const requester = input.actorUserId ?? (await prisma.consultation.findFirst({ where: { id: input.consultationId }, select: { hostId: true, accountId: true } }))?.accountId;
  if (!requester) return null;
  const status = await getPaymentStatus({ provider: payment.paymentProvider, paymentId: payment.providerPaymentId });
  if (!status?.paymentIntentId) throw new Error("The card payment has no settled charge to refund.");
  const providerRefund = await refundPayment({ provider: payment.paymentProvider, paymentId: status.paymentIntentId, amount: amountMinor, idempotencyKey: `law-consultation-refund:${input.firmId}:${input.consultationId}` });
  const providerRefundId = String(providerRefund?.data?.id ?? "");
  if (!["succeeded", "pending"].includes(providerRefund?.status) || !providerRefundId) throw new Error("The card refund was not accepted; check the provider.");
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund-payment:${input.firmId}:${payment.id}`}))`;
    const again = await tx.refund.findFirst({ where: { firmId: input.firmId, idempotencyKey: key } });
    if (again) return again;
    const now = new Date();
    const refund = await tx.refund.create({ data: {
      firmId: input.firmId, paymentId: payment.id, refundNumber: `REF-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
      idempotencyKey: key, status: "succeeded", reason: "client_request", amountMinor, currencyCode: payment.currencyCode,
      explanation: input.explanation.slice(0, 4000), requestedById: requester, requestedAt: now, processedAt: now, providerRefundId,
    } });
    await tx.payment.update({ where: { id: payment.id }, data: { refundedMinor: { increment: amountMinor } } });
    await recordAuditEvent(tx, { firmId: input.firmId, eventType: "refund.succeeded", category: "financial", actorUserId: input.actorUserId, paymentId: payment.id, metadata: { refundId: refund.id, providerRefundId, amountMinor, source: "consultation_cancelled", consultationId: input.consultationId } });
    return refund;
  });
}
