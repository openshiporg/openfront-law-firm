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
import { denyAll, firmOwnedHooks } from "../tenancy";
import { firmRelationship, readOnlyRelationship, requiredRelationship } from "./fields";
import { trackingFields } from "./trackingFields";

const canReadCommunications = ({ session }: any) =>
  permissions.canReadCommunications({ session }) || permissions.canManageCommunications({ session });
const canManageCommunications = ({ session }: any) =>
  permissions.canManageCommunications({ session });

const communicationAccess = {
  operation: {
    query: canReadCommunications,
    create: canManageCommunications,
    update: canManageCommunications,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadCommunicationRecord,
    update: rules.canManageCommunicationRecord,
    delete: rules.canManageCommunicationRecord,
  },
};

const messageFieldAccess = {
  read: canReadCommunications,
  create: canManageCommunications,
  update: canManageCommunications,
};

export const CommunicationThread = list({
  access: communicationAccess,
  hooks: firmOwnedHooks({ lifecycle: "communicationThread" }),
  ui: { listView: { initialColumns: ["subject", "status", "matter", "intake", "lastMessageAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    intake: relationship({ ref: "Intake" }),
    subject: text({ access: messageFieldAccess, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Archived", value: "archived" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "open",
      validation: { isRequired: true },
    }),
    primaryChannel: select({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Phone", value: "phone" },
        { label: "Portal", value: "portal" },
        { label: "Internal", value: "internal" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "email",
    }),
    lastMessageAt: timestamp(),
    participants: readOnlyRelationship("CommunicationParticipant.thread", true),
    messages: readOnlyRelationship("CommunicationMessage.thread", true),
    ...trackingFields,
  },
});

export const CommunicationParticipant = list({
  access: communicationAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["thread", "participantRole", "user", "contact", "status"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    thread: requiredRelationship("CommunicationThread.participants"),
    user: relationship({ ref: "User" }),
    contact: relationship({ ref: "Contact" }),
    portalAccount: relationship({ ref: "PortalAccount" }),
    participantRole: select({
      type: "enum",
      options: [
        { label: "Staff", value: "staff" },
        { label: "Client", value: "client" },
        { label: "External counsel", value: "external_counsel" },
        { label: "Third party", value: "third_party" },
        { label: "System", value: "system" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Removed", value: "removed" },
      ],
      defaultValue: "active",
    }),
    displayAddress: text({ access: messageFieldAccess }),
    addedAt: timestamp({ defaultValue: { kind: "now" } }),
    removedAt: timestamp(),
    ...trackingFields,
  },
});

const baseCommunicationMessageHooks = firmOwnedHooks({ lifecycle: "communicationMessage", controlledStatus: true });
const communicationMessageHooks = {
  ...baseCommunicationMessageHooks,
  validate: {
    create: baseCommunicationMessageHooks.validate.create,
    update: async (args: any) => {
      await baseCommunicationMessageHooks.validate.update(args);
      if (args.item.status !== "draft" && Object.keys(args.resolvedData).length) {
        args.addValidationError("A queued communication envelope is immutable.");
      }
    },
  },
};

export const CommunicationMessage = list({
  access: communicationAccess,
  hooks: communicationMessageHooks,
  ui: { listView: { initialColumns: ["thread", "direction", "channel", "status", "sentAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    thread: requiredRelationship("CommunicationThread.messages"),
    direction: select({
      type: "enum",
      options: [
        { label: "Inbound", value: "inbound" },
        { label: "Outbound", value: "outbound" },
        { label: "Internal", value: "internal" },
      ],
      validation: { isRequired: true },
    }),
    channel: select({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Phone", value: "phone" },
        { label: "Portal", value: "portal" },
        { label: "Internal", value: "internal" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Queued", value: "queued" },
        { label: "Sent", value: "sent" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" },
        { label: "Received", value: "received" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    subject: text({ access: { ...messageFieldAccess, update: denyAll } }),
    body: text({
      access: { ...messageFieldAccess, update: denyAll },
      validation: { isRequired: true },
      ui: { displayMode: "textarea" },
    }),
    senderUser: relationship({ ref: "User" }),
    senderContact: relationship({ ref: "Contact" }),
    senderAgent: relationship({ ref: "AgentPrincipal" }),
    externalMessageId: text({ isIndexed: true }),
    replyToMessage: relationship({ ref: "CommunicationMessage.replies" }),
    replies: readOnlyRelationship("CommunicationMessage.replyToMessage", true),
    queuedAt: timestamp(),
    sentAt: timestamp(),
    receivedAt: timestamp(),
    metadata: json({
      access: messageFieldAccess,
      ui: { description: "Bounded provider provenance; never credentials or unrestricted raw provider payloads." },
    }),
    attachments: relationship({
      ref: "DocumentVersion",
      many: true,
      access: { create: canManageCommunications, update: denyAll },
    }),
    deliveries: readOnlyRelationship("CommunicationDelivery.message", true),
    ...trackingFields,
  },
});

export const CommunicationDelivery = list({
  access: {
    ...communicationAccess,
    operation: { ...communicationAccess.operation, update: denyAll },
    filter: { ...communicationAccess.filter, update: () => false },
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "communicationDelivery", controlledStatus: true }),
  ui: { listView: { initialColumns: ["message", "channel", "status", "recipientAddress", "attemptCount"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    message: requiredRelationship("CommunicationMessage.deliveries"),
    integrationConnection: relationship({ ref: "IntegrationConnection" }),
    channel: select({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Portal", value: "portal" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Sent", value: "sent" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" },
        { label: "Bounced", value: "bounced" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    recipientContact: relationship({ ref: "Contact" }),
    recipientAddress: text({ access: messageFieldAccess }),
    provider: text(),
    providerMessageId: text({ isIndexed: true }),
    attemptCount: integer({ defaultValue: 0, validation: { min: 0 } }),
    lastAttemptAt: timestamp(),
    deliveredAt: timestamp(),
    errorCode: text(),
    errorMessage: text({ access: messageFieldAccess, ui: { displayMode: "textarea" } }),
    providerMetadata: json({ access: messageFieldAccess }),
    ...trackingFields,
  },
});
