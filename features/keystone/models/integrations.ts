import { list } from "@keystone-6/core";
import {
  integer,
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
  readOnlyRelationship,
  requiredRelationship,
  scopedAccess,
  secretText,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const canReadIntegrations = ({ session }: any) =>
  permissions.canReadIntegrations({ session }) || permissions.canManageIntegrations({ session });
const canManageIntegrations = ({ session }: any) =>
  permissions.canManageIntegrations({ session });
const integrationAccess = scopedAccess("canReadIntegrations", "canManageIntegrations");
const integrationMatterAccess = {
  operation: {
    query: canReadIntegrations,
    create: canManageIntegrations,
    update: canManageIntegrations,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadIntegrationRecord,
    update: rules.canManageIntegrationRecord,
    delete: rules.canManageIntegrationRecord,
  },
};
const integrationFieldAccess = {
  read: canReadIntegrations,
  create: canManageIntegrations,
  update: canManageIntegrations,
};
const controlledDeliveryEvidenceAccess = {
  read: canReadIntegrations,
  create: denyAll,
  update: denyAll,
};

export const IntegrationConnection = list({
  access: integrationAccess,
  hooks: firmOwnedHooks({ lifecycle: "integrationConnection", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "provider", "category", "status", "office", "lastSyncedAt"] } },
  fields: {
    firm: firmRelationship(),
    office: relationship({ ref: "Office" }),
    owner: relationship({ ref: "User" }),
    name: text({ validation: { isRequired: true } }),
    provider: text({ validation: { isRequired: true } }),
    category: select({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "Calendar", value: "calendar" },
        { label: "Document storage", value: "document_storage" },
        { label: "Signature", value: "signature" },
        { label: "Payment", value: "payment" },
        { label: "Court / docket", value: "court" },
        { label: "Accounting", value: "accounting" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Needs reauthorization", value: "needs_reauth" },
        { label: "Disabled", value: "disabled" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    credentialsEncrypted: secretText("Encrypted credentials envelope"),
    oauthAccessToken: secretText("OAuth access token envelope"),
    oauthRefreshToken: secretText("OAuth refresh token envelope"),
    webhookSecretDigest: secretText("Webhook secret digest"),
    configuration: json({
      access: integrationFieldAccess,
      ui: { description: "Non-secret provider configuration only. Secret material belongs in omitted credential fields." },
    }),
    externalAccountId: text({ access: integrationFieldAccess }),
    lastSyncedAt: timestamp(),
    lastErrorAt: timestamp(),
    lastError: text({ access: integrationFieldAccess, ui: { displayMode: "textarea" } }),
    externalLinks: readOnlyRelationship("ExternalRecordLink.connection", true),
    webhookSubscriptions: readOnlyRelationship("WebhookSubscription.connection", true),
    webhookDeliveries: readOnlyRelationship("WebhookDelivery.connection", true),
    ...trackingFields,
  },
});

export const ExternalRecordLink = list({
  db: uniqueConstraints(["connectionId", "resourceType", "externalId"]),
  access: integrationMatterAccess,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["connection", "resourceType", "externalId", "status", "lastSyncedAt"] } },
  fields: {
    firm: firmRelationship(),
    connection: requiredRelationship("IntegrationConnection.externalLinks"),
    resourceType: select({
      type: "enum",
      options: [
        { label: "Contact", value: "contact" },
        { label: "Intake", value: "intake" },
        { label: "Matter", value: "matter" },
        { label: "Document", value: "document" },
        { label: "Invoice", value: "invoice" },
        { label: "Payment", value: "payment" },
        { label: "Docket", value: "docket" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    externalId: text({ validation: { isRequired: true }, isIndexed: true }),
    externalUrl: text(),
    status: select({
      type: "enum",
      options: [
        { label: "Linked", value: "linked" },
        { label: "Conflict", value: "conflict" },
        { label: "Unlinked", value: "unlinked" },
      ],
      defaultValue: "linked",
    }),
    contact: relationship({ ref: "Contact" }),
    intake: relationship({ ref: "Intake" }),
    matter: relationship({ ref: "Matter" }),
    document: relationship({ ref: "Document" }),
    invoice: relationship({ ref: "Invoice" }),
    payment: relationship({ ref: "Payment" }),
    docket: relationship({ ref: "Docket" }),
    fingerprint: text({ access: integrationFieldAccess }),
    providerMetadata: json({
      access: integrationFieldAccess,
      ui: { description: "Bounded sync provenance; never credentials or unrestricted provider records." },
    }),
    lastSyncedAt: timestamp(),
    lastError: text({ access: integrationFieldAccess }),
    ...trackingFields,
  },
});

export const WebhookSubscription = list({
  access: integrationAccess,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "connection", "status", "endpointUrl", "lastDeliveredAt"] } },
  fields: {
    firm: firmRelationship(),
    office: relationship({ ref: "Office" }),
    connection: requiredRelationship("IntegrationConnection.webhookSubscriptions"),
    name: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    endpointUrl: text({ access: integrationFieldAccess, validation: { isRequired: true } }),
    eventTypes: multiselect({
      type: "enum",
      options: [
        { label: "Matter changed", value: "matter_changed" },
        { label: "Document changed", value: "document_changed" },
        { label: "Invoice changed", value: "invoice_changed" },
        { label: "Payment changed", value: "payment_changed" },
        { label: "Task changed", value: "task_changed" },
      ],
      defaultValue: [],
    }),
    signingSecretDigest: secretText("Signing secret digest"),
    // A digest cannot produce outbound HMACs; the dispatcher decrypts this server-side only.
    signingSecretEncrypted: secretText("Encrypted outbound signing secret envelope"),
    lastDeliveredAt: timestamp(),
    deliveries: readOnlyRelationship("WebhookDelivery.subscription", true),
    ...trackingFields,
  },
});

export const WebhookDelivery = list({
  db: uniqueConstraints(["firmId", "eventId"]),
  access: {
    ...integrationMatterAccess,
    operation: { ...integrationMatterAccess.operation, create: denyAll, update: denyAll },
    filter: { ...integrationMatterAccess.filter, update: () => false },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "webhookDelivery", controlledStatus: true }),
  ui: { listView: { initialColumns: ["eventId", "eventType", "subscription", "status", "attemptCount", "nextAttemptAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    connection: requiredRelationship("IntegrationConnection.webhookDeliveries"),
    subscription: requiredRelationship("WebhookSubscription.deliveries"),
    eventId: text({ isIndexed: true, validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
        { label: "Dead letter", value: "dead_letter" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    payload: json({ access: integrationFieldAccess }),
    destinationUrl: text({ access: controlledDeliveryEvidenceAccess }),
    attemptCount: integer({ access: controlledDeliveryEvidenceAccess, defaultValue: 0, validation: { min: 0 } }),
    nextAttemptAt: timestamp({ access: controlledDeliveryEvidenceAccess }),
    completedAt: timestamp({ access: controlledDeliveryEvidenceAccess }),
    lastError: text({ access: controlledDeliveryEvidenceAccess, ui: { displayMode: "textarea" } }),
    attempts: readOnlyRelationship("WebhookDeliveryAttempt.delivery", true),
    ...trackingFields,
  },
});

export const WebhookDeliveryAttempt = list({
  db: uniqueConstraints(["deliveryId", "attemptNumber"]),
  access: {
    operation: {
      query: canReadIntegrations,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadIntegrationRecord,
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
    listView: { initialColumns: ["delivery", "attemptNumber", "attemptedAt", "responseStatus", "succeeded"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    delivery: requiredRelationship("WebhookDelivery.attempts"),
    attemptNumber: integer({ validation: { isRequired: true, min: 1 } }),
    attemptedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    requestDigest: text({ validation: { isRequired: true } }),
    responseStatus: integer(),
    responseDigest: text(),
    succeeded: select({
      type: "enum",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
      validation: { isRequired: true },
    }),
    errorCode: text(),
    errorMessage: text({ access: integrationFieldAccess, ui: { displayMode: "textarea" } }),
    ...trackingFields,
  },
});
