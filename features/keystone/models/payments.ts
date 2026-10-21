import { list } from "@keystone-6/core";
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import {
  firmRelationship,
  readOnlyRelationship,
  requiredRelationship,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const canReadPayments = ({ session }: any) =>
  permissions.canReadPayments({ session }) ||
  permissions.canManagePayments({ session }) ||
  permissions.canReadBilling({ session }) ||
  permissions.canReadTrust({ session });
const canManagePayments = ({ session }: any) => permissions.canManagePayments({ session });

const paymentAccess = {
  operation: {
    query: canReadPayments,
    create: canManagePayments,
    update: denyAll,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadPaymentRecord,
    update: () => false,
    delete: rules.canManagePaymentRecord,
  },
};

const paymentFieldAccess = {
  read: canReadPayments,
  create: canManagePayments,
  update: canManagePayments,
};

const currencyValidation = {
  match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." },
} as const;

export const Payment = list({
  db: uniqueConstraints(
    ["firmId", "paymentNumber"],
    ["firmId", "idempotencyKey"],
  ),
  access: paymentAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "payment", controlledStatus: true }),
  ui: { listView: { initialColumns: ["paymentNumber", "paymentType", "status", "amountMinor", "invoice", "payer"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    invoice: relationship({ ref: "Invoice.payments" }),
    trustAccount: relationship({ ref: "TrustAccount" }),
    payer: requiredRelationship("Contact"),
    paymentNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: text({ isIndexed: true }),
    paymentType: select({
      type: "enum",
      options: [
        { label: "Operating payment", value: "operating" },
        { label: "Trust deposit", value: "trust_deposit" },
        { label: "Other receipt", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Settled", value: "settled" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    amountMinor: integer({ validation: { isRequired: true, min: 1 } }),
    refundedMinor: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    providerCode: text(),
    integrationConnection: relationship({ ref: "IntegrationConnection" }),
    providerPaymentId: text({ isIndexed: true }),
    authorizedAt: timestamp(),
    capturedAt: timestamp(),
    settledAt: timestamp(),
    failedAt: timestamp(),
    failureReason: text({ access: paymentFieldAccess }),
    receivedBy: relationship({ ref: "User" }),
    allocations: readOnlyRelationship("PaymentAllocation.payment", true),
    refunds: readOnlyRelationship("Refund.payment", true),
    trustTransactions: readOnlyRelationship("TrustTransaction.sourcePayment", true),
    ...trackingFields,
  },
});

export const PaymentAllocation = list({
  db: uniqueConstraints(
    ["firmId", "idempotencyKey"],
    ["reversesAllocationId"],
  ),
  access: {
    operation: {
      query: canReadPayments,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadPaymentRecord,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["payment", "allocationType", "invoice", "trustTransaction", "amountMinor", "allocatedAt"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    payment: requiredRelationship("Payment.allocations"),
    idempotencyKey: text({
      isIndexed: true,
      defaultValue: null,
      db: { isNullable: true },
    }),
    invoice: relationship({ ref: "Invoice.paymentAllocations" }),
    trustTransaction: relationship({ ref: "TrustTransaction" }),
    allocationType: select({
      type: "enum",
      options: [
        { label: "Invoice", value: "invoice" },
        { label: "Trust deposit", value: "trust_deposit" },
        { label: "Trust application", value: "trust_application" },
        { label: "Reversal", value: "reversal" },
      ],
      validation: { isRequired: true },
    }),
    amountMinor: integer({ validation: { isRequired: true, min: 1 } }),
    currencyCode: text({ validation: { isRequired: true, ...currencyValidation } }),
    allocatedBy: relationship({ ref: "User" }),
    allocatedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    reversesAllocation: relationship({ ref: "PaymentAllocation.reversalAllocations" }),
    reversalAllocations: readOnlyRelationship("PaymentAllocation.reversesAllocation", true),
    note: text({ access: { ...paymentFieldAccess, update: denyAll } }),
    ...trackingFields,
  },
});

export const Refund = list({
  db: uniqueConstraints(
    ["firmId", "refundNumber"],
    ["firmId", "idempotencyKey"],
  ),
  access: {
    operation: {
      query: canReadPayments,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadPaymentRecord,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["refundNumber", "payment", "status", "amountMinor", "requestedBy", "approvedBy"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    payment: requiredRelationship("Payment.refunds"),
    invoice: relationship({ ref: "Invoice.refunds" }),
    refundNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: text({ isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Approved", value: "approved" },
        { label: "Processing", value: "processing" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
    }),
    reason: select({
      type: "enum",
      options: [
        { label: "Overpayment", value: "overpayment" },
        { label: "Duplicate", value: "duplicate" },
        { label: "Matter closed", value: "matter_closed" },
        { label: "Client request", value: "client_request" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    amountMinor: integer({ validation: { isRequired: true, min: 1 } }),
    currencyCode: text({ validation: { isRequired: true, ...currencyValidation } }),
    explanation: text({ access: paymentFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    requestedBy: requiredRelationship("User"),
    approvedBy: relationship({ ref: "User" }),
    requestedAt: timestamp({ defaultValue: { kind: "now" } }),
    approvedAt: timestamp(),
    processedAt: timestamp(),
    providerRefundId: text({ isIndexed: true }),
    failureReason: text({ access: paymentFieldAccess }),
    trustTransactions: readOnlyRelationship("TrustTransaction.sourceRefund", true),
    ...trackingFields,
  },
});
