import { randomUUID } from "node:crypto";
import { authenticatePortalSession } from "../lib/portal-auth";
import { portalShareHeaderSelect, boundPortalShare, portalShareIsCurrent } from "../lib/portal-share-binding";
import { prismaWithoutGraphQLErrorConversion, runSerializableTransaction } from "../lib/transactions";
import { createPayment, getPaymentStatus } from "../utils/paymentProviderAdapter";
import { applyTrustPosting } from "./postTrustTransaction";
import { applyInvoiceAllocation } from "./billingWorkflows";

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
    const retainer = await tx.retainerAgreement.findFirst({ where: { id: args.id, firmId: identity.firmId, clientId: identity.contactId, status: "active", matter: { firmId: identity.firmId, clientId: identity.contactId, portalMatterAccesses: { some: { portalAccountId: identity.portalAccountId, status: "active", canReadInvoices: true } } } }, select: { id: true, agreementNumber: true, matterId: true, clientId: true, currencyCode: true, initialRetainerMinor: true, trustLedgerAccountId: true, trustLedgerAccount: { select: { trustAccountId: true } }, client: { select: { primaryEmail: true } } } });
    if (!retainer?.trustLedgerAccountId || !retainer.initialRetainerMinor || retainer.initialRetainerMinor <= 0) throw new Error("An active retainer with a configured trust ledger and deposit amount is required.");
    return { retainer, amount: retainer.initialRetainerMinor, account: "trust", paymentType: "trust_deposit", matterId: retainer.matterId, payerId: retainer.clientId };
  });

  const provider = await prisma.paymentProvider.findFirst({ where: { firmId: identity.firmId, code: setup.account === "trust" ? "pp_stripe_trust" : "pp_stripe_operating", isInstalled: true } });
  if (!provider) throw new Error("The firm's selected payment account is not configured.");
  const key = `${args.kind}:${args.id}:${setup.amount}`;
  let payment = await prisma.payment.findFirst({ where: { firmId: identity.firmId, idempotencyKey: key } });
  if (!payment) payment = await prisma.payment.create({ data: { firmId: identity.firmId, matterId: setup.matterId, ...(args.kind === "invoice" ? { invoiceId: args.id } : { trustAccountId: (setup as any).retainer.trustLedgerAccount?.trustAccountId }), payerId: setup.payerId, paymentNumber: `PAY-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`, idempotencyKey: key, paymentType: setup.paymentType, status: "pending", amountMinor: setup.amount, refundedMinor: 0, currencyCode: args.kind === "invoice" ? (setup as any).invoice.currencyCode : (setup as any).retainer.currencyCode, providerCode: provider.code, paymentProviderId: provider.id } });
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
  if (!payment) throw new Error("Payment is not available to this portal account.");
  return reconcilePaymentByProviderId(prisma, payment.id, payment.firmId, payment.payerId);
}

export async function reconcilePaymentByProviderId(prisma: any, paymentId: string, firmId: string, payerId?: string) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, firmId, ...(payerId ? { payerId } : {}) }, include: { paymentProvider: true, invoice: true } });
  if (!payment || !payment.providerPaymentId || !payment.paymentProvider) throw new Error("Payment is not available for reconciliation.");
  const status = await getPaymentStatus({ provider: payment.paymentProvider, paymentId: payment.providerPaymentId });
  if (status.status !== "succeeded") return { status: payment.status, paymentId: payment.id };
  if (status.amount !== payment.amountMinor || String(status.currency).toUpperCase() !== payment.currencyCode) throw new Error("Provider payment amount or currency mismatch.");
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-payment:${payment.firmId}:${payment.id}`}))`;
    const current = await tx.payment.findFirst({ where: { id: payment.id, firmId: payment.firmId, ...(payerId ? { payerId } : {}) } });
    if (!current) throw new Error("Payment is no longer available.");
    if (["captured", "settled"].includes(current.status)) return { status: current.status, paymentId: current.id, replayed: true };
    if (current.status !== "pending" && current.status !== "authorized") throw new Error("Payment cannot be reconciled from its current state.");
    await tx.payment.update({ where: { id: current.id }, data: { status: "captured", capturedAt: new Date(), providerPaymentId: payment.providerPaymentId } });
    if (current.paymentType === "operating") {
      if (!current.invoiceId) throw new Error("Operating payment has no invoice.");
      const invoice = await tx.invoice.findFirst({ where: { id: current.invoiceId, firmId: current.firmId } });
      if (!invoice) throw new Error("Payment invoice was not found.");
      await applyInvoiceAllocation(tx, { firmId: current.firmId, paymentId: current.id, invoiceId: invoice.id, amountMinor: Math.min(current.amountMinor, invoice.balanceDueMinor), idempotencyKey: `provider-settlement:${current.id}`, actorUserId: null, note: "Online payment settlement" });
    }
    if (current.paymentType === "trust_deposit") {
      // The deposit's retainer id is carried in the payment idempotency key (`retainer:<id>:<amount>`).
      const retainerId = /^retainer:([^:]+):/.exec(current.idempotencyKey ?? "")?.[1];
      const retainer = retainerId ? await tx.retainerAgreement.findFirst({ where: { id: retainerId, firmId: current.firmId, clientId: current.payerId } }) : null;
      if (!retainer?.trustLedgerAccountId) throw new Error("Trust deposit retainer ledger was not found.");
      const ledger = await tx.trustLedgerAccount.findFirst({ where: { id: retainer.trustLedgerAccountId, firmId: current.firmId, status: "active" }, include: { trustAccount: true } });
      if (!ledger || !ledger.trustAccount) throw new Error("Active trust ledger is required for the deposit.");
      if (current.trustAccountId !== ledger.trustAccountId) throw new Error("Payment trust account does not match the trust ledger.");
      await applyTrustPosting(tx, current.firmId, null, {
        idempotencyKey: `online-trust:${current.id}`,
        trustAccountId: ledger.trustAccountId,
        transactionType: "deposit",
        currencyCode: current.currencyCode,
        occurredAt: new Date().toISOString(),
        description: `Online retainer deposit ${current.paymentNumber}`,
        sourcePaymentId: current.id,
        entries: [
          { accountingBucket: "bank_control", direction: "debit", amountMinor: current.amountMinor, currencyCode: current.currencyCode, memo: "Online card deposit" },
          { ledgerAccountId: ledger.id, accountingBucket: "client_liability", direction: "credit", amountMinor: current.amountMinor, currencyCode: current.currencyCode, memo: "Online card deposit" },
        ],
      });
    }
    return { status: "captured", paymentId: current.id, replayed: false };
  });
}
