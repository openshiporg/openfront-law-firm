import { NextRequest, NextResponse } from "next/server";
import { keystoneContext } from "@/features/keystone/context";
import { prismaWithoutGraphQLErrorConversion } from "@/features/keystone/lib/transactions";
import { handleWebhook } from "@/features/keystone/utils/paymentProviderAdapter";
import { reconcilePaymentByProviderId } from "@/features/keystone/mutations/portalPayments";
import { afterConsultationPaymentCaptured } from "@/features/keystone/mutations/consultationPayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY = 1_000_000;

const secretKeyEnv = (p: any) => typeof p?.credentials?.secretKeyEnv === "string" ? p.credentials.secretKeyEnv : "STRIPE_SECRET_KEY";
function sameProviderAccount(paymentProvider: any, provider: any) {
  if (!paymentProvider) return false;
  if (paymentProvider.id === provider.id) return true;
  const a = process.env[secretKeyEnv(paymentProvider)], b = process.env[secretKeyEnv(provider)];
  return Boolean(a) && a === b;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const { providerId } = await params;
  const prisma = prismaWithoutGraphQLErrorConversion(keystoneContext.prisma) as any;
  const provider = await prisma.paymentProvider.findFirst({ where: { id: providerId, isInstalled: true } });
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  const headers = { "stripe-signature": request.headers.get("stripe-signature") || "", __rawBody: rawBody };
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid event" }, { status: 400 }); }
  try {
    const verified = await handleWebhook({ provider, event, headers });
    if (!verified?.isValid || !verified.event?.id) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    const type = String(verified.type || "");
    if (!["checkout.session.completed", "payment_intent.succeeded"].includes(type)) return NextResponse.json({ received: true });
    const resource = verified.resource || {};
    const paymentId = resource.metadata?.paymentId;
    // The provider account can serve other sites. An event that names no payment of ours is theirs:
    // acknowledge it, or the provider retries it for days and then switches this endpoint off.
    if (typeof paymentId !== "string" || !paymentId) return NextResponse.json({ received: true, ignored: true });
    const known = await prisma.payment.findFirst({ where: { id: paymentId, firmId: provider.firmId }, include: { paymentProvider: true } });
    if (!known) return NextResponse.json({ received: true, ignored: true });
    const key = `provider-webhook:${provider.id}:${verified.event.id}`;
    const prior = await prisma.idempotencyKey.findUnique({ where: { idempotencyKey: key } });
    if (prior?.recoveryPoint === "completed") return NextResponse.json({ received: true, duplicate: true });
    if (!prior) await prisma.idempotencyKey.create({ data: { idempotencyKey: key, requestMethod: "POST", requestPath: "payment-provider-webhook", requestParams: { providerId, eventId: verified.event.id }, recoveryPoint: "verified", lockedAt: new Date() } });
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, firmId: resource.metadata?.firmId } });
    // One endpoint serves every provider record that uses the same provider account (operating and trust).
    if (!payment || resource.metadata?.firmId !== known.firmId || !sameProviderAccount(known.paymentProvider, provider)) throw new Error("Provider event does not correlate to this payment.");
    // Reconcile the Checkout this event is about, which may be an older page than the one stored.
    const checkoutId = type === "checkout.session.completed" && typeof resource.id === "string" && resource.id.startsWith("cs_") ? resource.id : undefined;
    const settled = await reconcilePaymentByProviderId(prisma, payment.id, payment.firmId, undefined, checkoutId);
    if (settled?.status === "captured" && !(settled as any).replayed) await afterConsultationPaymentCaptured(prisma, payment.id);
    // A redelivered event for a fee whose cancellation refund failed retries that refund.
    else if ((settled as any)?.replayed) await afterConsultationPaymentCaptured(prisma, payment.id, true);
    await prisma.idempotencyKey.update({ where: { idempotencyKey: key }, data: { recoveryPoint: "completed", responseCode: 200, responseBody: { paymentId }, lockedAt: null } });
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 400 });
  }
}
