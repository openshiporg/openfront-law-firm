import Stripe from "stripe";

type CreatePaymentInput = {
  invoice?: { id: string; number?: string; title?: string; email?: string };
  retainer?: { id: string; number?: string; title?: string; email?: string };
  paymentId: string;
  firmId: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  provider?: { credentials?: Record<string, unknown> };
};

type PaymentOperationInput = {
  paymentId: string;
  amount?: number;
  idempotencyKey?: string;
  currency?: string;
  provider?: { credentials?: Record<string, unknown> };
};

type PaymentWebhookInput = {
  event: any;
  headers: Record<string, string> & { __rawBody?: string };
};

const getStripeClient = (provider?: { credentials?: Record<string, unknown> }) => {
  const envName = typeof provider?.credentials?.secretKeyEnv === "string" ? provider.credentials.secretKeyEnv : "STRIPE_SECRET_KEY";
  const stripeKey = process.env[envName];
  if (!stripeKey) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(stripeKey, {
    apiVersion: "2026-09-30.endive",
  });
};

export async function createPaymentFunction({ invoice, retainer, paymentId, firmId, amount, currency, successUrl, cancelUrl, idempotencyKey, provider }: CreatePaymentInput) {
  if (!Number.isSafeInteger(amount) || amount < 1 || !idempotencyKey) throw new Error("Invalid payment amount or idempotency key");
  const stripe = getStripeClient(provider);
  const resource = invoice ?? retainer;
  if (!resource) throw new Error("Invoice or retainer details are required");
  const metadata = { firmId, paymentId, ...(invoice ? { invoiceId: invoice.id } : { retainerId: retainer!.id }) };
  const base = new URL(successUrl).origin;
  const returnUrl = `${base}/portal/payments/return?payment=${encodeURIComponent(paymentId)}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment", success_url: `${returnUrl}&session_id={CHECKOUT_SESSION_ID}`, cancel_url: returnUrl,
    customer_email: resource.email || undefined,
    line_items: [{ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: amount, product_data: { name: resource.title || (invoice ? `Invoice ${resource.number || ""}` : `Retainer ${resource.number || ""}`) } } }],
    metadata, payment_intent_data: { metadata },
  }, { idempotencyKey });
  return { status: "pending", checkoutSessionId: session.id, checkoutUrl: session.url, amount, currency: currency.toUpperCase() };
}

export async function capturePaymentFunction({ paymentId, amount, idempotencyKey, provider }: PaymentOperationInput & { provider?: { credentials?: Record<string, unknown> } }) {
  const stripe = getStripeClient(provider);

  const paymentIntent = await stripe.paymentIntents.capture(
    paymentId,
    { ...(amount ? { amount_to_capture: amount } : {}) },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  return {
    status: paymentIntent.status,
    amount: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    data: paymentIntent,
  };
}

export async function refundPaymentFunction({ paymentId, amount, idempotencyKey, provider }: PaymentOperationInput & { provider?: { credentials?: Record<string, unknown> } }) {
  const stripe = getStripeClient(provider);

  const refund = await stripe.refunds.create({
    payment_intent: paymentId,
    ...(amount ? { amount } : {}),
  }, idempotencyKey ? { idempotencyKey } : undefined);

  return {
    status: refund.status,
    amount: refund.amount,
    currency: refund.currency,
    data: refund,
  };
}

export async function getPaymentStatusFunction({ paymentId, provider }: PaymentOperationInput & { provider?: { credentials?: Record<string, unknown> } }) {
  const stripe = getStripeClient(provider);

  const session = await stripe.checkout.sessions.retrieve(paymentId, { expand: ["payment_intent"] });
  const intent = session.payment_intent as Stripe.PaymentIntent | null;
  return {
    status: session.payment_status === "paid" ? "succeeded" : session.status,
    amount: session.amount_total ?? 0,
    currency: (session.currency ?? "").toUpperCase(),
    paymentIntentId: intent?.id,
    data: session,
  };
}

export async function generatePaymentLinkFunction({ paymentId, provider }: PaymentOperationInput) {
  const stripe = getStripeClient(provider);
  const session = await stripe.checkout.sessions.retrieve(paymentId);
  return session.url;
}

export async function handleWebhookFunction({ event, headers, provider }: PaymentWebhookInput & { provider?: { credentials?: Record<string, unknown> } }) {
  const webhookEnv = typeof provider?.credentials?.webhookSecretEnv === "string" ? provider.credentials.webhookSecretEnv : "STRIPE_WEBHOOK_SECRET";
  const webhookSecret = process.env[webhookEnv];
  if (!webhookSecret) {
    throw new Error('Stripe webhook secret is not configured');
  }

  const stripe = getStripeClient(provider);

  try {
    if (!headers.__rawBody) throw new Error('Raw webhook body is required');
    const stripeEvent = stripe.webhooks.constructEvent(
      headers.__rawBody,
      headers['stripe-signature'],
      webhookSecret
    );

    return {
      isValid: true,
      event: stripeEvent,
      type: stripeEvent.type,
      resource: stripeEvent.data.object,
    };
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`);
  }
} 