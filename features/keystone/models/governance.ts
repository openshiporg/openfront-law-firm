import { list } from "@keystone-6/core";
import {
  integer,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { changedFields, denyAll, firmOwnedHooks } from "../tenancy";
import {
  firmRelationship,
  readOnlyRelationship,
  requiredRelationship,
  scopedAccess,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const retentionAccess = scopedAccess("canReadRetention", "canManageRetention");
const retentionMatterAccess = {
  operation: {
    query: permissions.canReadRetention,
    create: permissions.canManageRetention,
    update: permissions.canManageRetention,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadRetentionRecord,
    update: rules.canManageRetentionRecord,
    delete: rules.canManageRetentionRecord,
  },
};
const retentionFieldAccess = {
  read: ({ session }: any) => permissions.canReadRetention({ session }),
  create: ({ session }: any) => permissions.canManageRetention({ session }),
  update: ({ session }: any) => permissions.canManageRetention({ session }),
};

const controlledPolicyStatusAccess = {
  read: ({ session }: any) => permissions.canReadRetention({ session }),
  create: ({ session }: any) => permissions.canManageRetention({ session }),
  update: denyAll,
};

const immutableHoldTargetAccess = {
  read: ({ session }: any) => permissions.canReadRetention({ session }),
  create: ({ session }: any) => permissions.canManageRetention({ session }),
  update: denyAll,
};

const baseRetentionPolicyHooks = firmOwnedHooks({ lifecycle: "retentionPolicy", controlledStatus: true });
const immutableActivePolicyFields = new Set([
  "name", "code", "recordClass", "trigger", "retentionDays", "practiceArea",
  "description", "jurisdictionReference",
]);
const retentionPolicyHooks = {
  ...baseRetentionPolicyHooks,
  validate: {
    ...baseRetentionPolicyHooks.validate,
    update: async (args: any) => {
      await baseRetentionPolicyHooks.validate.update(args);
      if (
        args.item?.status !== "draft" &&
        changedFields(args.resolvedData).some((field) => immutableActivePolicyFields.has(field))
      ) {
        args.addValidationError("Active or retired retention policy terms are immutable; create a new policy version.");
      }
    },
  },
};

export const RetentionPolicy = list({
  db: uniqueConstraints(["firmId", "code"]),
  access: retentionAccess,
  graphql: { omit: { delete: true } },
  hooks: retentionPolicyHooks,
  ui: { listView: { initialColumns: ["name", "code", "status", "recordClass", "retentionDays"] } },
  fields: {
    firm: firmRelationship(),
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: true, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      access: controlledPolicyStatusAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Retired", value: "retired" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    recordClass: select({
      type: "enum",
      options: [
        { label: "Matter", value: "matter" },
        { label: "Document", value: "document" },
        { label: "Communication", value: "communication" },
        { label: "Billing", value: "billing" },
        { label: "Contact", value: "contact" },
        { label: "Audit", value: "audit" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    trigger: select({
      type: "enum",
      options: [
        { label: "Matter closed", value: "matter_closed" },
        { label: "Document archived", value: "document_archived" },
        { label: "Record created", value: "record_created" },
        { label: "Manual", value: "manual" },
      ],
      validation: { isRequired: true },
    }),
    retentionDays: integer({ validation: { isRequired: true, min: 0 } }),
    practiceArea: relationship({ ref: "PracticeArea" }),
    description: text({ access: retentionFieldAccess, ui: { displayMode: "textarea" } }),
    jurisdictionReference: text({
      access: retentionFieldAccess,
      ui: { description: "Firm-entered reference only; this platform does not determine jurisdictional requirements." },
    }),
    documents: readOnlyRelationship("Document.retentionPolicy", true),
    holds: readOnlyRelationship("RetentionHold.policy", true),
    actions: readOnlyRelationship("RetentionAction.policy", true),
    ...trackingFields,
  },
});

export const RetentionHold = list({
  access: {
    ...retentionMatterAccess,
    operation: { ...retentionMatterAccess.operation, create: denyAll, update: denyAll },
    filter: { ...retentionMatterAccess.filter, update: () => false },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "retentionHold", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "status", "matter", "document", "contact", "createdBy"] } },
  fields: {
    firm: firmRelationship(),
    policy: relationship({ ref: "RetentionPolicy.holds" }),
    name: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Released", value: "released" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    matter: relationship({ ref: "Matter", access: immutableHoldTargetAccess }),
    document: relationship({ ref: "Document", access: immutableHoldTargetAccess }),
    contact: relationship({ ref: "Contact", access: immutableHoldTargetAccess }),
    reason: text({ access: retentionFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    authorityReference: text({ access: retentionFieldAccess }),
    createdBy: requiredRelationship("User"),
    effectiveAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    releasedBy: relationship({ ref: "User" }),
    releasedAt: timestamp(),
    releaseReason: text({ access: retentionFieldAccess, ui: { displayMode: "textarea" } }),
    actions: readOnlyRelationship("RetentionAction.hold", true),
    ...trackingFields,
  },
});

export const RetentionAction = list({
  access: {
    operation: {
      query: permissions.canReadRetention,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadRetentionRecord,
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
    listView: { initialColumns: ["actionType", "resourceType", "matter", "document", "occurredAt", "performedBy"] },
  },
  fields: {
    firm: firmRelationship(),
    policy: relationship({ ref: "RetentionPolicy.actions" }),
    hold: relationship({ ref: "RetentionHold.actions" }),
    actionType: select({
      type: "enum",
      options: [
        { label: "Archived", value: "archived" },
        { label: "Disposed", value: "disposed" },
        { label: "Restored", value: "restored" },
        { label: "Hold applied", value: "hold_applied" },
        { label: "Hold released", value: "hold_released" },
      ],
      validation: { isRequired: true },
    }),
    resourceType: select({
      type: "enum",
      options: [
        { label: "Matter", value: "matter" },
        { label: "Document", value: "document" },
        { label: "Contact", value: "contact" },
        { label: "Communication thread", value: "communication_thread" },
        { label: "Invoice", value: "invoice" },
      ],
      validation: { isRequired: true },
    }),
    matter: relationship({ ref: "Matter" }),
    document: relationship({ ref: "Document" }),
    contact: relationship({ ref: "Contact" }),
    communicationThread: relationship({ ref: "CommunicationThread" }),
    invoice: relationship({ ref: "Invoice" }),
    performedBy: relationship({ ref: "User" }),
    performedByAgent: relationship({ ref: "AgentPrincipal" }),
    approvedBy: relationship({ ref: "User" }),
    evidenceDigest: text({ validation: { isRequired: true } }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: json({
      access: retentionFieldAccess,
      ui: { description: "Bounded disposal evidence; never record bodies, document content, or credentials." },
    }),
    ...trackingFields,
  },
});

export const AuditEvent = list({
  db: uniqueConstraints(["firmId", "eventId"]),
  access: {
    operation: {
      query: permissions.canViewAudit,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadAuditRecord,
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
    listView: { initialColumns: ["eventType", "category", "outcome", "actorUser", "matter", "occurredAt"] },
  },
  fields: {
    firm: firmRelationship(),
    eventId: text({ isIndexed: true, validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true } }),
    category: select({
      type: "enum",
      options: [
        { label: "Authentication", value: "authentication" },
        { label: "Authorization", value: "authorization" },
        { label: "Legal workflow", value: "legal_workflow" },
        { label: "Financial", value: "financial" },
        { label: "Integration", value: "integration" },
        { label: "Retention", value: "retention" },
        { label: "Agent", value: "agent" },
      ],
      validation: { isRequired: true },
    }),
    outcome: select({
      type: "enum",
      options: [
        { label: "Succeeded", value: "succeeded" },
        { label: "Denied", value: "denied" },
        { label: "Failed", value: "failed" },
      ],
      validation: { isRequired: true },
    }),
    actorUser: relationship({ ref: "User" }),
    actorAgent: relationship({ ref: "AgentPrincipal" }),
    actorType: text({ validation: { isRequired: true } }),
    matter: relationship({ ref: "Matter" }),
    contact: relationship({ ref: "Contact" }),
    intake: relationship({ ref: "Intake" }),
    document: relationship({ ref: "Document" }),
    invoice: relationship({ ref: "Invoice" }),
    payment: relationship({ ref: "Payment" }),
    trustTransaction: relationship({ ref: "TrustTransaction" }),
    agentAction: relationship({ ref: "AgentAction" }),
    sourceIp: text({ access: { read: permissions.canViewAudit } }),
    userAgent: text({ access: { read: permissions.canViewAudit } }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: json({
      access: { read: permissions.canViewAudit },
      ui: { description: "Bounded event facts only; never privileged content or credential material." },
    }),
    ...trackingFields,
  },
});
