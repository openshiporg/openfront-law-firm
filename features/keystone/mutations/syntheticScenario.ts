import type { Context } from ".keystone/types";
import { requireLocalFixtureFirm, requireOwnedOfflineDatabase } from "../lib/local-fixture";

import { activeFirmId, isInteractiveHumanSession, permissions, type Session } from "../access";
import { runSerializableTransaction } from "../lib/transactions";
import { assertCurrentCommandActor } from "./command-authority";
import { recordAuditEvent } from "./workflow-helpers";

/**
 * Synthetic demo scenario for onboarding — server-authoritative.
 *
 * This is the ONLY place that constructs the clearly-synthetic local demo
 * matter fixtures. A real/custom firm setup is the default onboarding path and
 * never touches this module: `completeFirmOnboarding(seedSyntheticDemo: true)`
 * and the standalone `seedSyntheticDemoScenario(synthetic: true)` mutation are
 * explicit, authenticated, opt-in calls.
 *
 * Boundaries preserved:
 * - Contacts use a reserved `.invalid` address and "Synthetic" names — never
 *   plausible real PII.
 * - Matter, conflict, invoice, and payment identifiers are reserved demo
 *   numbers and every record carries the synthetic marker; invoices are drafts
 *   with synthetic memos and payments stay pending with a reserved idempotency
 *   key.
 * - NO trust ledger accounts, trust transactions, allocations, refunds,
 *   documents, portal accounts, or real communications are created — trust and
 *   accounting ledgers stay untouched and real.
 */

export const SYNTHETIC_DEMO_MARKER = "synthetic-onboarding-demo";
export const SYNTHETIC_DEMO_CONFIRMATION = "synthetic";

const DEMO_CONTACT_EMAIL = "synthetic.client@example.invalid";
const DEMO_MATTER_NUMBER = "DEMO-0001";
const DEMO_CHECK_NUMBER = "CONFLICT-DEMO-0001";
const DEMO_INVOICE_NUMBER = "INV-DEMO-0001";
const DEMO_PAYMENT_NUMBER = "PAY-DEMO-0001";
const DEMO_PAYMENT_IDEMPOTENCY_KEY = "synthetic-onboarding-demo-payment-0001";

export type SyntheticDemoScenarioResult = {
  firmId: string;
  contactId: string;
  matterId: string;
  conflictCheckId: string;
  invoiceId: string;
  paymentId: string;
};

/**
 * Create (idempotently) the clearly-synthetic demo scenario within an active
 * firm, inside an existing transaction. All writes are reserved-identifier
 * upserts so re-running onboarding or the seed never duplicates fixtures.
 *
 * Every caller goes through the same firm seed lock and owned-offline fixture
 * admission here, before any write, so no entry point can seed a real firm.
 */
