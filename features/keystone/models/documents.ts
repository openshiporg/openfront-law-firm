import { list } from "@keystone-6/core";
import {
  integer,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { activeFirmId, permissions, rules } from "../access";
import { prismaWithoutGraphQLErrorConversion } from "../lib/transactions";
import { changedFields, denyAll, firmOwnedHooks, relationshipConnectionIds } from "../tenancy";
import {
  firmRelationship,
  readOnlyRelationship,
  requireRelationshipPrismaField,
  requiredRelationship,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const canReadDocuments = ({ session }: any) =>
  permissions.canReadDocuments({ session }) || permissions.canManageDocuments({ session });
const canManageDocuments = ({ session }: any) => permissions.canManageDocuments({ session });

const documentAccess = {
  operation: {
    query: canReadDocuments,
    create: canManageDocuments,
    update: canManageDocuments,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadDocumentRecord,
    update: rules.canManageDocumentRecord,
    delete: rules.canManageDocumentRecord,
  },
};

const documentFieldAccess = {
  read: canReadDocuments,
  create: canManageDocuments,
  update: canManageDocuments,
};

const controlledDocumentLifecycleAccess = {
  read: canReadDocuments,
  create: canManageDocuments,
  update: denyAll,
};

const immutableDocumentEvidenceAccess = {
  operation: {
    query: canReadDocuments,
    create: denyAll,
    update: denyAll,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadDocumentRecord,
    update: () => false,
    delete: () => false,
  },
};

const immutableSignatureRequestAccess = {
  ...documentAccess,
  operation: { ...documentAccess.operation, update: denyAll },
  filter: { ...documentAccess.filter, update: () => false },
};

const controlledSignerFieldAccess = {
  read: canReadDocuments,
  create: canManageDocuments,
  update: denyAll,
};

export async function validateDocumentCurrentVersion(args: any) {
  if (!args.resolvedData?.["currentVersion"] !== undefined) return;
  const versionId = relationshipConnectionIds(args.resolvedData.currentVersion)[0];
  if (!versionId) {
    if (args.item?.status === "active") args.addValidationError("An active document must retain an exact current version.");
    return;
  }
  if (args.operation === "create" || !args.item?.id) {
    args.addValidationError("Create the document before assigning one of its immutable versions as current.");
    return;
  }
  const firmId = activeFirmId(args.context.session);
  const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma) as any;
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, firmId, documentId: args.item.id },
    select: { id: true },
  });
  if (!version) args.addValidationError("Current version must be an immutable version of this same document.");
}

const baseDocumentHooks = firmOwnedHooks({ lifecycle: "document", controlledStatus: true });
const documentHooks = {
  ...baseDocumentHooks,
  validate: {
    create: async (args: any) => {
      await baseDocumentHooks.validate.create(args);
      await validateDocumentCurrentVersion(args);
    },
    update: async (args: any) => {
      await baseDocumentHooks.validate.update(args);
      await validateDocumentCurrentVersion(args);
    },
  },
};

