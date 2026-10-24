import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { activeFirmId, permissions, rules } from "../access";
import { prismaWithoutGraphQLErrorConversion } from "../lib/transactions";
import { changedFields, denyAll, firmOwnedHooks, relationshipConnectionIds } from "../tenancy";
import { validateMatterTeamCapability } from "../lib/team-capability";
import {
  firmRelationship,
  readOnlyRelationship,
  requiredRelationship,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const canReadBilling = ({ session }: any) =>
  permissions.canReadBilling({ session }) || permissions.canManageBilling({ session });
const canManageBilling = ({ session }: any) => permissions.canManageBilling({ session });

const billingAccess = {
  operation: {
    query: canReadBilling,
    create: canManageBilling,
    update: canManageBilling,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadBillingRecord,
    update: rules.canManageBillingRecord,
    delete: rules.canManageBillingRecord,
  },
};

const controlledBillingAccess = {
  ...billingAccess,
  operation: { ...billingAccess.operation, update: denyAll },
  filter: { ...billingAccess.filter, update: () => false },
};

const optionalBillingAccess = {
  ...billingAccess,
  filter: {
    query: rules.canReadOptionalBillingRecord,
    update: rules.canManageOptionalBillingRecord,
    delete: rules.canManageOptionalBillingRecord,
  },
};

const billingFieldAccess = {
  read: canReadBilling,
  create: canManageBilling,
  update: canManageBilling,
};

const controlledBillingLifecycleAccess = {
  read: canReadBilling,
  create: canManageBilling,
  update: denyAll,
};

const currencyValidation = {
  match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." },
} as const;

function invoiceValue(args: any, field: string) {
  return args.resolvedData[field] ?? args.item?.[field];
}

function validateInvoiceTotals(args: any) {
  const subtotal = invoiceValue(args, "subtotalMinor");
  const discount = invoiceValue(args, "discountMinor");
  const tax = invoiceValue(args, "taxMinor");
  const total = invoiceValue(args, "totalMinor");
  const paid = invoiceValue(args, "paidMinor");
  const balance = invoiceValue(args, "balanceDueMinor");
  const status = invoiceValue(args, "status");

  if (total !== subtotal - discount + tax) {
    args.addValidationError("Invoice total must equal subtotal minus discount plus tax.");
  }
  if (paid > total) args.addValidationError("Invoice paid amount cannot exceed its total.");
  if (status === "void") {
    if (balance !== 0) args.addValidationError("A void invoice must have zero balance due.");
  } else if (balance !== total - paid) {
    args.addValidationError("Invoice balance must equal total minus paid amount.");
  }
  if (status === "paid" && (paid !== total || balance !== 0)) {
    args.addValidationError("A paid invoice must be paid in full with zero balance.");
  }
  if (["issued", "partially_paid", "paid", "overdue"].includes(status) && !invoiceValue(args, "issuedAt")) {
    args.addValidationError("An issued invoice status requires an issue timestamp.");
  }
  if (status === "void" && !String(invoiceValue(args, "voidReason") ?? "").trim()) {
    args.addValidationError("A void invoice requires a reason.");
  }
}

const invoiceSnapshotFields = new Set([
  "matter", "client", "retainer", "invoiceNumber", "currencyCode",
  "subtotalMinor", "discountMinor", "taxMinor", "totalMinor", "issuedAt", "dueAt",
]);
const baseInvoiceHooks = firmOwnedHooks({ lifecycle: "invoice", controlledStatus: true });
const invoiceHooks = {
  ...baseInvoiceHooks,
  validate: {
    create: async (args: any) => {
      await baseInvoiceHooks.validate.create(args);
      validateInvoiceTotals(args);
      if (args.resolvedData.status !== "draft") {
        args.addValidationError("Invoices must be created in draft status.");
      }
    },
    update: async (args: any) => {
      await baseInvoiceHooks.validate.update(args);
      validateInvoiceTotals(args);
      if (
        ["issued", "partially_paid", "paid", "overdue", "void"].includes(args.item.status) &&
        changedFields(args.resolvedData).some((field) => invoiceSnapshotFields.has(field))
      ) {
        args.addValidationError("Issued invoice snapshot fields cannot be changed.");
      }
      if (args.resolvedData.status === "issued" && args.item.status !== "issued") {
        const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma) as any;
        const totals = await prisma.invoiceLine.aggregate({
          where: { invoiceId: args.item.id },
          _sum: {
            subtotalMinor: true,
            discountMinor: true,
            taxMinor: true,
            lineTotalMinor: true,
          },
        });
        if (
          (totals._sum.subtotalMinor ?? 0) !== invoiceValue(args, "subtotalMinor") ||
          (totals._sum.discountMinor ?? 0) !== invoiceValue(args, "discountMinor") ||
          (totals._sum.taxMinor ?? 0) !== invoiceValue(args, "taxMinor") ||
          (totals._sum.lineTotalMinor ?? 0) !== invoiceValue(args, "totalMinor")
        ) {
          args.addValidationError("Invoice totals must match immutable line snapshots before issue.");
        }
      }
    },
  },
};

