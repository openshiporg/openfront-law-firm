import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { requireOwnedOfflineDatabase } from "../features/keystone/lib/local-fixture";

import type { Context } from ".keystone/types";
import type { Session } from "../features/keystone/access";
import {
  requestAgentAction,
  reviewAgentAction,
} from "../features/keystone/mutations/agentActions";
import { postTrustTransaction } from "../features/keystone/mutations/postTrustTransaction";
import {
  prepareTrustReconciliation,
  setTrustAccountBankIdentity,
  transitionTrustAccount,
  transitionTrustReconciliation,
} from "../features/keystone/mutations/trustWorkflows";

function assertDisposableDatabase() {
  if (process.env.RUN_OWNED_DATABASE_TESTS === "1") return;
  if (process.env.ALLOW_EPHEMERAL_SCHEMA_VERIFY !== "1") {
    throw new Error("Set ALLOW_EPHEMERAL_SCHEMA_VERIFY=1 for the guarded runtime proof.");
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required.");
  const url = new URL(rawUrl);
  const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!localHost || !url.pathname.includes("law_firm_schema_verify")) {
    throw new Error("Runtime schema proof requires a loopback disposable law_firm_schema_verify database.");
  }
}

assertDisposableDatabase();

const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);

async function main() {
  if (process.env.RUN_OWNED_DATABASE_TESTS === "1") await requireOwnedOfflineDatabase(prisma);
  const firm = await prisma.firm.create({
    data: {
      name: `Schema proof ${suffix}`,
      slug: `schema-proof-${suffix}`,
      status: "active",
    },
  });
  const role = await prisma.role.create({
    data: {
      firmId: firm.id,
      name: "Schema proof administrator",
      status: "active",
      canAccessDashboard: true,
      canReadPeople: true,
      canReadMatters: true,
      canManageTasks: true,
      canReadTrust: true,
      canManageTrust: true,
      canReadAgents: true,
      canManageAgents: true,
      canApproveAgentActions: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      name: "Schema Proof User",
      email: `schema-proof-${suffix}@example.invalid`,
      password: "runtime-proof-not-an-authentication-secret",
      status: "active",
      activeFirmId: firm.id,
      bootstrapRoleId: role.id,
    },
  });
  const membership = await prisma.firmMembership.create({
    data: {
      firmId: firm.id,
      userId: user.id,
      roleId: role.id,
      status: "active",
    },
  });
  const contact = await prisma.contact.create({
    data: {
      firmId: firm.id,
      contactType: "person",
      status: "client",
      firstName: "Schema",
      lastName: "Client",
    },
  });
  const trustAccount = await prisma.trustAccount.create({
    data: {
      firmId: firm.id,
      name: "Disposable proof trust account",
      accountType: "trust",
      status: "active",
      currencyCode: "USD",
    },
  });
  const ledger = await prisma.trustLedgerAccount.create({
    data: {
      firmId: firm.id,
      trustAccountId: trustAccount.id,
      clientId: contact.id,
      ledgerNumber: `LEDGER-${suffix}`,
      status: "active",
      currencyCode: "USD",
    },
  });

  const sessionRole = {
    id: role.id,
    name: role.name,
    status: role.status,
    firm: { id: firm.id },
    canAccessDashboard: true,
    canReadPeople: true,
    canReadMatters: true,
    canManageTasks: true,
    canReadTrust: true,
    canManageTrust: true,
    canReadAgents: true,
    canManageAgents: true,
    canApproveAgentActions: true,
  };
  const session: Session = {
    itemId: user.id,
    listKey: "User",
    data: {
      name: user.name,
      status: user.status,
      activeFirm: { id: firm.id, name: firm.name, status: firm.status },
      role: sessionRole,
      firmMemberships: [{
        id: membership.id,
        status: membership.status,
        firm: { id: firm.id },
        role: sessionRole,
      }],
    },
  };
  const context = { prisma, session } as unknown as Context;

  const identityAccount = await prisma.trustAccount.create({
    data: {
      firmId: firm.id,
      name: "Bank identity proof account",
      accountType: "trust",
      status: "pending",
      currencyCode: "USD",
    },
  });
  await setTrustAccountBankIdentity(null, {
    trustAccountId: identityAccount.id,
    financialInstitutionName: "Synthetic Proof Bank",
    bankAccountLastFour: "4242",
    accountType: "trust",
    externalAccountReference: `proof-${suffix}`,
    reason: "Bind immutable bank identity before activation.",
  }, context);
  await transitionTrustAccount(null, {
    trustAccountId: identityAccount.id,
    toStatus: "active",
    reason: "Activate identity-bound synthetic trust account.",
  }, context);
  await assert.rejects(
    setTrustAccountBankIdentity(null, {
      trustAccountId: identityAccount.id,
      financialInstitutionName: "Different Bank",
      bankAccountLastFour: "9999",
      accountType: "pooled_trust",
      reason: "Attempt to rebind activated trust evidence.",
    }, context),
    /only while the trust account is pending/i,
  );

  const posting = {
    idempotencyKey: `deposit-${suffix}`,
    trustAccountId: trustAccount.id,
    transactionType: "deposit",
    currencyCode: "USD",
    occurredAt: new Date().toISOString(),
    description: "Disposable runtime deposit proof",
    entries: [
      {
        ledgerAccountId: null,
        accountingBucket: "bank_control" as const,
        direction: "debit" as const,
        amountMinor: 25_000,
      },
      {
        ledgerAccountId: ledger.id,
        accountingBucket: "client_liability" as const,
        direction: "credit" as const,
        amountMinor: 25_000,
      },
    ],
  };

  const concurrent = await Promise.all([
    postTrustTransaction(null, { data: posting }, context),
    postTrustTransaction(null, { data: posting }, context),
  ]);
  assert.deepEqual(concurrent.map((result) => result.replayed).sort(), [false, true]);
  const original = concurrent[0].transaction.id;
  assert.equal(await prisma.trustTransaction.count({ where: { firmId: firm.id } }), 1);
  assert.equal(await prisma.trustLedgerEntry.count({ where: { firmId: firm.id } }), 2);

  await assert.rejects(
    postTrustTransaction(null, { data: { ...posting, description: "Changed retry payload" } }, context),
    /different trust posting/i,
  );
  await assert.rejects(
    postTrustTransaction(null, {
      data: {
        ...posting,
        idempotencyKey: `overdraw-${suffix}`,
        transactionType: "disbursement",
        description: "Overdraw attempt",
        entries: [
          { accountingBucket: "bank_control", direction: "credit", amountMinor: 25_001 },
          { ledgerAccountId: ledger.id, accountingBucket: "client_liability", direction: "debit", amountMinor: 25_001 },
        ],
      },
    }, context),
    /historically over-disbursed/i,
  );

  const reversal = await postTrustTransaction(null, {
    data: {
      ...posting,
      idempotencyKey: `reversal-${suffix}`,
      transactionType: "reversal",
      description: "Exact reversal proof",
      reversesTransactionId: original,
      entries: [
        { accountingBucket: "bank_control", direction: "credit", amountMinor: 25_000 },
        { ledgerAccountId: ledger.id, accountingBucket: "client_liability", direction: "debit", amountMinor: 25_000 },
      ],
    },
  }, context);
  assert.equal(reversal.replayed, false);
  assert.equal(await prisma.trustTransaction.count({ where: { firmId: firm.id } }), 2);
  assert.equal(await prisma.trustLedgerEntry.count({ where: { firmId: firm.id } }), 4);

  const reviewer = await prisma.user.create({
    data: {
      name: "Independent Schema Reviewer",
      email: `schema-reviewer-${suffix}@example.invalid`,
      password: "runtime-proof-not-an-authentication-secret",
      status: "active",
      activeFirmId: firm.id,
      bootstrapRoleId: role.id,
    },
  });
  const reviewerMembership = await prisma.firmMembership.create({
    data: { firmId: firm.id, userId: reviewer.id, roleId: role.id, status: "active" },
  });
  const reviewerSession: Session = {
    ...session,
    itemId: reviewer.id,
    data: {
      ...session.data,
      name: reviewer.name,
      firmMemberships: [{
        id: reviewerMembership.id,
        status: reviewerMembership.status,
        firm: { id: firm.id },
        role: sessionRole,
      }],
    },
  };
  const reviewerContext = { prisma, session: reviewerSession } as unknown as Context;
  const prepared = await prepareTrustReconciliation(null, {
    trustAccountId: trustAccount.id,
    periodStart: new Date(Date.now() - 86_400_000).toISOString(),
    periodEnd: new Date().toISOString(),
    statementBalanceMinor: 0,
    bookBalanceMinor: 0,
    currencyCode: "USD",
    notes: "Disposable independent-review proof.",
  }, context);
  assert.equal((await prisma.trustReconciliation.findUnique({ where: { id: prepared.id } }))?.createdById, user.id);
  await transitionTrustReconciliation(null, {
    reconciliationId: prepared.id,
    toStatus: "in_review",
    reason: "Submit prepared reconciliation for independent review.",
  }, context);
  await assert.rejects(
    transitionTrustReconciliation(null, {
      reconciliationId: prepared.id,
      toStatus: "completed",
      reason: "Preparer must not certify the reconciliation.",
    }, context),
    /independent reviewer/i,
  );
  await transitionTrustReconciliation(null, {
    reconciliationId: prepared.id,
    toStatus: "completed",
    reason: "Independent reviewer certifies the zero-difference reconciliation.",
  }, reviewerContext);
  const completedReconciliation = await prisma.trustReconciliation.findUnique({ where: { id: prepared.id } });
  assert.equal(completedReconciliation?.reviewedById, reviewer.id);
  assert.equal(completedReconciliation?.status, "completed");
  const closedPeriodDate = new Date(completedReconciliation!.periodStart.getTime() + 60_000).toISOString();
  await assert.rejects(
    postTrustTransaction(null, {
      data: {
        ...posting,
        idempotencyKey: `closed-period-${suffix}`,
        occurredAt: closedPeriodDate,
        description: "Closed-period backdate proof",
      },
    }, context),
    /completed reconciliation period/i,
  );

  const principal = await prisma.agentPrincipal.create({ 
    data: {
      firmId: firm.id,
      ownerId: user.id,
      name: "Disposable proof agent",
      agentType: "workflow",
      status: "active",
    },
  });
  const lowRiskGrant = await prisma.agentGrant.create({
    data: {
      firmId: firm.id,
      agentPrincipalId: principal.id,
      status: "active",
      capabilities: ["task.draft"],
      reason: "Disposable low-risk runtime proof",
      requestedById: user.id,
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });
  const lowRiskRequest = {
    idempotencyKey: `agent-low-risk-${suffix}`,
    agentPrincipalId: principal.id,
    grantId: lowRiskGrant.id,
    actionType: "task.draft",
    requestEnvelope: { title: "Draft a bounded internal task" },
  };
  const lowRisk = await requestAgentAction(null, { data: lowRiskRequest }, context);
  assert.equal(lowRisk.action.status, "approved");
  assert.equal(lowRisk.action.requiresApproval, false);
  const lowRiskReplay = await requestAgentAction(null, { data: lowRiskRequest }, context);
  assert.equal(lowRiskReplay.replayed, true);
  await assert.rejects(
    requestAgentAction(null, {
      data: { ...lowRiskRequest, requestEnvelope: { title: "Changed request" } },
    }, context),
    /different agent request/i,
  );

  const highRiskGrant = await prisma.agentGrant.create({
    data: {
      firmId: firm.id,
      agentPrincipalId: principal.id,
      status: "active",
      capabilities: ["trust.post"],
      reason: "Disposable high-risk runtime proof",
      requestedById: user.id,
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });
  const highRisk = await requestAgentAction(null, {
    data: {
      idempotencyKey: `agent-high-risk-${suffix}`,
      agentPrincipalId: principal.id,
      grantId: highRiskGrant.id,
      actionType: "trust.post",
      requestEnvelope: { amountMinor: 100, trustAccountId: trustAccount.id },
    },
  }, context);
  assert.equal(highRisk.action.status, "awaiting_approval");
  await prisma.agentGrant.update({
    where: { id: highRiskGrant.id },
    data: { status: "revoked" },
  });
  await assert.rejects(
    reviewAgentAction(null, {
      actionId: highRisk.action.id,
      decision: "approve",
      reason: "This review must fail after grant revocation.",
    }, context),
    /grant is not active/i,
  );
  await prisma.agentGrant.update({
    where: { id: highRiskGrant.id },
    data: { status: "active" },
  });
  const reviewed = await reviewAgentAction(null, {
    actionId: highRisk.action.id,
    decision: "approve",
    reason: "Reviewed for disposable runtime schema proof.",
  }, context);
  assert.equal(reviewed.action.status, "approved");
  assert.match(reviewed.action.approvalDigest, /^[a-f0-9]{64}$/);

  const actionEvents = await prisma.agentActionEvent.count({ where: { firmId: firm.id } });
  assert.equal(actionEvents, 3);

  console.log(JSON.stringify({
    trustTransactions: 2,
    trustLedgerEntries: 4,
    concurrentIdempotencyReplay: true,
    changedPayloadRejected: true,
    overdrawRejected: true,
    exactReversalPosted: true,
    trustBankIdentityBoundBeforeActivation: true,
    activatedTrustBankIdentityRebindRejected: true,
    reconciliationPreparerBound: true,
    independentReconciliationReview: true,
    completedPeriodBackdateRejected: true,
    agentActions: 2,
    agentActionEvents: actionEvents,
    highRiskApprovalBound: true,
    revokedGrantReviewRejected: true,
  }));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
