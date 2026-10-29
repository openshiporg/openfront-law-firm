import { paymentProviderAdapters } from "../../integrations/payment";

const ADAPTERS = new Set(Object.keys(paymentProviderAdapters));
const OPERATIONS = new Set(["createPaymentFunction", "capturePaymentFunction", "refundPaymentFunction", "getPaymentStatusFunction", "generatePaymentLinkFunction", "handleWebhookFunction"]);

export async function executeAdapterFunction({ provider, functionName, args }: { provider: any; functionName: string; args: any }) {
  if (!OPERATIONS.has(functionName)) throw new Error("Unknown payment adapter operation");
  const selector = provider?.[functionName];
  if (typeof selector !== "string") throw new Error("Payment adapter is not configured");
  const payload = { ...args, provider: { id: provider.id, code: provider.code, credentials: provider.credentials || {} } };
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
