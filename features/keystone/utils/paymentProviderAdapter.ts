import { paymentProviderAdapters } from "../../integrations/payment";

const ADAPTERS = new Set(Object.keys(paymentProviderAdapters));
const OPERATIONS = new Set(["createPaymentFunction", "capturePaymentFunction", "refundPaymentFunction", "getPaymentStatusFunction", "generatePaymentLinkFunction", "handleWebhookFunction"]);
const INPUT_KEYS = new Set(["invoice", "retainer", "firmId", "paymentId", "amount", "currency", "idempotencyKey", "successUrl", "cancelUrl", "refundId", "event", "headers", "rawBody"]);

export function paymentAdapterPayload(provider: any, args: any) {
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args ?? {})) if (INPUT_KEYS.has(key) && value !== undefined) input[key] = value;
  for (const key of ["invoice", "retainer"]) {
    const record = input[key] as Record<string, unknown> | undefined;
    if (record) input[key] = Object.fromEntries(["id", "number", "title", "email"].filter((field) => record[field] !== undefined).map((field) => [field, record[field]]));
  }
  if (input.headers && typeof input.headers === "object") {
    input.headers = Object.fromEntries(Object.entries(input.headers).filter(([key]) => key.toLowerCase() === "stripe-signature" || key === "__rawBody"));
  }
  return { ...input, provider: { id: provider.id, code: provider.code, credentials: provider.credentials || {} } };
}

export async function executeAdapterFunction({ provider, functionName, args }: { provider: any; functionName: string; args: any }) {
  if (!OPERATIONS.has(functionName)) throw new Error("Unknown payment adapter operation");
  const selector = provider?.[functionName];
  if (typeof selector !== "string") throw new Error("Payment adapter is not configured");
  const payload = paymentAdapterPayload(provider, args);
  if (/^https:/i.test(selector)) {
    try {
      const response = await fetch(selector, { method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch { throw new Error("External payment adapter request failed; reconcile the original attempt before retrying"); }
  }
  if (!ADAPTERS.has(selector)) throw new Error("Unknown registered payment adapter");
  try {
    const adapter: any = await paymentProviderAdapters[selector as keyof typeof paymentProviderAdapters]();
    if (typeof adapter[functionName] !== "function") throw new Error();
    return await adapter[functionName](payload);
  } catch { throw new Error(`Payment adapter ${functionName} failed; reconcile the original attempt before retrying`); }
}
export const createPayment = (args: any) => executeAdapterFunction({ ...args, functionName: "createPaymentFunction", args });
export const capturePayment = (args: any) => executeAdapterFunction({ ...args, functionName: "capturePaymentFunction", args });
export const refundPayment = (args: any) => executeAdapterFunction({ ...args, functionName: "refundPaymentFunction", args });
export const getPaymentStatus = (args: any) => executeAdapterFunction({ ...args, functionName: "getPaymentStatusFunction", args });
export const generatePaymentLink = (args: any) => executeAdapterFunction({ ...args, functionName: "generatePaymentLinkFunction", args });
export const handleWebhook = (args: any) => executeAdapterFunction({ ...args, functionName: "handleWebhookFunction", args });
