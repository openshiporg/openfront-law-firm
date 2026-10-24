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
import { assertCurrentPortalActor, assertPortalMatterScope, policyGrantIsCurrent } from "../lib/portal-policy";
import { boundPortalShare, boundPortalShareWhere, portalShareIsCurrent, portalResourceTypes, portalShareHeaderSelect } from "../lib/portal-share-binding";
import { denyAll, firmOwnedHooks, relationshipConnectionIds } from "../tenancy";
import {
  firmRelationship,
  readOnlyRelationship,
  requiredRelationship,
  secretText,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const portalEvidenceOperation = {
  query: permissions.canReadPortal,
  create: denyAll,
  update: denyAll,
  delete: denyAll,
};
const portalAccountEvidenceAccess = {
  operation: portalEvidenceOperation,
  filter: {
    query: rules.activeFirmOwned,
    update: () => false,
    delete: () => false,
  },
};
const portalMatterEvidenceAccess = {
  operation: portalEvidenceOperation,
  filter: {
    query: rules.canReadPortalRecord,
    update: () => false,
    delete: () => false,
  },
};

const portalPiiAccess = {
  read: ({ session }: any) => permissions.canReadPortal({ session }),
  create: ({ session }: any) => permissions.canManagePortal({ session }),
  update: ({ session }: any) => permissions.canManagePortal({ session }),
};

const basePortalShareHooks = firmOwnedHooks({ lifecycle: "portalShare", controlledStatus: true });

function portalShareRelationId(args: any, field: string) {
  if (args.resolvedData?.[field] !== undefined) {
    return relationshipConnectionIds(args.resolvedData[field])[0] ?? null;
  }
  return args.item?.[`${field}Id`] ?? null;
}

export async function validatePortalShare(args: any) {
  const firmId = activeFirmId(args.context.session);
  const userId = args.context.session?.itemId;
  if (!firmId || !userId || (args.context.session?.authenticationType && args.context.session.authenticationType !== "human")) {
    args.addValidationError("A current human portal actor in an active firm is required."); return;
  }
  if (args.item?.id) {
    const relations = ["matter", "portalAccount", "matterAccess", "contact", "grantedBy", "document", "documentVersion", "invoice", "communicationThread"];
    const relationChanged = relations.some((name) => args.resolvedData?.[name] !== undefined &&
      portalShareRelationId(args, name) !== (args.item[`${name}Id`] ?? null));
    const scalarChanged = ["resourceType", "grantVersion", "policyRevision", "grantedAt", "expiresAt"].some((name) => {
      if (!args.resolvedData?.[name] !== undefined) return false;
      const original = args.item[name]; const proposed = args.resolvedData[name];
      if (["grantedAt", "expiresAt"].includes(name)) {
        return (original ? new Date(original).getTime() : null) !== (proposed ? new Date(proposed).getTime() : null);
      }
      return original !== proposed;
    });
    if (relationChanged || scalarChanged) {
      args.addValidationError("Portal share disclosure anchors are immutable; revoke and review a new share."); return;
    }
  }
  const matterId = portalShareRelationId(args, "matter");
  const portalAccountId = portalShareRelationId(args, "portalAccount");
  const matterAccessId = portalShareRelationId(args, "matterAccess");
  const type = portalResourceTypes.safeParse(args.resolvedData?.resourceType ?? args.item?.resourceType);
  const names = ["document", "documentVersion", "invoice", "communicationThread"] as const;
  const fields = { document: "document", document_version: "documentVersion", invoice: "invoice", communication_thread: "communicationThread" } as const;
  const selected = names.filter((field) => portalShareRelationId(args, field));
  if (!type.success || selected.length !== 1 || selected[0] !== fields[type.data]) {
    args.addValidationError("Portal share resource type must match exactly one linked resource."); return;
  }
  if (!matterId || !portalAccountId || !matterAccessId) {
    args.addValidationError("Portal share requires a current matching portal matter grant."); return;
  }
  const prisma = prismaWithoutGraphQLErrorConversion(args.context.prisma) as any;
  try {
    const staffPermission = { document: "canReadDocuments", document_version: "canReadDocuments", invoice: "canReadBilling", communication_thread: "canReadCommunications" } as const;
    await assertCurrentPortalActor(prisma, firmId, userId, ["canManagePortal", "canReadPortal", "canReadMatters", staffPermission[type.data]]);
    const access = await prisma.portalMatterAccess.findFirst({
      where: { id: matterAccessId, firmId, matterId, portalAccountId, status: "active" },
      select: portalShareHeaderSelect.matterAccess.select,
    });
    if (!access || !await policyGrantIsCurrent(prisma, access)) throw new Error("unavailable");
    await assertPortalMatterScope(prisma, firmId, matterId, userId);
    const account = await prisma.portalAccount.findFirst({ where: { id: portalAccountId, firmId, status: "active", firm: { status: "active" },
      contact: { firmId, status: { not: "archived" } } }, select: { id: true, contactId: true } });
    if (!account) throw new Error("unavailable");
    const field = fields[type.data];
    const resourceId = portalShareRelationId(args, field);
    const resource = await prisma[field].findFirst({ where: { id: resourceId, firmId }, select: portalShareHeaderSelect[field].select });
    const effective = (name: string) => args.resolvedData?.[name] !== undefined ? args.resolvedData[name] : args.item?.[name];
    const value = {
      id: args.item?.id ?? "new-share", firmId, matterId, portalAccountId, matterAccessId,
      status: effective("status") ?? "active",
      grantedById: portalShareRelationId(args, "grantedBy") ?? userId,
      grantVersion: effective("grantVersion") ?? 0, policyRevision: effective("policyRevision") ?? 0,
      contactId: portalShareRelationId(args, "contact"),
      grantedAt: new Date(effective("grantedAt") ?? Date.now()),
      expiresAt: effective("expiresAt") ? new Date(effective("expiresAt")) : null,
      resourceType: type.data, matter: { id: matterId, firmId }, matterAccess: access,
      documentId: null, documentVersionId: null, invoiceId: null, communicationThreadId: null,
      document: null, documentVersion: null, invoice: null, communicationThread: null,
      [field]: resource, [`${field}Id`]: resourceId,
    };
    const identity = { firmId, portalAccountId, contactId: account.contactId };
    const bound = boundPortalShare(value, identity);
    if (!bound || !await portalShareIsCurrent(prisma, bound)) throw new Error("unavailable");
    // Read only a scoped identity to enforce document disclosure/invoice/thread
    // purpose as well as tuple consistency, without loading private payloads.
    const predicate = boundPortalShareWhere(bound, identity, new Date());
    const linkedWhere = { document: predicate.document, documentVersion: predicate.documentVersion,
      invoice: predicate.invoice, communicationThread: predicate.communicationThread }[field];
    if (!await prisma[field].findFirst({ where: linkedWhere, select: { id: true } })) throw new Error("unavailable");
  } catch {
    args.addValidationError("Portal share requires a current matching portal matter grant and exact resource scope.");
  }
}

const portalShareHooks = {
  ...basePortalShareHooks,
  validate: {
    create: async (args: any) => {
      await basePortalShareHooks.validate.create(args);
      await validatePortalShare(args);
    },
    update: async (args: any) => {
      await basePortalShareHooks.validate.update(args);
      await validatePortalShare(args);
    },
  },
};

export const PortalAccount = list({
  db: uniqueConstraints(["firmId", "email"]),
  access: portalAccountEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "portalAccount", controlledStatus: true }),
  ui: { listView: { initialColumns: ["contact", "email", "status", "invitedAt", "lastLoginAt"] } },
  fields: {
    firm: firmRelationship(),
    contact: requiredRelationship("Contact"),
    user: relationship({ ref: "User" }),
    email: text({ access: portalPiiAccess, validation: { isRequired: true }, isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "invited",
      validation: { isRequired: true },
    }),
    inviteTokenDigest: text({
      isIndexed: "unique",
      defaultValue: null,
      db: { isNullable: true },
      graphql: { omit: { read: true } },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    inviteTokenPrefix: text({ isIndexed: true }),
    resetTokenDigest: secretText("Reset token digest"),
    inviteExpiresAt: timestamp(),
    resetExpiresAt: timestamp(),
    invitedAt: timestamp(),
    acceptedAt: timestamp(),
    lastLoginAt: timestamp(),
    suspendedAt: timestamp(),
    closedAt: timestamp(),
    matterAccesses: relationship({ ref: "PortalMatterAccess.portalAccount", many: true }),
    shares: relationship({ ref: "PortalShare.portalAccount", many: true }),
    sessions: readOnlyRelationship("PortalSession.portalAccount", true),
    ...trackingFields,
  },
});

export const PortalMatterAccess = list({
  access: portalMatterEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "portalMatterAccess", controlledStatus: true }),
  ui: { listView: { initialColumns: ["portalAccount", "matter", "status", "grantedBy", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    portalAccount: requiredRelationship("PortalAccount.matterAccesses"),
    // Zero marks pre-policy legacy evidence; never automatically infer approval.
    policyRevision: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    version: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    contact: relationship({ ref: "Contact" }),
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
    canReadDocuments: checkbox({ defaultValue: false }),
    canUploadDocuments: checkbox({ defaultValue: false }),
    canReadInvoices: checkbox({ defaultValue: false }),
    canReadMessages: checkbox({ defaultValue: false }),
    grantedBy: requiredRelationship("User"),
    grantedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    expiresAt: timestamp(),
    revokedBy: relationship({ ref: "User" }),
    revokedAt: timestamp(),
    revocationReason: text({ access: portalPiiAccess }),
    shares: relationship({ ref: "PortalShare.matterAccess", many: true }),
    ...trackingFields,
  },
});

export const PortalShare = list({
  access: portalMatterEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: portalShareHooks,
  ui: { listView: { initialColumns: ["portalAccount", "matter", "resourceType", "status", "expiresAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    portalAccount: requiredRelationship("PortalAccount.shares"),
    matterAccess: requiredRelationship("PortalMatterAccess.shares"),
    // Immutable disclosure anchors for new shares. Zero/null retain legacy
    // evidence; never backfill a policy approval or contact identity.
    grantVersion: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    policyRevision: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    contact: relationship({ ref: "Contact" }),
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
    resourceType: select({
      type: "enum",
      options: [
        { label: "Document", value: "document" },
        { label: "Document version", value: "document_version" },
        { label: "Invoice", value: "invoice" },
        { label: "Communication thread", value: "communication_thread" },
      ],
      validation: { isRequired: true },
    }),
    document: relationship({ ref: "Document" }),
    documentVersion: relationship({ ref: "DocumentVersion" }),
    invoice: relationship({ ref: "Invoice" }),
    communicationThread: relationship({ ref: "CommunicationThread" }),
    grantedBy: requiredRelationship("User"),
    grantedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    expiresAt: timestamp(),
    revokedBy: relationship({ ref: "User" }),
    revokedAt: timestamp(),
    ...trackingFields,
  },
});

export const PortalSession = list({
  access: portalAccountEvidenceAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["portalAccount", "status", "expiresAt", "lastUsedAt"] },
  },
  fields: {
    firm: firmRelationship(),
    portalAccount: requiredRelationship("PortalAccount.sessions"),
    tokenDigest: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      graphql: { omit: { read: true } },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    tokenPrefix: text({ isIndexed: true, validation: { isRequired: true } }),
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
    expiresAt: timestamp({ validation: { isRequired: true } }),
    lastUsedAt: timestamp(),
    revokedAt: timestamp(),
    ...trackingFields,
  },
});
