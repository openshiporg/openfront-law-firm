/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { keystoneContext } from "../features/keystone/context";
import { permissionKeys, permissions } from "../features/keystone/access";
import { sha256Digest } from "../features/keystone/lib/digests";
import { prismaWithoutGraphQLErrorConversion } from "../features/keystone/lib/transactions";
import {
  authenticateBearerToken,
  loadActiveHumanSession,
} from "../features/keystone/lib/machine-auth";
import {
  setEthicalWallMember,
  setMatterTeamAccess,
  transitionEthicalWall,
} from "../features/keystone/mutations/accessWorkflows";
import {
  allocatePayment,
  recordRefundProviderOutcome,
  requestRefund,
  reversePaymentAllocation,
  reviewRefund,
  transitionInvoice,
  transitionPayment,
} from "../features/keystone/mutations/billingWorkflows";
import {
  issueAgentCredential,
  issueApiKey,
  issueOAuthClient,
  revokeAgentCredential,
  revokeApiKey,
  revokeOAuthClient,
} from "../features/keystone/mutations/credentials";
import { executeAgentAction } from "../features/keystone/mutations/executeAgentAction";
import { updateAgentGrantAuthority } from "../features/keystone/mutations/grantWorkflows";
import {
  addConflictMatch,
  addConflictSearchTerm,
  changeMatterConfidentiality,
  requestConflictCheck,
  finalizeConflictCheck,
  recordConflictDisposition,
  transitionConflictCheck,
  transitionMatter,
} from "../features/keystone/mutations/legalWorkflows";
import {
  acceptPortalInvitation,
  grantPortalMatterAccess,
  invitePortalAccount,
  portalSharedResource,
  revokePortalGrant,
  sharePortalResource,
} from "../features/keystone/mutations/portalWorkflows";
import { assembleDraftInvoice, reviseDraftDeadline, transitionDeadline } from "../features/keystone/mutations/practiceWorkflows";
import { recordPortalDiscoveryPolicy } from "../features/keystone/mutations/portalPolicyWorkflows";
import {
  addDocumentSigner,
  enqueueWebhookDelivery,
  queueCommunicationMessage,
  recordWebhookDeliveryAttempt,
  rotateIntegrationCredential,
  transitionCommunicationDelivery,
  transitionDocument,
  transitionIntegrationConnection,
  transitionDocumentSigner,
  transitionSignatureRequest,
} from "../features/keystone/mutations/providerWorkflows";
import {
  disposeRetainedDocument,
  placeRetentionHold,
  releaseRetentionHold,
} from "../features/keystone/mutations/retentionWorkflows";
import {
  requestAgentAction,
  reviewAgentAction,
} from "../features/keystone/mutations/agentActions";
import { assertMatterAccess } from "../features/keystone/mutations/workflow-helpers";
import { assertMaintainedMigrationTarget } from "./deploy-maintained-migrations";
import { requireOwnedOfflineDatabase } from "../features/keystone/lib/local-fixture";

const prisma = prismaWithoutGraphQLErrorConversion(keystoneContext.prisma) as any;
const runKey = randomUUID().replaceAll("-", "").slice(0, 12);

function controlledContext(session: any) {
  return keystoneContext.withSession(session) as any;
}

async function queryAccessibleMatter(context: any, matterId: string) {
  return context.query.Matter.findOne({
    where: { id: matterId },
    query: "id confidentiality",
  });
}

async function verifyAllGraphqlCountQueries(context: any) {
  const fields = context.graphql.schema.getQueryType()?.getFields() ?? {};
  const countFields = Object.keys(fields).filter((field) => field.endsWith("Count")).sort();
  assert(countFields.length >= 75, "generated schema should expose every maintained list count");
  for (const field of countFields) {
    const result = await context.graphql.raw({ query: `query RuntimeCountProof { ${field} }` });
    assert.equal(result.errors, undefined, `${field} failed: ${JSON.stringify(result.errors)}`);
    assert.equal(typeof (result.data as any)?.[field], "number", `${field} should return a numeric count`);
  }
  return countFields.length;
}

