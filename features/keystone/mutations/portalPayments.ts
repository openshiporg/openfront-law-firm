import { randomUUID } from "node:crypto";
import { authenticatePortalSession } from "../lib/portal-auth";
import { portalShareHeaderSelect, boundPortalShare, portalShareIsCurrent } from "../lib/portal-share-binding";
import { prismaWithoutGraphQLErrorConversion, runSerializableTransaction } from "../lib/transactions";
import { createPayment, getPaymentStatus } from "../utils/paymentProviderAdapter";
import { postTrustTransaction } from "./postTrustTransaction";

function webBase(context: any) {
  const value = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
  return new URL(value).origin;
}

async function portalPaymentIdentity(token: string, context: any) {
  if (!token) throw new Error("Portal session is required.");
  const identity = await authenticatePortalSession(token, context.prisma);
  if (!identity) throw new Error("Portal session is no longer active.");
  return identity;
}

export async function startPortalPayment(_root: unknown, args: { kind: "invoice" | "retainer"; id: string; token: string }, context: any) {
  if (!["invoice", "retainer"].includes(args.kind)) throw new Error("Unsupported payment resource.");
  const identity = await portalPaymentIdentity(args.token, context);
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const setup = await runSerializableTransaction(prisma, async (tx: any) => {
    const where = { firmId: identity.firmId, portalAccountId: identity.portalAccountId, status: "active", resourceType: args.kind === "invoice" ? "invoice" : "invoice", ...(args.kind === "invoice" ? { invoiceId: args.id } : {}) };
    if (args.kind === "invoice") {
      const rows = await tx.portalShare.findMany({ where, take: 20, select: portalShareHeaderSelect });
      const share = rows.map((row: any) => boundPortalShare(row, identity)).find(Boolean);
      if (!share || !await portalShareIsCurrent(tx, share)) throw new Error("Invoice is not shared with this portal account.");
      const invoice = await tx.invoice.findFirst({ where: { id: args.id, firmId: identity.firmId, matterId: share.matterId, clientId: identity.contactId, status: { in: ["issued", "partially_paid", "overdue"] } }, select: { id: true, invoiceNumber: true, matterId: true, clientId: true, currencyCode: true, balanceDueMinor: true, client: { select: { primaryEmail: true } } } });
      if (!invoice || invoice.balanceDueMinor <= 0) throw new Error("Invoice has no payable balance for this client.");
      return { invoice, amount: invoice.balanceDueMinor, account: "operating", paymentType: "operating", matterId: invoice.matterId, payerId: invoice.clientId };
    }
    const retainer = await tx.retainerAgreement.findFirst({ where: { id: args.id, firmId: identity.firmId, clientId: identity.contactId, status: "active", matter: { firmId: identity.firmId, clientId: identity.contactId, portalMatterAccesses: { some: { portalAccountId: identity.portalAccountId, status: "active", canReadInvoices: true } } } }, select: { id: true, agreementNumber: true, matterId: true, clientId: true, currencyCode: true, initialRetainerMinor: true, trustLedgerAccountId: true, client: { select: { primaryEmail: true } } } });
    if (!retainer?.trustLedgerAccountId || !retainer.initialRetainerMinor || retainer.initialRetainerMinor <= 0) throw new Error("An active retainer with a configured trust ledger and deposit amount is required.");
    return { retainer, amount: retainer.initialRetainerMinor, account: "trust", paymentType: "trust_deposit", matterId: retainer.matterId, payerId: retainer.clientId };
  });

  const provider = await prisma.paymentProvider.findFirst({ where: { firmId: identity.firmId, code: setup.account === "trust" ? "pp_stripe_trust" : "pp_stripe_operating", isInstalled: true } });
  if (!provider) throw new Error("The firm's selected payment account is not configured.");
  const key = `${args.kind}:${args.id}:${setup.amount}`;
  let payment = await prisma.payment.findFirst({ where: { firmId: identity.firmId, idempotencyKey: key } });
  if (!payment) payment = await prisma.payment.create({ data: { firmId: identity.firmId, matterId: setup.matterId, ...(args.kind === "invoice" ? { invoiceId: args.id } : { trustAccountId: (setup as any).retainer.trustLedgerAccount.trustAccountId }), payerId: setup.payerId, paymentNumber: `PAY-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`, idempotencyKey: key, paymentType: setup.paymentType, status: "pending", amountMinor: setup.amount, refundedMinor: 0, currencyCode: args.kind === "invoice" ? (setup as any).invoice.currencyCode : (setup as any).retainer.currencyCode, providerCode: provider.code, paymentProviderId: provider.id } });
  const resource = args.kind === "invoice" ? { id: args.id, number: (setup as any).invoice.invoiceNumber, title: `Invoice ${(setup as any).invoice.invoiceNumber}`, email: (setup as any).invoice.client?.primaryEmail } : { id: args.id, number: (setup as any).retainer.agreementNumber, title: `Retainer ${(setup as any).retainer.agreementNumber}`, email: (setup as any).retainer.client?.primaryEmail };
  const result = await createPayment({ provider, amount: payment.amountMinor, currency: payment.currencyCode, paymentId: payment.id, firmId: identity.firmId, idempotencyKey: key, successUrl: `${webBase(context)}/portal/payments/return?payment=${payment.id}`, cancelUrl: `${webBase(context)}/portal/payments/return?payment=${payment.id}`, ...(args.kind === "invoice" ? { invoice: resource } : { retainer: resource }) });
  if (!result?.checkoutUrl) throw new Error("Payment provider did not return a checkout URL.");
  if (payment.providerPaymentId !== result.checkoutSessionId) payment = await prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: result.checkoutSessionId } });
  return { url: result.checkoutUrl, paymentId: payment.id };
}

