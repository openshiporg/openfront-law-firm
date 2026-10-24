import { graphql, list } from "@keystone-6/core";
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import {
  firmRelationship,
  readOnlyRelationship,
  requireRelationshipPrismaField,
  requiredRelationship,
  scopedAccess,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const canReadTrust = ({ session }: any) =>
  permissions.canReadTrust({ session }) || permissions.canManageTrust({ session });
const canManageTrust = ({ session }: any) => permissions.canManageTrust({ session });

const trustAccountAccess = scopedAccess("canReadTrust", "canManageTrust");
const trustMatterAccess = {
  operation: {
    query: canReadTrust,
    create: canManageTrust,
    update: canManageTrust,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadTrustRecord,
    update: rules.canManageTrustRecord,
    delete: rules.canManageTrustRecord,
  },
};

const trustFieldAccess = {
  read: canReadTrust,
  create: canManageTrust,
  update: canManageTrust,
};

const immutableTrustIdentityAccess = {
  read: canReadTrust,
  create: canManageTrust,
  update: denyAll,
};

const currencyValidation = {
  match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." },
} as const;

export const TrustAccount = list({
  access: trustAccountAccess,
  hooks: firmOwnedHooks({ lifecycle: "trustAccount", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "accountType", "status", "office", "currencyCode", "bankAccountLastFour"] } },
  fields: {
    firm: firmRelationship(),
    office: relationship({ ref: "Office", access: immutableTrustIdentityAccess, graphql: { omit: { update: true } } }),
    name: text({ validation: { isRequired: true } }),
    accountType: select({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Trust", value: "trust" },
        { label: "IOLTA / pooled", value: "pooled_trust" },
        { label: "Dedicated client", value: "dedicated_client" },
        { label: "Other safeguarded funds", value: "other" },
      ],
      defaultValue: "trust",
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Frozen", value: "frozen" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    currencyCode: text({ access: immutableTrustIdentityAccess, defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    financialInstitutionName: text({ access: immutableTrustIdentityAccess, graphql: { omit: { update: true } } }),
    bankAccountLastFour: text({
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      validation: {
        length: { min: 4, max: 4 },
        match: { regex: /^\d{4}$/, explanation: "Use only the final four digits." },
      },
    }),
    externalAccountReference: text({ access: immutableTrustIdentityAccess, graphql: { omit: { update: true } } }),
    openedAt: timestamp({ access: immutableTrustIdentityAccess }),
    closedAt: timestamp({ access: immutableTrustIdentityAccess }),
    ledgerAccounts: readOnlyRelationship("TrustLedgerAccount.trustAccount", true),
    transactions: readOnlyRelationship("TrustTransaction.trustAccount", true),
    entries: readOnlyRelationship("TrustLedgerEntry.trustAccount", true),
    snapshots: readOnlyRelationship("TrustBalanceSnapshot.trustAccount", true),
    reconciliations: readOnlyRelationship("TrustReconciliation.trustAccount", true),
    ...trackingFields,
  },
});

export const TrustLedgerAccount = list({
  db: uniqueConstraints(["firmId", "ledgerNumber"]),
  access: trustMatterAccess,
  hooks: firmOwnedHooks({ lifecycle: "trustLedgerAccount", controlledStatus: true }),
  ui: { listView: { initialColumns: ["ledgerNumber", "client", "matter", "trustAccount", "status", "currencyCode"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter", access: immutableTrustIdentityAccess }),
    trustAccount: relationship({
      ref: "TrustAccount.ledgerAccounts",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableTrustIdentityAccess,
    }),
    client: relationship({
      ref: "Contact",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableTrustIdentityAccess,
    }),
    ledgerNumber: text({ access: immutableTrustIdentityAccess, isIndexed: true, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Active", value: "active" },
        { label: "Frozen", value: "frozen" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    currencyCode: text({ access: immutableTrustIdentityAccess, defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    openedAt: timestamp({ access: immutableTrustIdentityAccess, defaultValue: { kind: "now" } }),
    closedAt: timestamp({ access: immutableTrustIdentityAccess }),
    freezeReason: text({ access: immutableTrustIdentityAccess, ui: { displayMode: "textarea" } }),
    entries: readOnlyRelationship("TrustLedgerEntry.ledgerAccount", true),
    snapshots: readOnlyRelationship("TrustBalanceSnapshot.ledgerAccount", true),
    // Live client balance from posted entries on this ledger: liability credits less debits.
    balanceMinor: virtual({
      field: graphql.field({
        type: graphql.Int,
        async resolve(item: any, _args, context) {
          const sums = await context.prisma.trustLedgerEntry.groupBy({
            by: ["direction"],
            where: { ledgerAccountId: item.id, accountingBucket: "client_liability" },
            _sum: { amountMinor: true },
          });
          const total = (direction: string) => Number(sums.find((row: any) => row.direction === direction)?._sum.amountMinor ?? 0);
          return total("credit") - total("debit");
        },
      }),
    }),
    ...trackingFields,
  },
});

export const TrustTransaction = list({
  db: uniqueConstraints(
    ["firmId", "transactionNumber"],
    ["reversesTransactionId"],
    ["sourcePaymentId"],
    ["sourceRefundId"],
  ),
  access: {
    operation: {
      query: canReadTrust,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadTrustTransaction,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["transactionNumber", "transactionType", "trustAccount", "status", "occurredAt", "idempotencyKey"] },
  },
  fields: {
    firm: firmRelationship(),
    transactionNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    postingDigest: text({ validation: { isRequired: true }, isIndexed: true }),
    trustAccount: requiredRelationship("TrustAccount.transactions"),
    transactionType: select({
      type: "enum",
      options: [
        { label: "Deposit", value: "deposit" },
        { label: "Disbursement", value: "disbursement" },
        { label: "Transfer", value: "transfer" },
        { label: "Reversal", value: "reversal" },
        { label: "Bank fee", value: "bank_fee" },
        { label: "Adjustment", value: "adjustment" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Posted", value: "posted" },
        { label: "Reversed by reference", value: "reversed" },
      ],
      defaultValue: "posted",
      validation: { isRequired: true },
    }),
    currencyCode: text({ validation: { isRequired: true, ...currencyValidation } }),
    description: text({ access: { ...trustFieldAccess, update: denyAll }, validation: { isRequired: true } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    postedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    postedBy: relationship({ ref: "User" }),
    postedByAgent: relationship({ ref: "AgentPrincipal" }),
    sourcePayment: relationship({ ref: "Payment.trustTransactions" }),
    sourceRefund: relationship({ ref: "Refund.trustTransactions" }),
    reversesTransaction: relationship({ ref: "TrustTransaction.reversalTransactions" }),
    reversalTransactions: readOnlyRelationship("TrustTransaction.reversesTransaction", true),
    entries: readOnlyRelationship("TrustLedgerEntry.transaction", true),
    ...trackingFields,
  },
});

export const TrustLedgerEntry = list({
  access: {
    operation: {
      query: canReadTrust,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadTrustEntry,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["transaction", "accountingBucket", "direction", "amountMinor", "ledgerAccount", "occurredAt"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    transaction: requiredRelationship("TrustTransaction.entries"),
    trustAccount: requiredRelationship("TrustAccount.entries"),
    ledgerAccount: relationship({ ref: "TrustLedgerAccount.entries" }),
    accountingBucket: select({
      type: "enum",
      options: [
        { label: "Bank control", value: "bank_control" },
        { label: "Client liability", value: "client_liability" },
        { label: "Bank fee", value: "bank_fee" },
        { label: "Suspense", value: "suspense" },
      ],
      validation: { isRequired: true },
    }),
    direction: select({
      type: "enum",
      options: [
        { label: "Debit", value: "debit" },
        { label: "Credit", value: "credit" },
      ],
      validation: { isRequired: true },
    }),
    amountMinor: integer({ validation: { isRequired: true, min: 1 } }),
    currencyCode: text({ validation: { isRequired: true, ...currencyValidation } }),
    memo: text({ access: { ...trustFieldAccess, update: denyAll } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});

export const TrustBalanceSnapshot = list({
  access: {
    operation: {
      query: canReadTrust,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadTrustRecord,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["trustAccount", "ledgerAccount", "snapshotType", "balanceMinor", "asOf"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    trustAccount: requiredRelationship("TrustAccount.snapshots"),
    ledgerAccount: relationship({ ref: "TrustLedgerAccount.snapshots" }),
    reconciliation: relationship({ ref: "TrustReconciliation.snapshots" }),
    snapshotType: select({
      type: "enum",
      options: [
        { label: "Client balance", value: "client_balance" },
        { label: "Book balance", value: "book_balance" },
        { label: "Statement balance", value: "statement_balance" },
        { label: "Reconciliation", value: "reconciliation" },
      ],
      validation: { isRequired: true },
    }),
    balanceMinor: integer({ validation: { isRequired: true } }),
    currencyCode: text({ validation: { isRequired: true, ...currencyValidation } }),
    asOf: timestamp({ validation: { isRequired: true } }),
    createdBy: relationship({ ref: "User" }),
    ...trackingFields,
  },
});

export const TrustReconciliation = list({
  db: uniqueConstraints(["trustAccountId", "periodStart", "periodEnd"]),
  access: trustAccountAccess,
  graphql: { omit: { create: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "trustReconciliation", controlledStatus: true }),
  ui: { listView: { initialColumns: ["trustAccount", "status", "periodStart", "periodEnd", "differenceMinor", "reviewedBy"] } },
  fields: {
    firm: firmRelationship(),
    trustAccount: relationship({
      ref: "TrustAccount.reconciliations",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableTrustIdentityAccess,
    }),
    status: select({
      type: "enum",
      access: immutableTrustIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "In review", value: "in_review" },
        { label: "Completed", value: "completed" },
        { label: "Reopened", value: "reopened" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    periodStart: timestamp({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    periodEnd: timestamp({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    statementBalanceMinor: integer({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    bookBalanceMinor: integer({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    differenceMinor: integer({ access: immutableTrustIdentityAccess, validation: { isRequired: true } }),
    currencyCode: text({ access: immutableTrustIdentityAccess, validation: { isRequired: true, ...currencyValidation } }),
    createdBy: relationship({ ref: "User", access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    reviewedBy: relationship({ ref: "User", access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    reviewedAt: timestamp({ access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    completedAt: timestamp({ access: { read: canReadTrust, create: denyAll, update: denyAll } }),
    notes: text({ access: trustFieldAccess, ui: { displayMode: "textarea" } }),
    snapshots: readOnlyRelationship("TrustBalanceSnapshot.reconciliation", true),
    ...trackingFields,
  },
});