async function createVersionedDocument(input: {
  firmId: string;
  matterId: string;
  userId: string;
  title: string;
  retentionPolicyId?: string | null;
  confidentiality?: "matter" | "restricted" | "client_shareable";
  createdAt?: Date;
}) {
  const document = await prisma.document.create({
    data: {
      firmId: input.firmId,
      matterId: input.matterId,
      title: input.title,
      status: "draft",
      category: "other",
      confidentiality: input.confidentiality ?? "matter",
      retentionPolicyId: input.retentionPolicyId ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
  const version = await prisma.documentVersion.create({
    data: {
      firmId: input.firmId,
      matterId: input.matterId,
      documentId: document.id,
      versionKey: `runtime-${runKey}-${document.id}`,
      versionNumber: 1,
      fileName: "synthetic-runtime.txt",
      objectKey: `synthetic/runtime/${runKey}/${document.id}`,
      mediaType: "text/plain",
      byteSize: 32,
      checksumSha256: sha256Digest(`synthetic:${document.id}`),
      source: "generated",
      createdById: input.userId,
    },
  });
  await prisma.document.update({ where: { id: document.id }, data: { currentVersionId: version.id } });
  return { document, version };
}

async function ensureReviewer(firmId: string) {
  const email = "law-firm-reviewer@openship.org";
  let role = await prisma.role.findFirst({ where: { firmId, name: "Runtime independent reviewer" } });
  role ??= await prisma.role.create({
    data: {
      firmId,
      name: "Runtime independent reviewer",
      status: "active",
      ...Object.fromEntries(permissionKeys.map((permission) => [permission, true])),
    },
  });
  let user = await prisma.user.findUnique({ where: { email } });
  user ??= await prisma.user.create({
    data: {
      name: "Synthetic Independent Reviewer",
      email,
      password: "",
      status: "active",
      activeFirmId: firmId,
    },
  });
  if (user.activeFirmId !== firmId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { activeFirmId: firmId } });
  }
  await prisma.firmMembership.upsert({
    where: { firmId_userId: { firmId, userId: user.id } },
    update: { status: "active", roleId: role.id },
    create: { firmId, userId: user.id, roleId: role.id, status: "active" },
  });
  const session = await loadActiveHumanSession(prisma, user.id, firmId);
  assert(session, "reviewer session should load");
  return { user, session };
}

async function assertRuntimeProofTarget() {
  if (process.env.RUN_OWNED_DATABASE_TESTS === "1") {
    await requireOwnedOfflineDatabase(prisma);
    return;
  }
  if (process.env.ALLOW_RUNTIME_PROOF === "runtime_law_firm") {
    assertMaintainedMigrationTarget({
      databaseUrl: process.env.DATABASE_URL,
      confirmation: process.env.MIGRATION_CONFIRM_DATABASE,
    });
    return;
  }

  const rawUrl = process.env.DATABASE_URL;
  if (process.env.ALLOW_EPHEMERAL_COMPLETE_RUNTIME !== "1" || !rawUrl) {
    throw new Error("Authorize either the maintained or disposable complete-runtime proof explicitly.");
  }
  const url = new URL(rawUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!localHost || !databaseName.startsWith("law_firm_complete_verify_")) {
    throw new Error("Disposable complete-runtime proof requires a loopback law_firm_complete_verify database.");
  }
}

async function main() {
  await assertRuntimeProofTarget();
  if (!process.env.MACHINE_CREDENTIAL_PEPPER || !process.env.INTEGRATION_CREDENTIAL_KEY) {
    throw new Error("MACHINE_CREDENTIAL_PEPPER and INTEGRATION_CREDENTIAL_KEY are required.");
  }

  const admin = await prisma.user.findUnique({ where: { email: "law-firm@openship.org" } });
  assert(admin?.activeFirmId, "seeded runtime administrator and active firm are required");
  const firmId = admin.activeFirmId;
  const humanSession = await loadActiveHumanSession(prisma, admin.id, firmId);
  assert(humanSession, "active human session should load");
  const humanContext = controlledContext(humanSession);
  const reviewer = await ensureReviewer(firmId);
  const reviewerContext = controlledContext(reviewer.session);

  const contact = await prisma.contact.create({
    data: {
      firmId,
      contactType: "person",
      status: "client",
      firstName: "Runtime",
      lastName: `Client ${runKey}`,
      primaryEmail: `runtime-${runKey}@example.invalid`,
      conflictSearchAliases: [`Runtime Client ${runKey}`],
    },
  });
  const matter = await prisma.matter.create({
    data: {
      firmId,
      matterNumber: `RUNTIME-${runKey}`,
      title: `Synthetic controlled workflow ${runKey}`,
      status: "proposed",
      confidentiality: "standard",
      clientId: contact.id,
      responsibleAttorneyId: admin.id,
      description: "Synthetic runtime proof; not a real client or legal matter.",
    },
  });
  const adminTeam = await setMatterTeamAccess(null, {
    matterId: matter.id,
    userId: admin.id,
    teamRole: "responsible_attorney",
    status: "active",
    canAccessRestricted: true,
    canEdit: true,
    canBill: true,
    reason: "Synthetic runtime responsible-attorney access grant.",
  }, humanContext);
  const reviewerTeam = await setMatterTeamAccess(null, {
    matterId: matter.id,
    userId: reviewer.user.id,
    teamRole: "observer",
    status: "active",
    canAccessRestricted: true,
    canEdit: false,
    canBill: false,
    reason: "Synthetic runtime independent-reviewer access grant.",
  }, humanContext);
  await changeMatterConfidentiality(null, {
    matterId: matter.id,
    confidentiality: "restricted",
    reason: "Synthetic runtime restricted-matter authorization proof.",
  }, humanContext);
  assert(adminTeam.id && reviewerTeam.id, "controlled team assignments should return durable records");
  assert(await queryAccessibleMatter(reviewerContext, matter.id), "active restricted-team grant should authorize reads");
  const teamScopeExpense = await prisma.expense.create({
    data: {
      firmId, matterId: matter.id, incurredById: admin.id, status: "approved", expenseType: "other",
      description: "Synthetic matter billing capability proof", incurredAt: new Date(), amountMinor: 100,
      currencyCode: "USD", approvedById: admin.id, approvedAt: new Date(),
    },
  });
  await setMatterTeamAccess(null, {
    matterId: matter.id, userId: admin.id, teamRole: "responsible_attorney", status: "active",
    canAccessRestricted: true, canEdit: true, canBill: false,
    reason: "Synthetic test temporarily removes matter billing authority.",
  }, humanContext);
  await assert.rejects(assembleDraftInvoice(null, {
    idempotencyKey: `runtime-no-bill-grant-${runKey}`, invoiceNumber: `NO-BILL-${runKey}`,
    matterId: matter.id, clientId: contact.id, expenseIds: [teamScopeExpense.id],
  }, humanContext), /billing authority is not explicitly granted/i);
  await setMatterTeamAccess(null, {
    matterId: matter.id, userId: admin.id, teamRole: "responsible_attorney", status: "active",
    canAccessRestricted: true, canEdit: true, canBill: true,
    reason: "Synthetic test restores matter billing authority.",
  }, humanContext);
  await assert.rejects(
    () => humanContext.query.Matter.updateOne({
      where: { id: matter.id },
      data: { authorizedUsers: { disconnect: [{ id: reviewer.user.id }] } },
      query: "id",
    }),
    /access denied|not allowed|not defined by type/i,
  );
  await assert.rejects(
    () => humanContext.query.Matter.updateOne({
      where: { id: matter.id },
      data: { teamMembers: { disconnect: [{ id: reviewerTeam.id }] } },
      query: "id",
    }),
    /access denied|not allowed|not defined by type/i,
  );
  await setMatterTeamAccess(null, {
    matterId: matter.id,
    userId: reviewer.user.id,
    teamRole: "observer",
    status: "removed",
    canAccessRestricted: true,
    canEdit: false,
    canBill: false,
    reason: "Synthetic runtime removal proof.",
  }, humanContext);
  assert.equal(await queryAccessibleMatter(reviewerContext, matter.id), null, "removed team member must lose restricted access");
  await assert.rejects(
    () => setMatterTeamAccess(null, {
      matterId: matter.id,
      userId: admin.id,
      teamRole: "responsible_attorney",
      status: "removed",
      canAccessRestricted: false,
      canEdit: false,
      canBill: false,
      reason: "Synthetic attempt to remove the final restricted-matter member.",
    }, humanContext),
    /must retain at least one active restricted-access/i,
  );
  await setMatterTeamAccess(null, {
    matterId: matter.id,
    userId: reviewer.user.id,
    teamRole: "observer",
    status: "active",
    canAccessRestricted: true,
    canEdit: false,
    canBill: false,
    reason: "Restore synthetic reviewer after removal proof.",
  }, humanContext);
  assert(await queryAccessibleMatter(reviewerContext, matter.id), "restored restricted-team grant should authorize reads");

  const removalRaceMatter = await prisma.matter.create({
    data: {
      firmId, matterNumber: `ACCESS-RACE-${runKey}`, title: `Restricted member race ${runKey}`,
      status: "open", confidentiality: "standard", clientId: contact.id, responsibleAttorneyId: admin.id,
    },
  });
  for (const [userId, teamRole] of [[admin.id, "responsible_attorney"], [reviewer.user.id, "observer"]] as const) {
    await setMatterTeamAccess(null, {
      matterId: removalRaceMatter.id, userId, teamRole, status: "active",
      canAccessRestricted: true, canEdit: true, canBill: false,
      reason: "Synthetic concurrent final-member guard setup.",
    }, humanContext);
  }
  await changeMatterConfidentiality(null, {
    matterId: removalRaceMatter.id, confidentiality: "restricted",
    reason: "Synthetic concurrent final-member removal proof.",
  }, humanContext);
  const memberRemovalRace = await Promise.allSettled([
    setMatterTeamAccess(null, {
      matterId: removalRaceMatter.id, userId: admin.id, teamRole: "responsible_attorney", status: "removed",
      canAccessRestricted: false, canEdit: false, canBill: false,
      reason: "Synthetic concurrent administrator removal.",
    }, humanContext),
    setMatterTeamAccess(null, {
      matterId: removalRaceMatter.id, userId: reviewer.user.id, teamRole: "observer", status: "removed",
      canAccessRestricted: false, canEdit: false, canBill: false,
      reason: "Synthetic concurrent reviewer removal.",
    }, humanContext),
  ]);
  assert.equal(memberRemovalRace.filter((result) => result.status === "fulfilled").length, 1, "matter-wide lock must preserve one restricted member");
  assert.equal(await prisma.matterTeamMember.count({ where: {
    matterId: removalRaceMatter.id, status: "active", canAccessRestricted: true,
  } }), 1);

  const check = await requestConflictCheck(null, {
    matterId: matter.id,
    checkNumber: `CHECK-${runKey}`,
    initialTerm: `Runtime Client ${runKey}`,
    termType: "person",
  }, humanContext);
  await addConflictSearchTerm(null, {
    checkId: check.id,
    term: `Runtime Client Alias ${runKey}`,
    normalizedTerm: `runtime client alias ${runKey}`,
    termType: "alias",
    sourceContactId: contact.id,
  }, humanContext);
  const match = await addConflictMatch(null, {
    checkId: check.id,
    matchType: "exact_name",
    matchedContactId: contact.id,
    score: 100,
  }, humanContext);
  const sourceCheck = await prisma.conflictCheck.create({
    data: {
      firmId,
      checkNumber: `SOURCE-SCOPE-${runKey}`,
      status: "running",
      requestedById: admin.id,
      searchScope: "matters",
      searchVersion: "runtime-source-scope-proof",
    },
  });
  await prisma.conflictSearchTerm.create({
    data: {
      firmId,
      checkId: sourceCheck.id,
      term: `Source scope ${runKey}`,
      normalizedTerm: `source scope ${runKey}`,
      termType: "matter",
    },
  });
  const sourceMatch = await addConflictMatch(null, {
    checkId: sourceCheck.id,
    matchType: "matter_text",
    matchedMatterId: matter.id,
    score: 90,
  }, humanContext);
  const sourceCheckQuery = {
    query: "query SourceScope($id: ID!) { conflictChecks(where: { id: { equals: $id } }) { id matches { id matchType } } }",
    variables: { id: sourceCheck.id },
  };
  const sourceVisibleBeforeWall = await reviewerContext.graphql.raw(sourceCheckQuery);
  assert.equal(sourceVisibleBeforeWall.errors, undefined, "source-scoped conflict evidence should be queryable before the source wall is active");
  assert.equal((sourceVisibleBeforeWall.data as any)?.conflictChecks?.length, 1);
  assert.equal((sourceVisibleBeforeWall.data as any)?.conflictChecks?.[0]?.matches?.length, 1);
  const emptyCheck = await prisma.conflictCheck.create({
    data: {
      firmId,
      matterId: matter.id,
      checkNumber: `EMPTY-CHECK-${runKey}`,
      status: "running",
      requestedById: admin.id,
      searchScope: "contacts_and_matters",
      searchVersion: "runtime-empty-proof",
    },
  });
  await assert.rejects(
    transitionConflictCheck(null, {
      checkId: emptyCheck.id,
      toStatus: "review_required",
      summary: "Synthetic empty search must not enter review.",
    }, humanContext),
    /nonempty search terms/i,
  );
  await transitionMatter(null, { matterId: matter.id, toStatus: "pending_conflict" }, humanContext);
  await transitionConflictCheck(null, { checkId: check.id, toStatus: "running" }, humanContext);
  await transitionConflictCheck(null, {
    checkId: check.id,
    toStatus: "review_required",
    summary: "Synthetic search completed; explicit review required.",
  }, humanContext);
  await recordConflictDisposition(null, {
    checkId: check.id,
    matchId: match.id,
    outcome: "clear",
    rationale: "Synthetic records were deliberately created for isolated runtime verification.",
    policyReference: "runtime-proof-only",
  }, humanContext);
  await finalizeConflictCheck(null, {
    checkId: check.id,
    outcome: "cleared",
    summary: "Synthetic runtime match was reviewed and cleared for this fixture only.",
  }, humanContext);
  await assert.rejects(
    () => addConflictSearchTerm(null, {
      checkId: check.id,
      term: "late evidence",
      normalizedTerm: "late evidence",
      termType: "other",
    }, humanContext),
    /only before review/i,
  );
  await transitionMatter(null, { matterId: matter.id, toStatus: "open" }, humanContext);

  const deadline = await prisma.deadline.create({
    data: {
      firmId, matterId: matter.id, title: `Draft deadline ${runKey}`, status: "draft",
      deadlineType: "internal", dueAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      timezone: "UTC", source: "manual", isVerified: false,
    },
  });
  await reviseDraftDeadline(null, {
    deadlineId: deadline.id, title: `Revised deadline ${runKey}`,
    dueAt: new Date(Date.now() + 8 * 24 * 60 * 60_000).toISOString(),
    reason: "Synthetic pre-verification deadline correction.",
  }, humanContext);
  await transitionDeadline(null, {
    deadlineId: deadline.id, toStatus: "pending", reason: "Synthetic deadline verification proof.",
  }, humanContext);
  await assert.rejects(
    () => reviseDraftDeadline(null, {
      deadlineId: deadline.id, title: "Late deadline rewrite", reason: "Synthetic post-verification denial proof.",
    }, humanContext),
    /only an unverified draft/i,
  );

  const [assemblyTime, expenseOnly, expenseMixed] = await Promise.all([
    prisma.timeEntry.create({ data: {
      firmId, matterId: matter.id, userId: admin.id, status: "approved", workDate: new Date(),
      durationMinutes: 30, description: "Synthetic mixed invoice time", amountMinor: 5000,
      currencyCode: "USD", approvedById: admin.id, approvedAt: new Date(),
    } }),
    prisma.expense.create({ data: {
      firmId, matterId: matter.id, incurredById: admin.id, status: "approved", expenseType: "filing_fee",
      description: "Synthetic expense-only source", incurredAt: new Date(), amountMinor: 2500,
      currencyCode: "USD", approvedById: admin.id, approvedAt: new Date(),
    } }),
    prisma.expense.create({ data: {
      firmId, matterId: matter.id, incurredById: admin.id, status: "approved", expenseType: "other",
      description: "Synthetic mixed expense source", incurredAt: new Date(), amountMinor: 1500,
      currencyCode: "USD", approvedById: admin.id, approvedAt: new Date(),
    } }),
  ]);
  const expenseOnlyAssembly = await assembleDraftInvoice(null, {
    idempotencyKey: `runtime-expense-only-${runKey}`, invoiceNumber: `EXP-${runKey}`,
    matterId: matter.id, clientId: contact.id, expenseIds: [expenseOnly.id],
  }, humanContext);
  const mixedAssembly = await assembleDraftInvoice(null, {
    idempotencyKey: `runtime-mixed-${runKey}`, invoiceNumber: `MIX-${runKey}`,
    matterId: matter.id, clientId: contact.id, timeEntryIds: [assemblyTime.id], expenseIds: [expenseMixed.id],
  }, humanContext);
  assert.equal((await prisma.expense.findUnique({ where: { id: expenseOnly.id } })).invoiceLineId != null, true);
  assert.equal((await prisma.expense.findUnique({ where: { id: expenseMixed.id } })).invoiceLineId != null, true);
  assert.equal(await prisma.invoiceLine.count({ where: { invoiceId: expenseOnlyAssembly.invoice.id } }), 1);
  assert.equal(await prisma.invoiceLine.count({ where: { invoiceId: mixedAssembly.invoice.id } }), 2);
  await transitionInvoice(null, {
    invoiceId: expenseOnlyAssembly.invoice.id,
    toStatus: "void",
    reason: "Synthetic draft correction releases the reserved source for a corrected bill.",
  }, humanContext);
  assert.equal(await prisma.invoiceLine.count({ where: { invoiceId: expenseOnlyAssembly.invoice.id } }), 1, "discard preserves the original immutable line snapshot");
  assert.equal((await prisma.expense.findUnique({ where: { id: expenseOnly.id } })).invoiceLineId, null, "discard releases the draft source reservation");
  const rebuiltExpenseInvoice = await assembleDraftInvoice(null, {
    idempotencyKey: `runtime-expense-rebuild-${runKey}`, invoiceNumber: `EXP-R-${runKey}`,
    matterId: matter.id, clientId: contact.id, expenseIds: [expenseOnly.id],
  }, humanContext);
  assert.equal(rebuiltExpenseInvoice.replayed, false);
  assert.equal((await prisma.expense.findUnique({ where: { id: expenseOnly.id } })).invoiceLineId != null, true, "released source can be assembled into a corrected draft");
  await prisma.expense.update({ where: { id: expenseMixed.id }, data: { isBillable: false } });
  await assert.rejects(transitionInvoice(null, {
    invoiceId: mixedAssembly.invoice.id,
    toStatus: "approved",
  }, humanContext), /remain approved, billable/i);
  await prisma.expense.update({ where: { id: expenseMixed.id }, data: { isBillable: true } });
  await transitionInvoice(null, { invoiceId: mixedAssembly.invoice.id, toStatus: "approved" }, humanContext);
  await transitionInvoice(null, {
    invoiceId: mixedAssembly.invoice.id,
    toStatus: "issued",
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
  }, humanContext);
  const issuedSourceLinesBeforeCorrection = await prisma.invoiceLine.findMany({
    where: { invoiceId: mixedAssembly.invoice.id },
    orderBy: [{ id: "asc" }],
    select: { id: true, sourceRecordId: true, subtotalMinor: true, lineTotalMinor: true, timeEntryId: true, expense: { select: { id: true } } },
  });
  const issuedSourcePayment = await prisma.payment.create({
    data: {
      firmId, matterId: matter.id, invoiceId: mixedAssembly.invoice.id, payerId: contact.id,
      paymentNumber: `PAY-SOURCE-${runKey}`, idempotencyKey: `runtime-payment-source-${runKey}`,
      paymentType: "operating", status: "captured", amountMinor: 500, refundedMinor: 0,
      currencyCode: "USD", receivedById: admin.id, capturedAt: new Date(),
    },
  });
  const issuedSourceAllocation = await allocatePayment(null, {
    paymentId: issuedSourcePayment.id, invoiceId: mixedAssembly.invoice.id,
    amountMinor: 500, idempotencyKey: `runtime-source-allocation-${runKey}`,
  }, humanContext);
  await assert.rejects(transitionInvoice(null, {
    invoiceId: mixedAssembly.invoice.id,
    toStatus: "void",
    reason: "A live partial payment must block issued-invoice correction.",
  }, humanContext), /payment allocations must be reversed or refunded/i);
  await reversePaymentAllocation(null, {
    allocationId: issuedSourceAllocation.allocation.id,
    idempotencyKey: `runtime-source-reversal-${runKey}`,
    reason: "Synthetic issued-source correction fully reverses the allocated amount.",
  }, humanContext);
  await transitionInvoice(null, {
    invoiceId: mixedAssembly.invoice.id,
    toStatus: "void",
    reason: "Synthetic corrected issued invoice after exact payment-allocation reversal.",
  }, humanContext);
  const issuedSourceLinesAfterCorrection = await prisma.invoiceLine.findMany({
    where: { invoiceId: mixedAssembly.invoice.id },
    orderBy: [{ id: "asc" }],
    select: { id: true, sourceRecordId: true, subtotalMinor: true, lineTotalMinor: true, timeEntryId: true, expense: { select: { id: true } } },
  });
  assert.deepEqual(issuedSourceLinesAfterCorrection, issuedSourceLinesBeforeCorrection, "issued correction must preserve every original source-linked line snapshot");
  assert.equal((await prisma.timeEntry.findUnique({ where: { id: assemblyTime.id } })).status, "billed");
  assert.equal((await prisma.expense.findUnique({ where: { id: expenseMixed.id } })).status, "billed");
  await assert.rejects(assembleDraftInvoice(null, {
    idempotencyKey: `runtime-issued-rebill-denial-${runKey}`, invoiceNumber: `REBILL-${runKey}`,
    matterId: matter.id, clientId: contact.id, timeEntryIds: [assemblyTime.id], expenseIds: [expenseMixed.id],
  }, humanContext), /approved, billable, unbilled/i);
  const nonBillableExpense = await prisma.expense.create({ data: {
    firmId, matterId: matter.id, incurredById: admin.id, status: "approved", expenseType: "other",
    description: "Synthetic non-billable source", incurredAt: new Date(), amountMinor: 500,
    currencyCode: "USD", isBillable: false, approvedById: admin.id, approvedAt: new Date(),
  } });
  await assert.rejects(assembleDraftInvoice(null, {
    idempotencyKey: `runtime-nonbillable-${runKey}`, invoiceNumber: `NONB-${runKey}`,
    matterId: matter.id, clientId: contact.id, expenseIds: [nonBillableExpense.id],
  }, humanContext), /approved, billable, unbilled/i);
  const concurrentExpense = await prisma.expense.create({ data: {
    firmId, matterId: matter.id, incurredById: admin.id, status: "approved", expenseType: "other",
    description: "Synthetic concurrent invoice source", incurredAt: new Date(), amountMinor: 900,
    currencyCode: "USD", approvedById: admin.id, approvedAt: new Date(),
  } });
  const invoiceAssemblyRace = await Promise.allSettled([
    assembleDraftInvoice(null, {
      idempotencyKey: `runtime-assembly-race-a-${runKey}`, invoiceNumber: `RACE-A-${runKey}`,
      matterId: matter.id, clientId: contact.id, expenseIds: [concurrentExpense.id],
    }, humanContext),
    assembleDraftInvoice(null, {
      idempotencyKey: `runtime-assembly-race-b-${runKey}`, invoiceNumber: `RACE-B-${runKey}`,
      matterId: matter.id, clientId: contact.id, expenseIds: [concurrentExpense.id],
    }, humanContext),
  ]);
  assert.equal(invoiceAssemblyRace.filter((result) => result.status === "fulfilled").length, 1, "one expense can enter only one concurrent invoice");

  const invoice = await prisma.invoice.create({
    data: {
      firmId,
      matterId: matter.id,
      clientId: contact.id,
      invoiceNumber: `INV-${runKey}`,
      status: "draft",
      currencyCode: "USD",
      subtotalMinor: 20_000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 20_000,
      paidMinor: 0,
      balanceDueMinor: 20_000,
    },
  });
  await prisma.invoiceLine.create({
    data: {
      firmId,
      matterId: matter.id,
      invoiceId: invoice.id,
      lineType: "flat_fee",
      description: "Synthetic runtime service",
      quantity: 1,
      unitAmountMinor: 20_000,
      subtotalMinor: 20_000,
      discountMinor: 0,
      taxMinor: 0,
      lineTotalMinor: 20_000,
      currencyCode: "USD",
    },
  });
  await transitionInvoice(null, { invoiceId: invoice.id, toStatus: "approved" }, humanContext);
  await transitionInvoice(null, {
    invoiceId: invoice.id,
    toStatus: "issued",
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
  }, humanContext);
  const payment = await prisma.payment.create({
    data: {
      firmId,
      matterId: matter.id,
      invoiceId: invoice.id,
      payerId: contact.id,
      paymentNumber: `PAY-${runKey}`,
      idempotencyKey: `runtime-payment-${runKey}`,
      paymentType: "operating",
      status: "pending",
      amountMinor: 20_000,
      refundedMinor: 0,
      currencyCode: "USD",
      receivedById: admin.id,
    },
  });
  await assert.rejects(
    transitionPayment(null, {
      paymentId: payment.id,
      toStatus: "authorized",
      eventId: `runtime-authorized-${runKey}`,
      providerPaymentId: `provider-${runKey}`,
    }, humanContext),
    /authenticated provider ingress/i,
  );
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "captured", capturedAt: new Date() },
  });
  const allocation = await allocatePayment(null, {
    paymentId: payment.id,
    invoiceId: invoice.id,
    amountMinor: 5_000,
    idempotencyKey: `runtime-allocation-${runKey}`,
  }, humanContext);
  const allocationReplay = await allocatePayment(null, {
    paymentId: payment.id,
    invoiceId: invoice.id,
    amountMinor: 5_000,
    idempotencyKey: `runtime-allocation-${runKey}`,
  }, humanContext);
  assert.equal(allocationReplay.replayed, true);
  await assert.rejects(
    transitionInvoice(null, {
      invoiceId: invoice.id,
      toStatus: "void",
      reason: "A live allocation must block invoice voiding.",
    }, humanContext),
    /payment allocations must be reversed or refunded/i,
  );
  await reversePaymentAllocation(null, {
    allocationId: allocation.allocation.id,
    idempotencyKey: `runtime-reversal-${runKey}`,
    reason: "Synthetic runtime allocation reversal proof.",
  }, humanContext);
  const reversalVoidInvoice = await prisma.invoice.create({
    data: {
      firmId, matterId: matter.id, clientId: contact.id, invoiceNumber: `REV-${runKey}`,
      status: "draft", currencyCode: "USD", subtotalMinor: 1_000, discountMinor: 0, taxMinor: 0,
      totalMinor: 1_000, paidMinor: 0, balanceDueMinor: 1_000,
    },
  });
  await prisma.invoiceLine.create({
    data: {
      firmId, matterId: matter.id, invoiceId: reversalVoidInvoice.id, lineType: "flat_fee",
      description: "Synthetic allocation-reversal void proof", quantity: 1, unitAmountMinor: 1_000,
      subtotalMinor: 1_000, discountMinor: 0, taxMinor: 0, lineTotalMinor: 1_000, currencyCode: "USD",
    },
  });
  await transitionInvoice(null, { invoiceId: reversalVoidInvoice.id, toStatus: "approved" }, humanContext);
  await transitionInvoice(null, {
    invoiceId: reversalVoidInvoice.id, toStatus: "issued",
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
  }, humanContext);
  const reversalVoidPayment = await prisma.payment.create({
    data: {
      firmId, matterId: matter.id, invoiceId: reversalVoidInvoice.id, payerId: contact.id,
      paymentNumber: `PAY-REV-${runKey}`, idempotencyKey: `runtime-payment-rev-${runKey}`,
      paymentType: "operating", status: "captured", amountMinor: 1_000, refundedMinor: 0,
      currencyCode: "USD", receivedById: admin.id, capturedAt: new Date(),
    },
  });
  const voidAllocation = await allocatePayment(null, {
    paymentId: reversalVoidPayment.id, invoiceId: reversalVoidInvoice.id,
    amountMinor: 500, idempotencyKey: `runtime-void-allocation-${runKey}`,
  }, humanContext);
  await reversePaymentAllocation(null, {
    allocationId: voidAllocation.allocation.id,
    idempotencyKey: `runtime-void-reversal-${runKey}`,
    reason: "Synthetic reversal permits invoice void only after effective allocation reaches zero.",
  }, humanContext);
  const voidedInvoice = await transitionInvoice(null, {
    invoiceId: reversalVoidInvoice.id,
    toStatus: "void",
    reason: "Synthetic runtime proof confirms fully reversed allocations permit voiding.",
  }, humanContext);
  assert.equal(voidedInvoice.invoice.status, "void");
  const refund = await requestRefund(null, {
    paymentId: payment.id,
    amountMinor: 2_000,
    reason: "client_request",
    explanation: "Synthetic runtime refund request used to verify independent approval.",
    idempotencyKey: `runtime-refund-${runKey}`,
  }, humanContext);
  await reviewRefund(null, {
    refundId: refund.refund.id,
    decision: "approve",
    reason: "Independent synthetic reviewer approved this runtime-only refund.",
  }, reviewerContext);
  await assert.rejects(
    recordRefundProviderOutcome(null, {
      refundId: refund.refund.id,
      toStatus: "processing",
      eventId: `runtime-refund-processing-${runKey}`,
      providerRefundId: `provider-refund-${runKey}`,
    }, humanContext),
    /authenticated provider ingress/i,
  );
  await prisma.$transaction([
    prisma.refund.update({
      where: { id: refund.refund.id },
      data: { status: "succeeded", processedAt: new Date() },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: { refundedMinor: { increment: refund.refund.amountMinor } },
    }),
  ]);

  const ethicalWall = await prisma.ethicalWall.create({
    data: {
      firmId,
      matterId: matter.id,
      name: `Synthetic wall ${runKey}`,
      status: "draft",
      reason: "Synthetic runtime ethical-wall synchronization proof.",
      policyReference: "runtime-proof-only",
      createdById: admin.id,
    },
  });
  await assert.rejects(
    () => humanContext.query.EthicalWall.updateOne({
      where: { id: ethicalWall.id },
      data: { effectiveAt: new Date().toISOString() },
      query: "id",
    }),
    /access denied|not allowed/i,
  );
  await setEthicalWallMember(null, {
    wallId: ethicalWall.id,
    userId: reviewer.user.id,
    decision: "blocked",
    status: "active",
    reason: "Synthetic reviewer block for exact runtime proof.",
  }, humanContext);
  await transitionEthicalWall(null, {
    wallId: ethicalWall.id,
    toStatus: "active",
    reason: "Activate the synthetic runtime ethical wall.",
  }, humanContext);
  assert.equal(await prisma.matter.count({
    where: { id: matter.id, blockedUsers: { some: { id: reviewer.user.id } } },
  }), 1);
  await assert.rejects(
    () => assertMatterAccess(prisma, firmId, matter.id, reviewer.user.id),
    /not explicitly granted/i,
  );
  assert.equal(await queryAccessibleMatter(reviewerContext, matter.id), null, "active wall block must override a team grant");
  const sourceCheckAfterWall = await reviewerContext.graphql.raw(sourceCheckQuery);
  assert.equal(sourceCheckAfterWall.errors, undefined, "current ethical-wall denial should filter source-linked conflict evidence without resolver errors");
  assert.deepEqual((sourceCheckAfterWall.data as any)?.conflictChecks, [], "an intake/firm-scope conflict check must not retain a copied restricted-source disclosure");
  const sourceMatchAfterWall = await reviewerContext.graphql.raw({
    query: "query SourceMatchScope($id: ID!) { conflictMatches(where: { id: { equals: $id } }) { id matchType } }",
    variables: { id: sourceMatch.id },
  });
  assert.equal(sourceMatchAfterWall.errors, undefined);
  assert.deepEqual((sourceMatchAfterWall.data as any)?.conflictMatches, [], "direct match reads must apply the same live source-matter authorization");
  const overlappingWall = await prisma.ethicalWall.create({
    data: {
      firmId,
      matterId: matter.id,
      name: `Overlapping synthetic wall ${runKey}`,
      status: "draft",
      reason: "Synthetic overlapping-wall synchronization proof.",
      policyReference: "runtime-proof-only",
      createdById: admin.id,
    },
  });
  await setEthicalWallMember(null, {
    wallId: overlappingWall.id,
    userId: reviewer.user.id,
    decision: "blocked",
    status: "active",
    reason: "Synthetic overlapping reviewer block.",
  }, humanContext);
  await transitionEthicalWall(null, {
    wallId: overlappingWall.id,
    toStatus: "active",
    reason: "Activate the overlapping synthetic runtime ethical wall.",
  }, humanContext);
  await transitionEthicalWall(null, {
    wallId: ethicalWall.id,
    toStatus: "lifted",
    reason: "Lift one synthetic wall while an overlapping block remains.",
  }, humanContext);
  assert.equal(await prisma.matter.count({
    where: { id: matter.id, blockedUsers: { some: { id: reviewer.user.id } } },
  }), 1);
  assert.equal(await queryAccessibleMatter(reviewerContext, matter.id), null, "one lifted wall must not erase another active block");
  await transitionEthicalWall(null, {
    wallId: overlappingWall.id,
    toStatus: "lifted",
    reason: "Lift the remaining synthetic runtime ethical wall after proof.",
  }, humanContext);
  assert.equal(await prisma.matter.count({
    where: { id: matter.id, blockedUsers: { some: { id: reviewer.user.id } } },
  }), 0);
  await assertMatterAccess(prisma, firmId, matter.id, reviewer.user.id);
  assert(await queryAccessibleMatter(reviewerContext, matter.id), "lifting every wall should restore the existing team grant");
  const sourceCheckAfterLift = await reviewerContext.graphql.raw(sourceCheckQuery);
  assert.equal(sourceCheckAfterLift.errors, undefined);
  assert.equal((sourceCheckAfterLift.data as any)?.conflictChecks?.length, 1, "lifting the final wall restores source-linked conflict visibility for the authorized reviewer");

  const apiKey = await issueApiKey(null, {
    name: `Runtime API ${runKey}`,
    scopes: ["matters:read", "documents:read", "integrations:write"],
  }, humanContext);
  const apiAuthentication = await authenticateBearerToken(`Bearer ${apiKey.secret}`, prisma);
  assert.equal(apiAuthentication.session?.authenticationType, "api_key");
  assert.equal(permissions.canManageMatters({ session: apiAuthentication.session! }), false);
  const oauthClient = await issueOAuthClient(null, {
    name: `Runtime OAuth ${runKey}`,
    redirectUris: ["https://client.example.invalid/callback"],
    scopes: ["matters:read"],
    description: "Synthetic runtime OAuth client.",
  }, humanContext);
  await revokeOAuthClient(null, { id: oauthClient.client.id, reason: "Runtime OAuth client revocation proof." }, humanContext);

  const integration = await prisma.integrationConnection.create({
    data: {
      firmId,
      ownerId: admin.id,
      name: `Synthetic provider ${runKey}`,
      provider: "runtime_fixture",
      category: "email",
      status: "pending",
    },
  });
  await rotateIntegrationCredential(null, {
    connectionId: integration.id,
    credentialType: "credentials",
    secret: `synthetic-provider-secret-${runKey}`,
  }, humanContext);
  await transitionIntegrationConnection(null, {
    connectionId: integration.id,
    toStatus: "active",
    reason: "Synthetic provider connection verified locally.",
  }, humanContext);
  const subscription = await prisma.webhookSubscription.create({
    data: {
      firmId,
      connectionId: integration.id,
      name: `Runtime webhook ${runKey}`,
      status: "active",
      endpointUrl: "https://receiver.example.invalid/webhook",
      eventTypes: ["runtime.test"],
      signingSecretDigest: sha256Digest(`signing-${runKey}`),
    },
  });
  const mismatchedConnection = await prisma.integrationConnection.create({
    data: {
      firmId, name: `Mismatched webhook connection ${runKey}`, provider: "runtime_fixture",
      category: "other", status: "active",
    },
  });
  await assert.rejects(
    () => enqueueWebhookDelivery(null, {
      matterId: matter.id, connectionId: mismatchedConnection.id, subscriptionId: subscription.id,
      eventId: `mismatch-webhook-${runKey}`, eventType: "runtime.mismatch", payload: { synthetic: true },
    }, humanContext),
    /belong to the selected connection/i,
  );
  const webhook = await enqueueWebhookDelivery(null, {
    matterId: matter.id,
    connectionId: integration.id,
    subscriptionId: subscription.id,
    eventId: `runtime-webhook-${runKey}`,
    eventType: "runtime.test",
    payload: { synthetic: true },
  }, humanContext);
  await assert.rejects(
    () => recordWebhookDeliveryAttempt(null, {
      deliveryId: webhook.id,
      providerEventId: `human-supplied-provider-event-${runKey}`,
      responseStatus: 204,
      responseDigest: sha256Digest("human-supplied-response"),
    }, humanContext),
    /unavailable until an authenticated dispatcher owns the HTTP request/i,
  );
  const apiContext = controlledContext(apiAuthentication.session);
  await assert.rejects(
    () => recordWebhookDeliveryAttempt(null, {
      deliveryId: webhook.id,
      providerEventId: `machine-supplied-provider-event-${runKey}`,
      responseStatus: 202,
      responseDigest: sha256Digest("machine-supplied-response"),
    }, apiContext),
    /unavailable until an authenticated dispatcher owns the HTTP request/i,
  );
  assert.equal((await prisma.webhookDelivery.findUnique({ where: { id: webhook.id } })).status, "pending");
  assert.equal(await prisma.webhookDeliveryAttempt.count({ where: { deliveryId: webhook.id } }), 0);
  assert.equal(await prisma.auditEvent.count({
    where: {
      firmId,
      eventId: { in: [
        `webhook:human-supplied-provider-event-${runKey}`,
        `webhook:machine-supplied-provider-event-${runKey}`,
      ] },
    },
  }), 0);
  await revokeApiKey(null, { id: apiKey.credential.id, reason: "Runtime credential revocation proof." }, humanContext);
  assert.equal((await authenticateBearerToken(`Bearer ${apiKey.secret}`, prisma)).session, null);

  const thread = await prisma.communicationThread.create({
    data: { firmId, matterId: matter.id, subject: `Runtime thread ${runKey}`, status: "open", primaryChannel: "email" },
  });
  const message = await prisma.communicationMessage.create({
    data: {
      firmId,
      matterId: matter.id,
      threadId: thread.id,
      direction: "outbound",
      channel: "email",
      status: "draft",
      subject: "Synthetic runtime notice",
      body: "Synthetic runtime delivery; no external message was sent.",
      senderUserId: admin.id,
    },
  });
  const delivery = await prisma.communicationDelivery.create({
    data: {
      firmId,
      matterId: matter.id,
      messageId: message.id,
      integrationConnectionId: integration.id,
      channel: "email",
      status: "pending",
      recipientContactId: contact.id,
      recipientAddress: contact.primaryEmail,
      provider: "runtime_fixture",
      attemptCount: 0,
    },
  });
  await queueCommunicationMessage(null, {
    messageId: message.id,
    reason: "Explicit synthetic runtime delivery approval.",
  }, humanContext);
  await assert.rejects(
    transitionCommunicationDelivery(null, {
      deliveryId: delivery.id,
      toStatus: "sent",
      providerEventId: `comm-sent-${runKey}`,
      providerMessageId: `message-${runKey}`,
    }, humanContext),
    /authenticated provider ingress/i,
  );
  assert.equal((await prisma.communicationMessage.findUnique({ where: { id: message.id } })).status, "queued");

  const publishTarget = await createVersionedDocument({
    firmId,
    matterId: matter.id,
    userId: admin.id,
    title: `Agent publication target ${runKey}`,
  });
  const signatureDocument = await createVersionedDocument({
    firmId,
    matterId: matter.id,
    userId: admin.id,
    title: `Signature source ${runKey}`,
    confidentiality: "client_shareable",
  });
  await transitionDocument(null, {
    documentId: signatureDocument.document.id,
    toStatus: "active",
    reason: "Synthetic runtime publication proof.",
  }, humanContext);
  const signature = await prisma.signatureRequest.create({
    data: {
      firmId,
      matterId: matter.id,
      documentVersionId: signatureDocument.version.id,
      title: `Runtime signature ${runKey}`,
      status: "draft",
      provider: "runtime_fixture",
      integrationConnectionId: integration.id,
    },
  });
  const signer = await addDocumentSigner(null, {
    requestId: signature.id,
    contactId: contact.id,
    name: `Runtime Client ${runKey}`,
    email: contact.primaryEmail,
    signingOrder: 1,
    providerSignerId: `signer-${runKey}`,
  }, humanContext);
  await assert.rejects(
    transitionSignatureRequest(null, {
      requestId: signature.id,
      toStatus: "sent",
      providerEventId: `signature-sent-${runKey}`,
      actorReference: admin.id,
      evidenceDigest: sha256Digest(`signature-sent-${runKey}`),
    }, humanContext),
    /authenticated provider ingress/i,
  );
  await assert.rejects(
    transitionDocumentSigner(null, {
      signerId: signer.id,
      toStatus: "signed",
      providerEventId: `signer-signed-${runKey}`,
      evidenceDigest: sha256Digest(`signer-signed-${runKey}`),
    }, humanContext),
    /authenticated provider ingress/i,
  );
  await transitionSignatureRequest(null, {
    requestId: signature.id,
    toStatus: "cancelled",
    providerEventId: `signature-cancelled-${runKey}`,
    actorReference: admin.id,
    evidenceDigest: sha256Digest(`signature-cancelled-${runKey}`),
  }, humanContext);

  const signerRaceRequest = await prisma.signatureRequest.create({
    data: {
      firmId, matterId: matter.id, documentVersionId: signatureDocument.version.id,
      title: `Runtime signer race ${runKey}`, status: "draft", provider: "runtime_fixture",
      integrationConnectionId: integration.id,
    },
  });
  await addDocumentSigner(null, {
    requestId: signerRaceRequest.id, contactId: contact.id, name: `Runtime Client ${runKey}`,
    email: contact.primaryEmail, signingOrder: 1, providerSignerId: `race-primary-${runKey}`,
  }, humanContext);
  const signerRace = await Promise.allSettled([
    addDocumentSigner(null, {
      requestId: signerRaceRequest.id, name: "Synthetic second signer",
      email: `second-${runKey}@example.invalid`, signingOrder: 2,
      providerSignerId: `race-secondary-${runKey}`,
    }, humanContext),
    transitionSignatureRequest(null, {
      requestId: signerRaceRequest.id, toStatus: "cancelled",
      providerEventId: `signature-race-cancelled-${runKey}`,
      evidenceDigest: sha256Digest(`signature-race-cancelled-${runKey}`),
    }, humanContext),
  ]);
  assert.equal(signerRace[1].status, "fulfilled", "request cancellation must complete under its shared signer lock");
  const signerRaceState = await prisma.signatureRequest.findUnique({
    where: { id: signerRaceRequest.id }, include: { signers: true },
  });
  assert.equal(signerRaceState.status, "cancelled");
  assert.equal(signerRaceState.signers.length, signerRace[0].status === "fulfilled" ? 2 : 1);

  const portalInvite = await invitePortalAccount(null, {
    contactId: contact.id,
    email: contact.primaryEmail,
  }, humanContext);
  const portalAcceptance = await acceptPortalInvitation(null, { inviteToken: portalInvite.inviteToken }, humanContext);
  // Explicit synthetic-only policy admission; never infer approval for legacy grants.
  const latestPortalPolicy = await prisma.portalDiscoveryPolicy.findFirst({ where: { firmId }, orderBy: { revision: "desc" } });
  const portalPolicy = await recordPortalDiscoveryPolicy(null, {
    expectedRevision: latestPortalPolicy?.revision ?? 0,
    mode: "read_intersection", statuses: ["open"], reason: "Synthetic isolated runtime policy admission only.",
  }, humanContext);
  const portalAccess = await grantPortalMatterAccess(null, {
    idempotencyKey: `runtime-portal-grant-${runKey}`,
    policyRevision: portalPolicy.revision, expectedVersion: 0, contactId: contact.id,
    reason: "Synthetic exact portal target and capability intent.",
    portalAccountId: portalAcceptance.account.id,
    matterId: matter.id,
    canReadDocuments: true,
    canReadInvoices: true,
    canReadMessages: true,
  }, humanContext);
  const portalShare = await sharePortalResource(null, {
    portalMatterAccessId: portalAccess.id,
    resourceType: "invoice",
    resourceId: invoice.id,
  }, humanContext);
  const portalRead = await portalSharedResource(null, {
    sessionToken: portalAcceptance.sessionToken,
    shareId: portalShare.id,
  }, humanContext);
  assert.equal(portalRead.resourceType, "invoice");
  await prisma.firm.update({ where: { id: firmId }, data: { status: "suspended" } });
  await assert.rejects(
    portalSharedResource(null, {
      sessionToken: portalAcceptance.sessionToken,
      shareId: portalShare.id,
    }, humanContext),
    /session is invalid or expired/i,
  );
  await prisma.firm.update({ where: { id: firmId }, data: { status: "active" } });
  const additionalShares = await Promise.all([
    sharePortalResource(null, {
      portalMatterAccessId: portalAccess.id,
      resourceType: "document",
      resourceId: signatureDocument.document.id,
    }, humanContext),
    sharePortalResource(null, {
      portalMatterAccessId: portalAccess.id,
      resourceType: "document_version",
      resourceId: signatureDocument.version.id,
    }, humanContext),
    sharePortalResource(null, {
      portalMatterAccessId: portalAccess.id,
      resourceType: "communication_thread",
      resourceId: thread.id,
    }, humanContext),
  ]);
  const additionalReads = await Promise.all(additionalShares.map((share) =>
    portalSharedResource(null, {
      sessionToken: portalAcceptance.sessionToken,
      shareId: share.id,
    }, humanContext)));
  assert.deepEqual(additionalReads.map((item) => item.resourceType).sort(), [
    "communication_thread",
    "document",
    "document_version",
  ]);
  await revokePortalGrant(null, {
    id: portalShare.id,
    grantType: "share",
    reason: "Synthetic exact-share revocation proof.",
  }, humanContext);
  await assert.rejects(
    () => portalSharedResource(null, { sessionToken: portalAcceptance.sessionToken, shareId: portalShare.id }, humanContext),
    /not available/i,
  );

  const retentionPolicy = await prisma.retentionPolicy.create({
    data: {
      firmId,
      name: `Runtime document policy ${runKey}`,
      code: `RUNTIME-${runKey}`,
      status: "active",
      recordClass: "document",
      trigger: "record_created",
      retentionDays: 1,
      description: "Synthetic runtime retention policy; not compliance guidance.",
      jurisdictionReference: "runtime-proof-only",
    },
  });
  const retained = await createVersionedDocument({
    firmId,
    matterId: matter.id,
    userId: admin.id,
    title: `Retention target ${runKey}`,
    retentionPolicyId: retentionPolicy.id,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60_000),
  });
  await transitionDocument(null, {
    documentId: retained.document.id,
    toStatus: "active",
    reason: "Synthetic retention publication proof.",
  }, humanContext);
  await transitionDocument(null, {
    documentId: retained.document.id,
    toStatus: "archived",
    reason: "Synthetic retention archive proof.",
  }, humanContext);
  const wrongHoldMatter = await prisma.matter.create({
    data: {
      firmId, matterNumber: `HOLD-SCOPE-${runKey}`, title: `Wrong hold scope ${runKey}`,
      status: "open", confidentiality: "standard", clientId: contact.id,
      responsibleAttorneyId: admin.id,
    },
  });
  await assert.rejects(
    () => placeRetentionHold(null, {
      policyId: retentionPolicy.id, matterId: wrongHoldMatter.id, documentId: retained.document.id,
      name: `Invalid hold scope ${runKey}`, reason: "Synthetic mismatched hold target rejection proof.",
    }, humanContext),
    /matter must match the selected document/i,
  );
  await assert.rejects(
    () => placeRetentionHold(null, {
      policyId: retentionPolicy.id, documentId: retained.document.id, contactId: contact.id,
      name: `Invalid contact scope ${runKey}`, reason: "Synthetic mismatched contact hold target rejection proof.",
    }, humanContext),
    /contact must match the selected document/i,
  );
  const { hold } = await placeRetentionHold(null, {
    policyId: retentionPolicy.id,
    matterId: matter.id,
    documentId: retained.document.id,
    name: `Runtime hold ${runKey}`,
    reason: "Synthetic hold used to prove release controls.",
    authorityReference: "runtime-proof-only",
  }, humanContext);
  await releaseRetentionHold(null, {
    holdId: hold.id,
    reason: "Synthetic hold purpose completed after explicit runtime review.",
  }, humanContext);
  const disposal = await disposeRetainedDocument(null, {
    documentId: retained.document.id,
    reason: "Synthetic document exceeded its test retention period after hold release.",
    confirmation: `DISPOSE ${retained.document.id}`,
  }, humanContext);
  assert.equal(disposal.document.status, "disposed");

  const retentionRaceTarget = await createVersionedDocument({
    firmId, matterId: matter.id, userId: admin.id,
    title: `Retention race target ${runKey}`, retentionPolicyId: retentionPolicy.id,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60_000),
  });
  await transitionDocument(null, { documentId: retentionRaceTarget.document.id, toStatus: "active", reason: "Synthetic retention race publication." }, humanContext);
  await transitionDocument(null, { documentId: retentionRaceTarget.document.id, toStatus: "archived", reason: "Synthetic retention race archive." }, humanContext);
  const retentionRace = await Promise.allSettled([
    placeRetentionHold(null, {
      policyId: retentionPolicy.id, matterId: matter.id, documentId: retentionRaceTarget.document.id,
      name: `Concurrent hold ${runKey}`, reason: "Synthetic concurrent hold versus disposal proof.",
    }, humanContext),
    disposeRetainedDocument(null, {
      documentId: retentionRaceTarget.document.id,
      reason: "Synthetic concurrent disposal versus hold proof.",
      confirmation: `DISPOSE ${retentionRaceTarget.document.id}`,
    }, humanContext),
  ]);
  assert.equal(retentionRace.filter((result) => result.status === "fulfilled").length, 1, "hold and disposal must serialize to one outcome");
  const retentionRaceDocument = await prisma.document.findUnique({ where: { id: retentionRaceTarget.document.id } });
  const retentionRaceHolds = await prisma.retentionHold.count({ where: { documentId: retentionRaceTarget.document.id, status: "active" } });
  assert.notEqual(retentionRaceDocument.status === "disposed" && retentionRaceHolds > 0, true, "disposed documents cannot acquire a concurrent active hold");

  const principal = await prisma.agentPrincipal.create({
    data: {
      firmId,
      ownerId: admin.id,
      name: `Runtime controlled agent ${runKey}`,
      agentType: "assistant",
      status: "active",
      provider: "runtime_fixture",
      model: "deterministic-proof",
    },
  });
  const capabilities = ["task.draft", "document.publish"];
  const grant = await prisma.agentGrant.create({
    data: {
      firmId,
      matterId: matter.id,
      agentPrincipalId: principal.id,
      status: "proposed",
      capabilities: [],
      reason: "Synthetic runtime grant awaiting controlled authority approval.",
      requestedById: admin.id,
    },
  });
  await updateAgentGrantAuthority(null, {
    grantId: grant.id,
    toStatus: "active",
    capabilities,
    reason: "Synthetic runtime grant with exact matter and capability scope.",
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  }, humanContext);
  const agentCredential = await issueAgentCredential(null, {
    agentPrincipalId: principal.id,
    name: `Runtime agent credential ${runKey}`,
    capabilities,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  }, humanContext);
  const agentAuthentication = await authenticateBearerToken(`Bearer ${agentCredential.secret}`, prisma);
  assert.equal(agentAuthentication.session?.authenticationType, "agent");
  const agentContext = controlledContext(agentAuthentication.session);
  const taskAction = await requestAgentAction(null, {
    data: {
      idempotencyKey: `runtime-agent-task-${runKey}`,
      agentPrincipalId: principal.id,
      grantId: grant.id,
      matterId: matter.id,
      actionType: "task.draft",
      requestEnvelope: {
        title: `Review synthetic runtime evidence ${runKey}`,
        description: "Draft-only task created by the controlled runtime agent.",
      },
    },
  }, agentContext);
  assert.equal((await executeAgentAction(null, { actionId: taskAction.action.id }, agentContext)).action.status, "succeeded");
  const publishAction = await requestAgentAction(null, {
    data: {
      idempotencyKey: `runtime-agent-publish-${runKey}`,
      agentPrincipalId: principal.id,
      grantId: grant.id,
      matterId: matter.id,
      actionType: "document.publish",
      documentId: publishTarget.document.id,
      requestEnvelope: {
        documentId: publishTarget.document.id,
        reason: "Explicit digest-bound synthetic publication approval.",
      },
    },
  }, agentContext);
  assert.equal(publishAction.action.status, "awaiting_approval");
  await reviewAgentAction(null, {
    actionId: publishAction.action.id,
    decision: "approve",
    reason: "Human reviewer verified the exact synthetic publication envelope.",
    approvalExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  }, humanContext);
  const executedPublish = await executeAgentAction(null, { actionId: publishAction.action.id }, agentContext);
  assert.equal(executedPublish.action.status, "succeeded");
  assert.equal((await prisma.document.findUnique({ where: { id: publishTarget.document.id } })).status, "active");
  const grantRaceAction = await requestAgentAction(null, {
    data: {
      idempotencyKey: `runtime-agent-grant-race-${runKey}`,
      agentPrincipalId: principal.id, grantId: grant.id, matterId: matter.id,
      actionType: "task.draft",
      requestEnvelope: { title: `Concurrent grant lock ${runKey}`, description: "Synthetic grant execution race." },
    },
  }, agentContext);
  const grantRace = await Promise.allSettled([
    executeAgentAction(null, { actionId: grantRaceAction.action.id }, agentContext),
    updateAgentGrantAuthority(null, {
      grantId: grant.id, toStatus: "suspended", reason: "Synthetic concurrent authority suspension proof.",
    }, humanContext),
  ]);
  if (grantRace[1].status === "rejected") {
    assert.match(String(grantRace[1].reason), /while an action is executing/i);
    await updateAgentGrantAuthority(null, {
      grantId: grant.id, toStatus: "suspended", reason: "Synthetic post-execution authority suspension proof.",
    }, humanContext);
  }
  const grantRaceState = await prisma.agentAction.findUnique({ where: { id: grantRaceAction.action.id } });
  assert.equal(grantRace[0].status === "fulfilled" ? grantRaceState.status === "succeeded" : grantRaceState.status !== "succeeded", true);
  assert.equal((await prisma.agentGrant.findUnique({ where: { id: grant.id } })).status, "suspended");
  await revokeAgentCredential(null, {
    id: agentCredential.credential.id,
    reason: "Synthetic controlled-agent proof completed.",
  }, humanContext);
  assert.equal((await authenticateBearerToken(`Bearer ${agentCredential.secret}`, prisma)).session, null);

  await transitionIntegrationConnection(null, {
    connectionId: integration.id,
    toStatus: "needs_reauth",
    reason: "Synthetic credential rotation state proof.",
  }, humanContext);
  await rotateIntegrationCredential(null, {
    connectionId: integration.id,
    credentialType: "oauth_access",
    secret: `rotated-synthetic-token-${runKey}`,
  }, humanContext);
  await transitionIntegrationConnection(null, {
    connectionId: integration.id,
    toStatus: "active",
    reason: "Synthetic provider reauthentication completed.",
  }, humanContext);
  await transitionIntegrationConnection(null, {
    connectionId: integration.id,
    toStatus: "revoked",
    reason: "Synthetic provider proof completed and credential material removed.",
  }, humanContext);
  const revokedIntegration = await prisma.integrationConnection.findUnique({ where: { id: integration.id } });
  assert.equal(revokedIntegration.credentialsEncrypted, "");
  assert.equal(revokedIntegration.oauthAccessToken, "");

  const graphqlCountQueries = await verifyAllGraphqlCountQueries(humanContext);
  const counts = await Promise.all([
    prisma.auditEvent.count({ where: { firmId, matterId: matter.id } }),
    prisma.matterStatusEvent.count({ where: { firmId, matterId: matter.id } }),
    prisma.agentActionEvent.count({ where: { firmId, matterId: matter.id } }),
    prisma.retentionAction.count({ where: { firmId, matterId: matter.id } }),
    prisma.signatureEvent.count({ where: { firmId, matterId: matter.id } }),
  ]);
  assert(counts.every((count) => count > 0));
  console.log(JSON.stringify({
    runKey,
    firmId,
    matterId: matter.id,
    restrictedMatter: true,
    materializedTeamAndEthicalWallAccess: true,
    graphqlCountQueries,
    conflictStatus: (await prisma.conflictCheck.findUnique({ where: { id: check.id } })).status,
    invoiceStatus: (await prisma.invoice.findUnique({ where: { id: invoice.id } })).status,
    paymentStatus: (await prisma.payment.findUnique({ where: { id: payment.id } })).status,
    refundStatus: (await prisma.refund.findUnique({ where: { id: refund.refund.id } })).status,
    communicationStatus: (await prisma.communicationMessage.findUnique({ where: { id: message.id } })).status,
    providerOutcomesFailClosed: true,
    signatureStatus: (await prisma.signatureRequest.findUnique({ where: { id: signature.id } })).status,
    retentionStatus: disposal.document.status,
    portalReadThenRevoked: true,
    apiKeyAuthenticatedThenRevoked: true,
    oauthClientIssuedThenRevoked: true,
    agentLowRiskAndApprovedHighRiskExecuted: true,
    providerCredentialEncryptedThenErased: true,
    webhookOutcomesFailClosed: true,
    evidenceCounts: {
      auditEvents: counts[0],
      matterEvents: counts[1],
      agentEvents: counts[2],
      retentionActions: counts[3],
      signatureEvents: counts[4],
    },
  }));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