export const Document = list({
  access: documentAccess,
  hooks: documentHooks,
  ui: { listView: { initialColumns: ["title", "status", "category", "matter", "currentVersion"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    intake: relationship({ ref: "Intake" }),
    contact: relationship({ ref: "Contact" }),
    title: text({ access: documentFieldAccess, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      access: controlledDocumentLifecycleAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
        { label: "Disposed", value: "disposed" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    category: select({
      type: "enum",
      options: [
        { label: "Pleading", value: "pleading" },
        { label: "Correspondence", value: "correspondence" },
        { label: "Evidence", value: "evidence" },
        { label: "Contract", value: "contract" },
        { label: "Research", value: "research" },
        { label: "Billing", value: "billing" },
        { label: "Internal", value: "internal" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "other",
    }),
    confidentiality: select({
      type: "enum",
      options: [
        { label: "Matter", value: "matter" },
        { label: "Restricted", value: "restricted" },
        { label: "Client shareable", value: "client_shareable" },
      ],
      defaultValue: "matter",
    }),
    description: text({ access: documentFieldAccess, ui: { displayMode: "textarea" } }),
    currentVersion: relationship({
      ref: "DocumentVersion",
      access: controlledDocumentLifecycleAccess,
      graphql: { omit: { update: true } },
    }),
    versions: readOnlyRelationship("DocumentVersion.document", true),
    archivedAt: timestamp({ access: controlledDocumentLifecycleAccess, graphql: { omit: { update: true } } }),
    disposedAt: timestamp({ access: controlledDocumentLifecycleAccess, graphql: { omit: { update: true } } }),
    retentionPolicy: relationship({
      ref: "RetentionPolicy.documents",
      access: controlledDocumentLifecycleAccess,
      graphql: { omit: { update: true } },
    }),
    ...trackingFields,
  },
});

export const DocumentVersion = list({
  db: uniqueConstraints(["documentId", "versionNumber"]),
  access: {
    operation: {
      query: canReadDocuments,
      create: canManageDocuments,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadDocumentRecord,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: {
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["document", "versionNumber", "fileName", "checksumSha256", "createdAt"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    document: requiredRelationship("Document.versions"),
    versionKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    versionNumber: integer({ validation: { isRequired: true, min: 1 } }),
    fileName: text({ access: documentFieldAccess, validation: { isRequired: true } }),
    objectKey: text({ access: documentFieldAccess, validation: { isRequired: true } }),
    mediaType: text({ validation: { isRequired: true } }),
    byteSize: integer({ validation: { isRequired: true, min: 0 } }),
    checksumSha256: text({
      validation: {
        isRequired: true,
        match: { regex: /^[a-f0-9]{64}$/i, explanation: "Use a 64-character SHA-256 hex digest." },
      },
    }),
    source: select({
      type: "enum",
      options: [
        { label: "Upload", value: "upload" },
        { label: "Generated", value: "generated" },
        { label: "Email", value: "email" },
        { label: "Court", value: "court" },
        { label: "Signature provider", value: "signature_provider" },
        { label: "Import", value: "import" },
      ],
      defaultValue: "upload",
    }),
    createdBy: relationship({ ref: "User" }),
    sourceMessage: relationship({ ref: "CommunicationMessage" }),
    sourceDocketEntry: relationship({ ref: "DocketEntry" }),
    notes: text({ access: documentFieldAccess, ui: { displayMode: "textarea" } }),
    signatureRequests: readOnlyRelationship("SignatureRequest.documentVersion", true),
    ...trackingFields,
  },
});

const baseSignatureRequestHooks = firmOwnedHooks({ lifecycle: "signatureRequest", controlledStatus: true });
const signatureRequestHooks = {
  ...baseSignatureRequestHooks,
  validate: {
    create: baseSignatureRequestHooks.validate.create,
    update: async (args: any) => {
      await baseSignatureRequestHooks.validate.update(args);
      if (args.item.status !== "draft" && changedFields(args.resolvedData).length) {
        args.addValidationError("A signature request is immutable after provider handoff.");
      }
    },
  },
};

export const SignatureRequest = list({
  access: immutableSignatureRequestAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: signatureRequestHooks,
  ui: { listView: { initialColumns: ["title", "status", "documentVersion", "provider", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    documentVersion: relationship({
      ref: "DocumentVersion.signatureRequests",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { read: canReadDocuments, create: canManageDocuments, update: denyAll },
    }),
    title: text({ access: documentFieldAccess, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Partially signed", value: "partially_signed" },
        { label: "Completed", value: "completed" },
        { label: "Declined", value: "declined" },
        { label: "Expired", value: "expired" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    provider: text(),
    integrationConnection: relationship({ ref: "IntegrationConnection" }),
    providerRequestId: text({ isIndexed: true }),
    message: text({ access: documentFieldAccess, ui: { displayMode: "textarea" } }),
    sentAt: timestamp(),
    completedAt: timestamp(),
    expiresAt: timestamp(),
    signers: readOnlyRelationship("DocumentSigner.request", true),
    events: readOnlyRelationship("SignatureEvent.request", true),
    ...trackingFields,
  },
});

const baseDocumentSignerHooks = firmOwnedHooks({ lifecycle: "signer", controlledStatus: true });
const documentSignerHooks = {
  ...baseDocumentSignerHooks,
  validate: {
    update: baseDocumentSignerHooks.validate.update,
    create: async (args: any) => {
      await baseDocumentSignerHooks.validate.create(args);
      const requestId = relationshipConnectionIds(args.resolvedData.request)[0];
      const firmId = activeFirmId(args.context.session);
      if (!requestId || !firmId) return;
      const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma) as any;
      const request = await prisma.signatureRequest.findFirst({
        where: { id: requestId, firmId, status: "draft" },
        select: { id: true },
      });
      if (!request) args.addValidationError("Signers may be added only before provider handoff.");
    },
  },
};

export const DocumentSigner = list({
  access: immutableDocumentEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: documentSignerHooks,
  ui: { listView: { initialColumns: ["request", "name", "email", "status", "signingOrder"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    request: relationship({
      ref: "SignatureRequest.signers",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: controlledSignerFieldAccess,
    }),
    contact: relationship({ ref: "Contact", access: controlledSignerFieldAccess }),
    portalAccount: relationship({ ref: "PortalAccount", access: controlledSignerFieldAccess }),
    name: text({ access: controlledSignerFieldAccess, validation: { isRequired: true } }),
    email: text({ access: controlledSignerFieldAccess, validation: { isRequired: true } }),
    signingOrder: integer({ access: controlledSignerFieldAccess, defaultValue: 1, validation: { min: 1 } }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Viewed", value: "viewed" },
        { label: "Signed", value: "signed" },
        { label: "Declined", value: "declined" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    providerSignerId: text({ access: controlledSignerFieldAccess, isIndexed: true }),
    viewedAt: timestamp({ access: controlledSignerFieldAccess }),
    signedAt: timestamp({ access: controlledSignerFieldAccess }),
    declinedAt: timestamp({ access: controlledSignerFieldAccess }),
    events: readOnlyRelationship("SignatureEvent.signer", true),
    ...trackingFields,
  },
});

export const SignatureEvent = list({
  db: uniqueConstraints(["firmId", "providerEventId"]),
  access: {
    operation: {
      query: canReadDocuments,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadDocumentRecord,
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
    listView: { initialColumns: ["request", "signer", "eventType", "occurredAt", "providerEventId"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    request: requiredRelationship("SignatureRequest.events"),
    signer: relationship({ ref: "DocumentSigner.events" }),
    eventType: text({ validation: { isRequired: true } }),
    providerEventId: text({ isIndexed: true }),
    actorReference: text({ access: documentFieldAccess }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    evidence: json({
      access: documentFieldAccess,
      ui: { description: "Bounded signature evidence; never provider credentials or unrestricted request bodies." },
    }),
    ...trackingFields,
  },
});
