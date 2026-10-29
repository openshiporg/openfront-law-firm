export function isPaymentProviderConfigured(code: string): boolean {
  if (code.startsWith("pp_stripe")) return Boolean(process.env.STRIPE_SECRET_KEY && (process.env.NEXT_PUBLIC_STRIPE_KEY || process.env.STRIPE_PUBLISHABLE_KEY));
  if (code.startsWith("pp_paypal")) return Boolean(process.env.PAYPAL_CLIENT_SECRET && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);
  return code.startsWith("pp_manual");
}
export function getPublicPaymentProviderConfig(code: string) {
  if (!isPaymentProviderConfigured(code)) return null;
  if (code.startsWith("pp_stripe")) return { provider: "stripe" as const, publishableKey: process.env.NEXT_PUBLIC_STRIPE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || "" };
  if (code.startsWith("pp_paypal")) return { provider: "paypal" as const, publishableKey: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "" };
  return null;
}
