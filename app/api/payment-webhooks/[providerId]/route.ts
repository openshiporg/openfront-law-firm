import { NextRequest, NextResponse } from "next/server";
import { keystoneContext } from "@/features/keystone/context";
import { prismaWithoutGraphQLErrorConversion } from "@/features/keystone/lib/transactions";
import { handleWebhook } from "@/features/keystone/utils/paymentProviderAdapter";
import { reconcilePaymentByProviderId } from "@/features/keystone/mutations/portalPayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY = 1_000_000;

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
    if (!paymentId) throw new Error("Payment correlation metadata is missing.");
    const key = `provider-webhook:${provider.id}:${verified.event.id}`;
    const prior = await prisma.idempotencyKey.findUnique({ where: { idempotencyKey: key } });
    if (prior?.recoveryPoint === "completed") return NextResponse.json({ received: true, duplicate: true });
    if (!prior) await prisma.idempotencyKey.create({ data: { idempotencyKey: key, requestMethod: "POST", requestPath: "payment-provider-webhook", requestParams: { providerId, eventId: verified.event.id }, recoveryPoint: "verified", lockedAt: new Date() } });
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, firmId: resource.metadata?.firmId } });
    if (!payment || payment.paymentProviderId !== resource.id && payment.providerCode !== provider.code) throw new Error("Provider event does not correlate to this payment.");
    await reconcilePaymentByProviderId(prisma, payment.id, payment.firmId);
    await prisma.idempotencyKey.update({ where: { idempotencyKey: key }, data: { recoveryPoint: "completed", responseCode: 200, responseBody: { paymentId }, lockedAt: null } });
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 400 });
  }
}
