import { list } from "@keystone-6/core";
import {
  checkbox,
  json,
  multiselect,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import {
  firmRelationship,
  immutableUpdateDeleteGraphql,
  readOnlyRelationship,
  requireRelationshipPrismaField,
  requiredRelationship,
  scopedAccess,
  secretText,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const agentAccess = scopedAccess("canReadAgents", "canManageAgents");
const canReadAgents = ({ session }: any) =>
  permissions.canReadAgents({ session }) || permissions.canManageAgents({ session });
const canManageAgents = ({ session }: any) => permissions.canManageAgents({ session });
const immutableAgentIdentityAccess = {
  read: canReadAgents,
  create: canManageAgents,
  update: denyAll,
};

const agentFieldAccess = {
  read: canReadAgents,
  create: canManageAgents,
  update: canManageAgents,
};

const controlledAgentApprovalAccess = {
  read: canReadAgents,
  create: denyAll,
  update: denyAll,
};

const capabilityOptions = [
  { label: "Matter read", value: "matter.read" },
  { label: "Privileged read", value: "privileged.read" },
  { label: "Task draft", value: "task.draft" },
  { label: "Communication send", value: "communication.send" },
  { label: "Document publish", value: "document.publish" },
  { label: "Signature send", value: "signature.send" },
  { label: "Matter transition", value: "matter.transition" },
  { label: "Conflict resolve", value: "conflict.resolve" },
  { label: "Invoice issue", value: "invoice.issue" },
  { label: "Billing write", value: "billing.write" },
  { label: "Payment capture", value: "payment.capture" },
  { label: "Payment refund", value: "payment.refund" },
  { label: "Trust post", value: "trust.post" },
  { label: "Retention dispose", value: "retention.dispose" },
  { label: "Access change", value: "access.change" },
] as const;

const baseAgentGrantHooks = firmOwnedHooks({ lifecycle: "agentGrant" });
const grantAuthorityFields = new Set([
  "matter", "agentPrincipal", "capabilities", "reason", "requestedBy", "startsAt", "expiresAt",
]);

function grantRequiresApproval(args: any, resolvedData: Record<string, unknown>) {
  return (
    (resolvedData.status === "active" && args.item?.status !== "active") ||
    (args.item?.status === "active" && Object.keys(resolvedData).some((field) => grantAuthorityFields.has(field)))
  );
}

function bindGrantApproval(args: any, resolvedData: Record<string, unknown>) {
  if (!grantRequiresApproval(args, resolvedData)) return resolvedData;
  if (!permissions.canApproveAgentActions({ session: args.context.session })) return resolvedData;
  return {
    ...resolvedData,
    approvedBy: { connect: { id: args.context.session.itemId } },
    approvedAt: new Date(),
  };
}

const agentGrantHooks = {
  resolveInput: {
    create: (args: any) => {
      const resolvedData = baseAgentGrantHooks.resolveInput.create(args);
      return bindGrantApproval(args, resolvedData);
    },
    update: (args: any) => bindGrantApproval(args, args.resolvedData),
  },
  validate: {
    create: async (args: any) => {
      await baseAgentGrantHooks.validate.create(args);
      if (grantRequiresApproval(args, args.resolvedData) && !permissions.canApproveAgentActions({ session: args.context.session })) {
        args.addValidationError("Activating or changing active agent authority requires agent-approval permission.");
      }
    },
    update: async (args: any) => {
      await baseAgentGrantHooks.validate.update(args);
      if (
        grantRequiresApproval(args, args.resolvedData) &&
        !permissions.canApproveAgentActions({ session: args.context.session })
      ) {
        args.addValidationError("Activating or changing active agent authority requires agent-approval permission.");
      }
    },
  },
};

export const AgentPrincipal = list({
  access: agentAccess,
  hooks: firmOwnedHooks({ lifecycle: "agentPrincipal" }),
  ui: { listView: { initialColumns: ["name", "agentType", "status", "owner", "provider"] } },
  fields: {
    firm: firmRelationship(),
    owner: relationship({
      ref: "User",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: immutableAgentIdentityAccess,
      graphql: { omit: { update: true } },
    }),
    name: text({ validation: { isRequired: true } }),
    agentType: select({
      type: "enum",
      access: immutableAgentIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Assistant", value: "assistant" },
        { label: "Workflow", value: "workflow" },
        { label: "Integration", value: "integration" },
        { label: "Service account", value: "service_account" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      access: immutableAgentIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    provider: text(),
    model: text(),
    description: text({ access: agentFieldAccess, ui: { displayMode: "textarea" } }),
    lastActiveAt: timestamp(),
    credentials: readOnlyRelationship("AgentCredential.agentPrincipal", true),
    grants: readOnlyRelationship("AgentGrant.agentPrincipal", true),
    actions: readOnlyRelationship("AgentAction.agentPrincipal", true),
    actionEvents: readOnlyRelationship("AgentActionEvent.actorAgent", true),
    ...trackingFields,
  },
});

export const AgentCredential = list({
  access: {
    operation: {
      query: canReadAgents,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.activeFirmOwned,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "prefix", "agentPrincipal", "status", "expiresAt", "lastUsedAt"] } },
  fields: {
    firm: firmRelationship(),
    agentPrincipal: requiredRelationship("AgentPrincipal.credentials"),
    name: text({ validation: { isRequired: true } }),
    prefix: text({ isIndexed: "unique", validation: { isRequired: true } }),
    secretHash: secretText("Credential secret hash", true),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    scopes: multiselect({ type: "string", options: capabilityOptions, defaultValue: [] }),
    createdBy: requiredRelationship("User"),
    expiresAt: timestamp(),
    lastUsedAt: timestamp(),
    revokedAt: timestamp(),
    revokedBy: relationship({ ref: "User" }),
    ...trackingFields,
  },
});

export const AgentGrant = list({
  access: {
    operation: {
      query: canReadAgents,
      create: canManageAgents,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadAgentRecord,
      update: () => false,
      delete: rules.canManageAgentRecord,
    },
  },
  graphql: immutableUpdateDeleteGraphql,
  hooks: agentGrantHooks,
  ui: { listView: { initialColumns: ["agentPrincipal", "matter", "status", "approvedBy", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    agentPrincipal: requiredRelationship("AgentPrincipal.grants"),
    status: select({
      type: "enum",
      options: [
        { label: "Proposed", value: "proposed" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "proposed",
      validation: { isRequired: true },
    }),
    capabilities: multiselect({ type: "string", options: capabilityOptions, defaultValue: [] }),
    reason: text({ access: agentFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    requestedBy: requiredRelationship("User"),
    approvedBy: relationship({ ref: "User", access: controlledAgentApprovalAccess }),
    approvedAt: timestamp({ access: controlledAgentApprovalAccess }),
    startsAt: timestamp(),
    expiresAt: timestamp(),
    suspendedAt: timestamp(),
    revokedAt: timestamp(),
    actions: readOnlyRelationship("AgentAction.grant", true),
    ...trackingFields,
  },
});

export const AgentAction = list({
  db: uniqueConstraints(["firmId", "actionNumber"]),
  access: {
    operation: {
      query: canReadAgents,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadAgentRecord,
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
    listView: { initialColumns: ["actionNumber", "actionType", "status", "riskLevel", "agentPrincipal", "matter"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    agentPrincipal: requiredRelationship("AgentPrincipal.actions"),
    grant: requiredRelationship("AgentGrant.actions"),
    actionNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    idempotencyKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    actionType: select({ type: "string", options: capabilityOptions, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Awaiting approval", value: "awaiting_approval" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
        { label: "Executing", value: "executing" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
    }),
    riskLevel: select({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "High", value: "high" },
        { label: "Financial", value: "financial" },
        { label: "Access control", value: "access_control" },
      ],
      defaultValue: "high",
      validation: { isRequired: true },
    }),
    requestDigest: text({ validation: { isRequired: true } }),
    requestEnvelope: json({ access: agentFieldAccess }),
    requiresApproval: checkbox({ defaultValue: true }),
    requestedByUser: relationship({ ref: "User" }),
    approvedBy: relationship({ ref: "User" }),
    approvalDigest: text(),
    approvalExpiresAt: timestamp(),
    reviewedAt: timestamp(),
    rejectionReason: text({ access: agentFieldAccess }),
    contact: relationship({ ref: "Contact" }),
    intake: relationship({ ref: "Intake" }),
    document: relationship({ ref: "Document" }),
    invoice: relationship({ ref: "Invoice" }),
    payment: relationship({ ref: "Payment" }),
    trustTransaction: relationship({ ref: "TrustTransaction" }),
    deadline: relationship({ ref: "Deadline" }),
    task: relationship({ ref: "LegalTask" }),
    startedAt: timestamp(),
    completedAt: timestamp(),
    resultDigest: text(),
    resultEnvelope: json({ access: agentFieldAccess }),
    errorMessage: text({ access: agentFieldAccess }),
    events: readOnlyRelationship("AgentActionEvent.action", true),
    ...trackingFields,
  },
});

export const AgentActionEvent = list({
  access: {
    operation: {
      query: canReadAgents,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadAgentRecord,
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
    listView: { initialColumns: ["action", "eventType", "fromStatus", "toStatus", "actorUser", "occurredAt"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    action: requiredRelationship("AgentAction.events"),
    eventType: text({ validation: { isRequired: true } }),
    fromStatus: text(),
    toStatus: text(),
    actorUser: relationship({ ref: "User" }),
    actorAgent: relationship({ ref: "AgentPrincipal.actionEvents" }),
    reason: text({ access: agentFieldAccess }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: json({
      access: agentFieldAccess,
      ui: { description: "Bounded action evidence; never privileged content or credential material." },
    }),
    ...trackingFields,
  },
});