const baseInvoiceLineHooks = firmOwnedHooks();
const invoiceLineHooks = {
  ...baseInvoiceLineHooks,
  validate: {
    create: async (args: any) => {
      await baseInvoiceLineHooks.validate.create(args);
      const invoiceId = relationshipConnectionIds(args.resolvedData.invoice)[0];
      if (!invoiceId) return;
      const firmId = activeFirmId(args.context.session);
      if (!firmId) return;
      const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma) as any;
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, firmId, status: "draft" },
        select: { id: true, matterId: true, currencyCode: true },
      });
      if (!invoice) {
        args.addValidationError("Invoice lines may be added only to an accessible draft invoice.");
        return;
      }
      if (invoice.currencyCode !== args.resolvedData.currencyCode) {
        args.addValidationError("Invoice line currency must match its invoice.");
      }
      if (args.resolvedData.lineTotalMinor !==
        args.resolvedData.subtotalMinor - (args.resolvedData.discountMinor ?? 0) + (args.resolvedData.taxMinor ?? 0)) {
        args.addValidationError("Invoice line total must equal subtotal minus discount plus tax.");
      }
      const timeEntryId = relationshipConnectionIds(args.resolvedData.timeEntry)[0];
      const expenseId = relationshipConnectionIds(args.resolvedData.expense)[0];
      const hasTime = Boolean(timeEntryId);
      const hasExpense = Boolean(expenseId);
      if (args.resolvedData.lineType === "time" && (!hasTime || hasExpense)) {
        args.addValidationError("A time invoice line requires exactly one time entry source.");
      }
      if (args.resolvedData.lineType === "expense" && (!hasExpense || hasTime)) {
        args.addValidationError("An expense invoice line requires exactly one expense source.");
      }
      if (!["time", "expense"].includes(args.resolvedData.lineType) && (hasTime || hasExpense)) {
        args.addValidationError("Only time or expense lines may link those source records.");
      }
      if (timeEntryId) {
        const source = await prisma.timeEntry.findFirst({
          where: { id: timeEntryId, firmId, matterId: invoice.matterId, status: "approved", invoiceLine: null },
          select: { id: true, currencyCode: true },
        });
        if (!source || source.currencyCode !== invoice.currencyCode) {
          args.addValidationError("Time source must be unbilled, approved, same-matter, and same-currency.");
        }
      }
      if (expenseId) {
        const source = await prisma.expense.findFirst({
          where: { id: expenseId, firmId, matterId: invoice.matterId, status: "approved", invoiceLineId: null },
          select: { id: true, currencyCode: true },
        });
        if (!source || source.currencyCode !== invoice.currencyCode) {
          args.addValidationError("Expense source must be unbilled, approved, same-matter, and same-currency.");
        }
      }
    },
  },
};

