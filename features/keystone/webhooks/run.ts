/**
 * Server-only outbox worker entry point: `tsx features/keystone/webhooks/run.ts`.
 * Run it from a scheduler next to the app; it is never reachable over HTTP or
 * GraphQL. Prints only counts, never payloads, addresses or secrets.
 */
import "dotenv/config";

import { keystoneContext } from "../context";
import { prismaWithoutGraphQLErrorConversion } from "../lib/transactions";
import { dispatchCommunicationDeliveries } from "./communication-dispatcher";
import { dispatchWebhookDeliveries } from "./webhook-dispatcher";

async function main() {
  const prisma = prismaWithoutGraphQLErrorConversion(keystoneContext.prisma) as any;
  const webhooks = await dispatchWebhookDeliveries(prisma);
  const communications = await dispatchCommunicationDeliveries(prisma);
  console.log(JSON.stringify({ webhooks, communications }));
  await prisma.$disconnect?.();
}

main().catch((error) => {
  console.error("Outbox dispatch failed:", error instanceof Error ? error.name : "unknown error");
  process.exitCode = 1;
});