export async function reconcilePortalPayment(_root: unknown, args: { paymentId: string; token: string }, context: any) {
  const identity = await portalPaymentIdentity(args.token, context);
  const prisma = prismaWithoutGraphQLErrorConversion(context.prisma) as any;
  const payment = await prisma.payment.findFirst({ where: { id: args.paymentId, firmId: identity.firmId, payerId: identity.contactId }, include: { paymentProvider: true, invoice: true } });
  if (!payment || !payment.providerPaymentId || !payment.paymentProvider) throw new Error("Payment is not available to this portal account.");
  const status = await getPaymentStatus({ provider: payment.paymentProvider, paymentId: payment.providerPaymentId });
  if (status.status !== "succeeded") return { status: payment.status, paymentId: payment.id };
  if (status.amount !== payment.amountMinor || String(status.currency).toUpperCase() !== payment.currencyCode) throw new Error("Provider payment amount or currency mismatch.");
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-payment:${payment.firmId}:${payment.id}`}))`;
    const current = await tx.payment.findFirst({ where: { id: payment.id, firmId: payment.firmId, payerId: identity.contactId } });
    if (!current) throw new Error("Payment is no longer available.");
    if (["captured", "settled"].includes(current.status)) return { status: current.status, paymentId: current.id, replayed: true };
    if (current.status !== "pending" && current.status !== "authorized") throw new Error("Payment cannot be reconciled from its current state.");
    await tx.payment.update({ where: { id: current.id }, data: { status: "captured", capturedAt: new Date(), providerPaymentId: payment.providerPaymentId } });
    if (current.paymentType === "operating" && current.invoiceId) {
      const { allocatePayment } = await import("./billingWorkflows");
      // The command requires an authorized staff actor; an external callback cannot impersonate one.
      // Actual internal allocation is implemented as a transaction-safe shared helper in billingWorkflows.
      throw new Error("Invoice allocation settlement helper is not yet available.");
    }
    if (current.paymentType === "trust_deposit") {
      // Trust posting remains exclusively delegated to the canonical posting command.
      throw new Error("Trust deposit requires the canonical trust posting context.");
    }
    return { status: "captured", paymentId: current.id, replayed: false };
  });
}
