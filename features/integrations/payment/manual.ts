type PaymentOperationInput = {
  paymentId: string;
  amount?: number;
  currency?: string;
  idempotencyKey?: string;
};

/** Manual receipts have no provider ingress. Staff must explicitly record receipt. */
export async function handleWebhookFunction() {
  throw new Error("Manual payment providers do not accept webhook ingress");
}

export async function createPaymentFunction({ amount, currency }: { amount: number; currency: string }) {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("Payment amount must be a positive integer in minor units");
  return { status: "pending", amount, currency: currency.toUpperCase() };
}

export async function capturePaymentFunction({ amount, currency = "USD", idempotencyKey }: PaymentOperationInput) {
  if (!idempotencyKey) throw new Error("Manual capture requires an explicit staff receipt idempotency key");
  if (!Number.isSafeInteger(amount) || (amount ?? 0) < 1) throw new Error("Payment amount must be a positive integer in minor units");
  return { status: "captured", amount, currency: currency.toUpperCase() };
}

export async function refundPaymentFunction() {
  throw new Error("Manual refunds must be recorded and approved through the firm's refund workflow");
}

export async function getPaymentStatusFunction() {
  return { status: "pending" };
}

export async function generatePaymentLinkFunction() {
  return null;
}