export const RateCard = list({
  access: optionalBillingAccess,
  hooks: firmOwnedHooks({ lifecycle: "rateCard" }),
  ui: { listView: { initialColumns: ["name", "status", "currencyCode", "effectiveFrom", "effectiveTo"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    name: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Retired", value: "retired" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    effectiveFrom: timestamp(),
    effectiveTo: timestamp(),
    description: text({ access: billingFieldAccess, ui: { displayMode: "textarea" } }),
    rules: readOnlyRelationship("RateRule.rateCard", true),
    ...trackingFields,
  },
});

export const RateRule = list({
  access: optionalBillingAccess,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["rateCard", "rateType", "amountMinor", "user", "practiceArea", "matter"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    rateCard: requiredRelationship("RateCard.rules"),
    user: relationship({ ref: "User" }),
    practiceArea: relationship({ ref: "PracticeArea" }),
    rateType: select({
      type: "enum",
      options: [
        { label: "Hourly", value: "hourly" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Per appearance", value: "per_appearance" },
        { label: "Per item", value: "per_item" },
      ],
      validation: { isRequired: true },
    }),
    amountMinor: integer({ validation: { isRequired: true, min: 0 } }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    unitLabel: text({ defaultValue: "hour" }),
    priority: integer({ defaultValue: 100, validation: { min: 0 } }),
    effectiveFrom: timestamp(),
    effectiveTo: timestamp(),
    ...trackingFields,
  },
});

function approvedSourceHooks(
  lifecycle: "timeEntry" | "expense",
  immutableStatuses: ReadonlySet<string>,
  immutableFields: ReadonlySet<string>,
) {
  const base = firmOwnedHooks({ lifecycle, controlledStatus: true });
  return {
    ...base,
    validate: {
      ...base.validate,
      create: async (args: any) => {
        await base.validate.create(args);
        await validateMatterTeamCapability(args, "canBill");
      },
      update: async (args: any) => {
        await base.validate.update(args);
        await validateMatterTeamCapability(args, "canBill");
        if (
          immutableStatuses.has(args.item?.status) &&
          changedFields(args.resolvedData).some((field) => immutableFields.has(field))
        ) {
          args.addValidationError("Approved or finalized billing sources are immutable; write off the source and create a corrected record with renewed approval.");
        }
      },
    },
  };
}

const timeEntryHooks = approvedSourceHooks(
  "timeEntry",
  new Set(["approved", "billed", "written_off"]),
  new Set(["matter", "user", "task", "workDate", "startedAt", "endedAt", "durationMinutes", "description", "isBillable", "rateMinor", "amountMinor", "currencyCode"]),
);
const expenseHooks = approvedSourceHooks(
  "expense",
  new Set(["approved", "billed", "reimbursed", "written_off"]),
  new Set(["matter", "incurredBy", "vendor", "receiptVersion", "expenseType", "description", "incurredAt", "amountMinor", "currencyCode", "isBillable"]),
);

export const TimeEntry = list({
  access: billingAccess,
  hooks: timeEntryHooks,
  ui: { listView: { initialColumns: ["matter", "user", "status", "workDate", "durationMinutes", "amountMinor"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    user: requiredRelationship("User"),
    task: relationship({ ref: "LegalTask" }),
    status: select({
      type: "enum",
      access: controlledBillingLifecycleAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Billed", value: "billed" },
        { label: "Written off", value: "written_off" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    workDate: timestamp({ validation: { isRequired: true } }),
    startedAt: timestamp(),
    endedAt: timestamp(),
    durationMinutes: integer({ validation: { isRequired: true, min: 1 } }),
    description: text({ access: billingFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    isBillable: checkbox({ access: { ...billingFieldAccess, update: denyAll }, graphql: { omit: { update: true } }, defaultValue: true }),
    rateMinor: integer({ validation: { min: 0 } }),
    amountMinor: integer({ validation: { min: 0 } }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    approvedBy: relationship({ ref: "User", access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    approvedAt: timestamp({ access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    invoiceLine: readOnlyRelationship("InvoiceLine.timeEntry"),
    ...trackingFields,
  },
});

export const Expense = list({
  access: billingAccess,
  hooks: expenseHooks,
  ui: { listView: { initialColumns: ["matter", "description", "status", "incurredAt", "amountMinor", "vendor"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    incurredBy: relationship({ ref: "User" }),
    vendor: relationship({ ref: "Contact" }),
    receiptVersion: relationship({ ref: "DocumentVersion" }),
    status: select({
      type: "enum",
      access: controlledBillingLifecycleAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Billed", value: "billed" },
        { label: "Reimbursed", value: "reimbursed" },
        { label: "Written off", value: "written_off" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    expenseType: select({
      type: "enum",
      options: [
        { label: "Filing fee", value: "filing_fee" },
        { label: "Travel", value: "travel" },
        { label: "Expert", value: "expert" },
        { label: "Copying", value: "copying" },
        { label: "Service", value: "service" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "other",
    }),
    description: text({ access: billingFieldAccess, validation: { isRequired: true } }),
    incurredAt: timestamp({ validation: { isRequired: true } }),
    amountMinor: integer({ validation: { isRequired: true, min: 0 } }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    isBillable: checkbox({ access: { ...billingFieldAccess, update: denyAll }, graphql: { omit: { update: true } }, defaultValue: true }),
    approvedBy: relationship({ ref: "User", access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    approvedAt: timestamp({ access: controlledBillingLifecycleAccess, graphql: { omit: { create: true, update: true } } }),
    invoiceLine: readOnlyRelationship("InvoiceLine.expense"),
    ...trackingFields,
  },
});

export const RetainerAgreement = list({
  db: uniqueConstraints(["firmId", "agreementNumber"]),
  access: billingAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "retainer", controlledStatus: true }),
  ui: { listView: { initialColumns: ["agreementNumber", "matter", "client", "status", "feeStructure"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    client: requiredRelationship("Contact"),
    rateCard: relationship({ ref: "RateCard" }),
    agreementNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Accepted", value: "accepted" },
        { label: "Active", value: "active" },
        { label: "Completed", value: "completed" },
        { label: "Terminated", value: "terminated" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    feeStructure: select({
      type: "enum",
      options: [
        { label: "Hourly", value: "hourly" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Contingency", value: "contingency" },
        { label: "Hybrid", value: "hybrid" },
        { label: "Pro bono", value: "pro_bono" },
      ],
      validation: { isRequired: true },
    }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    initialRetainerMinor: integer({ validation: { min: 0 } }),
    evergreenThresholdMinor: integer({ validation: { min: 0 } }),
    replenishmentAmountMinor: integer({ validation: { min: 0 } }),
    contingencyBasisPoints: integer({ validation: { min: 0, max: 10000 } }),
    termsSummary: text({ access: billingFieldAccess, ui: { displayMode: "textarea" } }),
    signedDocumentVersion: relationship({ ref: "DocumentVersion" }),
    trustLedgerAccount: relationship({ ref: "TrustLedgerAccount" }),
    sentAt: timestamp(),
    acceptedAt: timestamp(),
    effectiveAt: timestamp(),
    terminatedAt: timestamp(),
    invoices: readOnlyRelationship("Invoice.retainer", true),
    ...trackingFields,
  },
});

export const Invoice = list({
  db: uniqueConstraints(["firmId", "invoiceNumber"]),
  access: controlledBillingAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: invoiceHooks,
  ui: { listView: { initialColumns: ["invoiceNumber", "matter", "client", "status", "totalMinor", "dueAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    client: requiredRelationship("Contact"),
    retainer: relationship({ ref: "RetainerAgreement.invoices" }),
    invoiceNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Approved", value: "approved" },
        { label: "Issued", value: "issued" },
        { label: "Partially paid", value: "partially_paid" },
        { label: "Paid", value: "paid" },
        { label: "Overdue", value: "overdue" },
        { label: "Void", value: "void" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    subtotalMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    discountMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    taxMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    totalMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    paidMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    balanceDueMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    issuedAt: timestamp(),
    dueAt: timestamp(),
    paidAt: timestamp(),
    voidedAt: timestamp(),
    voidReason: text({ access: billingFieldAccess }),
    memo: text({ access: billingFieldAccess, ui: { displayMode: "textarea" } }),
    lines: readOnlyRelationship("InvoiceLine.invoice", true),
    payments: readOnlyRelationship("Payment.invoice", true),
    paymentAllocations: readOnlyRelationship("PaymentAllocation.invoice", true),
    refunds: readOnlyRelationship("Refund.invoice", true),
    ...trackingFields,
  },
});

export const InvoiceLine = list({
  access: {
    operation: {
      query: canReadBilling,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadBillingRecord,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: invoiceLineHooks,
  ui: {
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["invoice", "lineType", "description", "quantity", "lineTotalMinor"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    invoice: requiredRelationship("Invoice.lines"),
    timeEntry: relationship({ ref: "TimeEntry.invoiceLine" }),
    expense: relationship({ ref: "Expense.invoiceLine" }),
    lineType: select({
      type: "enum",
      options: [
        { label: "Time", value: "time" },
        { label: "Expense", value: "expense" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Discount", value: "discount" },
        { label: "Tax", value: "tax" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    description: text({ access: { ...billingFieldAccess, update: denyAll }, validation: { isRequired: true } }),
    quantity: integer({ defaultValue: 1, validation: { min: 1 } }),
    unitAmountMinor: integer({ validation: { isRequired: true } }),
    subtotalMinor: integer({ validation: { isRequired: true } }),
    discountMinor: integer({ defaultValue: 0, validation: { min: 0 } }),
    taxMinor: integer({ defaultValue: 0, validation: { min: 0 } }),
    lineTotalMinor: integer({ validation: { isRequired: true } }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, ...currencyValidation } }),
    sourceRecordId: text(),
    serviceDate: timestamp(),
    ...trackingFields,
  },
});
