import { validateHeaderValue } from "node:http";

/** Version 1 uses bounded ASCII wire identifiers. Unsupported Unicode/control
 * input is rejected, never silently normalized into a different event identity. */
export function assertWebhookWireIdentity(eventId: string, eventType: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,299}$/.test(eventId)) throw new Error("Webhook event ID must be an 8–300 character ASCII identifier.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,299}$/.test(eventType)) throw new Error("Webhook event type must be an ASCII identifier.");
}

export function assertWebhookWireHeaders(headers: Record<string, string>) {
  for (const [name, value] of Object.entries(headers)) validateHeaderValue(name, value);
}