export async function applySyntheticDemoScenario(
  tx: any,
  args: { firmId: string; actorUserId: string },
): Promise<Omit<SyntheticDemoScenarioResult, "firmId">> {
  const { firmId, actorUserId } = args;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`synthetic-demo:${firmId}`}))`;
  await requireLocalFixtureFirm(tx, firmId);
  const now = Date.now();
  const openedAt = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const invoiceDueAt = new Date(now + 14 * 24 * 60 * 60 * 1000);

  const practiceArea = await tx.practiceArea.findFirst({ where: { firmId, code: "GENERAL" } });

  let contact = await tx.contact.findFirst({ where: { firmId, primaryEmail: DEMO_CONTACT_EMAIL } });
  contact ??= await tx.contact.create({
    data: {
      firmId,
      contactType: "person",
      status: "client",
      firstName: "Synthetic",
      lastName: "Client",
      primaryEmail: DEMO_CONTACT_EMAIL,
      conflictSearchAliases: ["Synthetic Demo Client"],
    },
  });

  const matter = await tx.matter.upsert({
    where: { firmId_matterNumber: { firmId, matterNumber: DEMO_MATTER_NUMBER } },
    update: {},
    create: {
      firmId,
      matterNumber: DEMO_MATTER_NUMBER,
      title: "Synthetic onboarding matter",
      status: "proposed",
      confidentiality: "standard",
      clientId: contact.id,
      practiceAreaId: practiceArea?.id ?? null,
      responsibleAttorneyId: actorUserId,
      description: "Synthetic onboarding fixture; not a real client or legal matter.",
      openedAt,
      customData: { demoMarker: SYNTHETIC_DEMO_MARKER },
    },
  });
  await tx.matter.updateMany({ where: { id: matter.id, openedAt: null }, data: { openedAt } });

  await tx.matterTeamMember.upsert({
    where: { matterId_userId: { matterId: matter.id, userId: actorUserId } },
    update: { status: "active", canAccessRestricted: true },
    create: {
      firmId,
      matterId: matter.id,
      userId: actorUserId,
      teamRole: "responsible_attorney",
      status: "active",
      canAccessRestricted: true,
      canEdit: true,
      canBill: true,
    },
  });
  await tx.matter.update({
    where: { id: matter.id },
    data: { authorizedUsers: { connect: { id: actorUserId } } },
  });

  const conflictCheck = await tx.conflictCheck.upsert({
    where: { firmId_checkNumber: { firmId, checkNumber: DEMO_CHECK_NUMBER } },
    update: {},
    create: {
      firmId,
      matterId: matter.id,
      checkNumber: DEMO_CHECK_NUMBER,
      status: "requested",
      requestedById: actorUserId,
      searchScope: "contacts_and_matters",
      searchVersion: "v1",
      summary: "Synthetic conflict workflow fixture.",
    },
  });
  if (!(await tx.conflictSearchTerm.count({ where: { checkId: conflictCheck.id } }))) {
    await tx.conflictSearchTerm.create({
      data: {
        firmId,
        matterId: matter.id,
        checkId: conflictCheck.id,
        term: "Synthetic Client",
        normalizedTerm: "synthetic client",
        termType: "person",
        sourceContactId: contact.id,
      },
    });
  }

  const invoice = await tx.invoice.upsert({
    where: { firmId_invoiceNumber: { firmId, invoiceNumber: DEMO_INVOICE_NUMBER } },
    update: {},
    create: {
      firmId,
      matterId: matter.id,
      clientId: contact.id,
      invoiceNumber: DEMO_INVOICE_NUMBER,
      status: "draft",
      currencyCode: "USD",
      subtotalMinor: 25_000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 25_000,
      paidMinor: 0,
      balanceDueMinor: 25_000,
      dueAt: invoiceDueAt,
      memo: "Synthetic local invoice fixture.",
    },
  });
  await tx.invoice.updateMany({ where: { id: invoice.id, dueAt: null }, data: { dueAt: invoiceDueAt } });
  if (!(await tx.invoiceLine.count({ where: { invoiceId: invoice.id } }))) {
    await tx.invoiceLine.create({
      data: {
        firmId,
        matterId: matter.id,
        invoiceId: invoice.id,
        lineType: "flat_fee",
        description: "Synthetic fixed-fee service",
        quantity: 1,
        unitAmountMinor: 25_000,
        subtotalMinor: 25_000,
        discountMinor: 0,
        taxMinor: 0,
        lineTotalMinor: 25_000,
        currencyCode: "USD",
      },
    });
  }

  const payment = await tx.payment.upsert({
    where: { firmId_paymentNumber: { firmId, paymentNumber: DEMO_PAYMENT_NUMBER } },
    update: {},
    create: {
      firmId,
      matterId: matter.id,
      invoiceId: invoice.id,
      payerId: contact.id,
      paymentNumber: DEMO_PAYMENT_NUMBER,
      idempotencyKey: DEMO_PAYMENT_IDEMPOTENCY_KEY,
      paymentType: "operating",
      status: "pending",
      amountMinor: 25_000,
      refundedMinor: 0,
      currencyCode: "USD",
      receivedById: actorUserId,
    },
  });

  const services = [
    { code: "LEASE", name: "Lease document intake", description: "Fictional appointment for a lease-document intake exercise. No legal advice or representation.", consultationFeeMinor: 12500, consultationMinutes: 30 },
    { code: "BUSINESS", name: "Business document intake", description: "Fictional appointment for a business-document intake exercise. No legal advice or representation.", consultationFeeMinor: 18000, consultationMinutes: 60 },
    { code: "ESTATE", name: "Estate document intake", description: "Fictional appointment for an estate-document intake exercise. No legal advice or representation.", consultationFeeMinor: 15000, consultationMinutes: 45 },
  ];
  for (const data of services) {
    await tx.practiceArea.upsert({ where: { firmId_code: { firmId, code: data.code } }, update: {}, create: { firmId, status: "active", isPublic: true, ...data } });
  }
  for (const [index, names] of [["Avery", "Stone"], ["Morgan", "Reed"], ["Jordan", "Lane"]].entries()) {
    const email = `${names.join('.').toLowerCase()}@example.invalid`;
    let client = await tx.contact.findFirst({ where: { firmId, primaryEmail: email } });
    client ??= await tx.contact.create({ data: { firmId, firstName: names[0], lastName: names[1], primaryEmail: email, contactType: "person", status: "client", conflictSearchAliases: [] } });
    const service = await tx.practiceArea.findUnique({ where: { firmId_code: { firmId, code: services[index].code } } });
    const record = await tx.matter.upsert({ where: { firmId_matterNumber: { firmId, matterNumber: `HP-2026-00${index + 1}` } }, update: {}, create: { firmId, clientId: client.id, practiceAreaId: service.id, matterNumber: `HP-2026-00${index + 1}`, title: ["Cedar Street lease documents", "Willow workshop formation documents", "Oak Avenue estate documents"][index], status: "proposed", confidentiality: "standard", responsibleAttorneyId: actorUserId, description: "Fictional local record. No attorney-client relationship or legal review is asserted.", customData: { demoMarker: SYNTHETIC_DEMO_MARKER } } });
    await tx.matterTeamMember.upsert({ where: { matterId_userId: { matterId: record.id, userId: actorUserId } }, update: {}, create: { firmId, matterId: record.id, userId: actorUserId, status: "active", teamRole: "observer", canAccessRestricted: true, canEdit: true, canBill: true } });
    await tx.matter.update({ where: { id: record.id }, data: { authorizedUsers: { connect: { id: actorUserId } } } });
  }

  return {
    contactId: contact.id,
    matterId: matter.id,
    conflictCheckId: conflictCheck.id,
    invoiceId: invoice.id,
    paymentId: payment.id,
  };
}

/**
 * Standalone authenticated mutation: seed the synthetic demo scenario into the
 * caller's active firm. Requires an explicit `synthetic: true` confirmation and
 * the caller's current membership onboarding authority, re-read and locked in
 * the seed transaction — it can never be invoked to fabricate real-looking
 * fixtures by accident or from a stale bootstrap role.
 */
export async function seedSyntheticDemoScenario(
  _root: unknown,
  args: { synthetic: boolean },
  context: Context,
): Promise<SyntheticDemoScenarioResult> {
  const session = context.session as Session | undefined;
  if (!isInteractiveHumanSession(session) || session.data.status !== "active") {
    throw new Error("An active human administrator with onboarding authority is required to seed the synthetic demo.");
  }
  if (args.synthetic !== true) {
    throw new Error(`Synthetic demo seeding requires explicit confirmation: ${SYNTHETIC_DEMO_CONFIRMATION}: true.`);
  }
  const firmId = activeFirmId(session);
  if (!firmId) throw new Error("An active firm is required to seed the synthetic demo.");
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageOnboarding");
    const firm = await tx.firm.findUnique({ where: { id: firmId } });
    if (!firm || firm.status !== "active") throw new Error("The active firm must be published before seeding the synthetic demo.");
    const result = await applySyntheticDemoScenario(tx, { firmId, actorUserId: session.itemId });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "firm.synthetic_demo_seeded",
      category: "legal_workflow",
      outcome: "succeeded",
      actorUserId: session.itemId,
      matterId: result.matterId,
      metadata: { synthetic: true, marker: SYNTHETIC_DEMO_MARKER },
    });
    return { firmId, ...result };
  });
}
/** Lets onboarding show the fictional demo option as unavailable before submit. It
 * only says whether this deployment is an owned offline workspace and the viewer
 * could run onboarding; the seed itself still re-checks everything per firm. */
export async function viewerCanSeedSyntheticDemo(_root: unknown, _args: unknown, context: Context) {
  const session = context.session as Session | undefined;
  if (!isInteractiveHumanSession(session) || !permissions.canManageOnboarding({ session })) return false;
  try {
    await requireOwnedOfflineDatabase(context.prisma as any);
    return true;
  } catch {
    return false;
  }
}
