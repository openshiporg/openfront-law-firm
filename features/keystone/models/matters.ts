import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import { validateMatterTeamCapability } from "../lib/team-capability";
import {
  firmRelationship,
  readOnlyRelationship,
  requiredRelationship,
  requireRelationshipPrismaField,
  scopedAccess,
  systemEvidenceGraphql,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const matterAccess = {
  operation: {
    query: permissions.canReadMatters,
    create: permissions.canManageMatters,
    update: permissions.canManageMatters,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadMatter,
    update: rules.canManageMatter,
    delete: rules.canManageMatter,
  },
};

const matterRecordAccess = {
  operation: {
    query: permissions.canReadMatters,
    create: permissions.canManageMatters,
    update: permissions.canManageMatters,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadMatterRecord,
    update: rules.canManageMatterRecord,
    delete: rules.canManageMatterRecord,
  },
};

const privilegedFieldAccess = {
  read: ({ session }: any) => permissions.canReadMatters({ session }),
  create: ({ session }: any) => permissions.canManageMatters({ session }),
  update: ({ session }: any) => permissions.canManageMatters({ session }),
};

const controlledConfidentialityAccess = {
  read: ({ session }: any) => permissions.canReadMatters({ session }),
  create: ({ session }: any) => permissions.canManageMatters({ session }),
  update: denyAll,
};

const practiceAreaHooks = firmOwnedHooks();
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalized public handle: lowercase letters, digits and single hyphens. */
export function normalizePublicSlug(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "") || null;
}

export const PracticeArea = list({
  // Published services resolve by an explicit firm-unique public slug, never by
  // a lowercased internal code (codes may be empty, contain "/", or differ only by case).
  db: uniqueConstraints(["firmId", "code"], ["firmId", "publicSlug"]),
  access: scopedAccess("canReadMatters", "canManageMatters"),
  hooks: {
    ...practiceAreaHooks,
    resolveInput: {
      create: (args: any) => {
        const data = practiceAreaHooks.resolveInput.create(args);
        if (typeof data.publicSlug === "string") data.publicSlug = normalizePublicSlug(data.publicSlug);
        if (data.isPublic && !data.publicSlug) data.publicSlug = normalizePublicSlug(data.code) ?? normalizePublicSlug(data.name);
        return data;
      },
      update: ({ resolvedData, item }: any) => {
        if (typeof resolvedData.publicSlug === "string") resolvedData.publicSlug = normalizePublicSlug(resolvedData.publicSlug);
        const isPublic = resolvedData.isPublic ?? item.isPublic;
        if (isPublic && !(resolvedData.publicSlug ?? item.publicSlug)) {
          resolvedData.publicSlug = normalizePublicSlug(resolvedData.code ?? item.code) ?? normalizePublicSlug(resolvedData.name ?? item.name);
        }
        return resolvedData;
      },
    },
    validate: {
      create: async (args: any) => {
        await practiceAreaHooks.validate.create(args);
        validatePublicSlug(args);
      },
      update: async (args: any) => {
        await practiceAreaHooks.validate.update(args);
        validatePublicSlug(args);
      },
    },
  },
  ui: { listView: { initialColumns: ["name", "code", "publicSlug", "isPublic", "status"] } },
  fields: {
    firm: firmRelationship(),
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
    }),
    description: text({ ui: { displayMode: "textarea" } }),
    isPublic: checkbox({ defaultValue: false }),
    publicSlug: text({
      isIndexed: true,
      defaultValue: null,
      db: { isNullable: true },
      ui: { description: "Public URL handle for a published service, e.g. business-contracts. Derived from the code when left empty." },
    }),
    consultationFeeMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 2147483647 } }),
    consultationMinutes: integer({ defaultValue: 30, validation: { isRequired: true, min: 15, max: 120 } }),
    // Read-only inverse: `matters: { set: [] }` would unlink hidden matters without
    // Matter's own access or hooks; matters choose their practice area themselves.
    matters: readOnlyRelationship("Matter.practiceArea", true),
    ...trackingFields,
  },
});

function validatePublicSlug(args: any) {
  const isPublic = args.resolvedData?.isPublic ?? args.item?.isPublic;
  const slug = args.resolvedData?.publicSlug !== undefined ? args.resolvedData.publicSlug : args.item?.publicSlug;
  if (slug && (slug.length > 80 || !PUBLIC_SLUG_PATTERN.test(slug))) args.addValidationError("Public slug must use lowercase letters, numbers and single hyphens.");
  if (isPublic && !slug) args.addValidationError("A published service needs a public slug.");
}

const baseMatterHooks = firmOwnedHooks({ lifecycle: "matter", controlledStatus: true });
const matterHooks = {
  ...baseMatterHooks,
  validate: {
    ...baseMatterHooks.validate,
    update: async (args: any) => {
      await baseMatterHooks.validate.update(args);
      await validateMatterTeamCapability(args, "canEdit");
    },
  },
};

export const Matter = list({
  db: uniqueConstraints(["firmId", "matterNumber"]),
  access: matterAccess,
  hooks: matterHooks,
  ui: {
    listView: { initialColumns: ["matterNumber", "title", "status", "confidentiality", "client", "responsibleAttorney"] },
  },
  fields: {
    firm: firmRelationship(),
    matterNumber: text({ isIndexed: true, access: controlledConfidentialityAccess, graphql: { omit: { update: true } }, validation: { isRequired: true } }),
    title: text({ access: privilegedFieldAccess, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      access: controlledConfidentialityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "Proposed", value: "proposed" },
        { label: "Pending conflict", value: "pending_conflict" },
        { label: "Open", value: "open" },
        { label: "On hold", value: "on_hold" },
        { label: "Closing", value: "closing" },
        { label: "Closed", value: "closed" },
        { label: "Declined", value: "declined" },
      ],
      defaultValue: "proposed",
      validation: { isRequired: true },
    }),
    confidentiality: select({
      access: controlledConfidentialityAccess,
      ui: { itemView: { fieldMode: 'read' } },
      type: "enum",
      options: [
        { label: "Standard", value: "standard" },
        { label: "Restricted", value: "restricted" },
      ],
      defaultValue: "standard",
      validation: { isRequired: true },
    }),
    client: relationship({
      ref: "Contact",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: controlledConfidentialityAccess,
      graphql: { omit: { update: true } },
    }),
    office: relationship({ ref: "Office" }),
    practiceArea: relationship({ ref: "PracticeArea.matters" }),
    intake: readOnlyRelationship("Intake.convertedMatter"),
    responsibleAttorney: relationship({ ref: "User" }),
    originatingAttorney: relationship({ ref: "User" }),
    description: text({ access: privilegedFieldAccess, ui: { displayMode: "textarea" } }),
    billingType: select({
      type: "enum",
      options: [
        { label: "Hourly", value: "hourly" },
        { label: "Flat fee", value: "flat_fee" },
        { label: "Contingency", value: "contingency" },
        { label: "Pro bono", value: "pro_bono" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "hourly",
    }),
    openedAt: timestamp({ access: controlledConfidentialityAccess, graphql: { omit: { update: true } } }),
    closedAt: timestamp({ access: controlledConfidentialityAccess, graphql: { omit: { update: true } } }),
    closureReason: text({ access: controlledConfidentialityAccess, graphql: { omit: { update: true } }, ui: { displayMode: "textarea" } }),
    customData: json({
      access: privilegedFieldAccess,
      ui: { description: "Bounded firm-defined attributes; core relationships and financial values remain first-class fields." },
    }),
    parties: readOnlyRelationship("MatterParty.matter", true),
    teamMembers: readOnlyRelationship("MatterTeamMember.matter", true),
    authorizedUsers: relationship({
      ref: "User.authorizedMatters",
      many: true,
      access: { create: denyAll, update: denyAll },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
    }),
    blockedUsers: relationship({
      ref: "User.blockedMatters",
      many: true,
      access: {
        read: ({ session }: any) => permissions.canManageEthicalWalls({ session }),
        create: denyAll,
        update: denyAll,
      },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
    }),
    ethicalWalls: readOnlyRelationship("EthicalWall.matter", true),
    statusEvents: readOnlyRelationship("MatterStatusEvent.matter", true),
    conflictChecks: readOnlyRelationship("ConflictCheck.matter", true),
    conflictMatches: readOnlyRelationship("ConflictMatch.matchedMatter", true),
    ...trackingFields,
  },
});

export const MatterParty = list({
  access: matterRecordAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["matter", "contact", "partyRole", "side", "status"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.parties"),
    contact: requiredRelationship("Contact"),
    partyRole: select({
      type: "enum",
      options: [
        { label: "Client", value: "client" },
        { label: "Plaintiff / claimant", value: "claimant" },
        { label: "Defendant / respondent", value: "respondent" },
        { label: "Opposing party", value: "opposing_party" },
        { label: "Witness", value: "witness" },
        { label: "Expert", value: "expert" },
        { label: "Counsel", value: "counsel" },
        { label: "Judge / adjudicator", value: "adjudicator" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    side: select({
      type: "enum",
      options: [
        { label: "Our client", value: "our_client" },
        { label: "Adverse", value: "adverse" },
        { label: "Neutral", value: "neutral" },
        { label: "Unknown", value: "unknown" },
      ],
      defaultValue: "unknown",
    }),
    representedBy: relationship({ ref: "Contact" }),
    counselContact: relationship({ ref: "Contact" }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Removed", value: "removed" },
      ],
      defaultValue: "active",
    }),
    isPrimaryClient: checkbox({ defaultValue: false }),
    notes: text({ access: privilegedFieldAccess, ui: { displayMode: "textarea" } }),
    conflictMatches: readOnlyRelationship("ConflictMatch.matchedMatterParty", true),
    ...trackingFields,
  },
});

export const MatterTeamMember = list({
  db: uniqueConstraints(["matterId", "userId"]),
  access: {
    ...matterRecordAccess,
    operation: {
      query: permissions.canReadMatters,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["matter", "user", "teamRole", "status", "canAccessRestricted"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.teamMembers"),
    user: requiredRelationship("User"),
    office: relationship({ ref: "Office" }),
    teamRole: select({
      type: "enum",
      options: [
        { label: "Responsible attorney", value: "responsible_attorney" },
        { label: "Attorney", value: "attorney" },
        { label: "Paralegal", value: "paralegal" },
        { label: "Assistant", value: "assistant" },
        { label: "Billing", value: "billing" },
        { label: "Observer", value: "observer" },
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
      validation: { isRequired: true },
    }),
    canAccessRestricted: checkbox({ defaultValue: false }),
    canEdit: checkbox({ defaultValue: false }),
    canBill: checkbox({ defaultValue: false }),
    assignedAt: timestamp({ defaultValue: { kind: "now" } }),
    removedAt: timestamp(),
    ...trackingFields,
  },
});

export const EthicalWall = list({
  access: {
    operation: {
      query: permissions.canReadMatters,
      create: permissions.canManageEthicalWalls,
      update: permissions.canManageEthicalWalls,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadEthicalWallRecord,
      update: rules.canManageEthicalWallRecord,
      delete: rules.canManageEthicalWallRecord,
    },
  },
  hooks: firmOwnedHooks({ lifecycle: "ethicalWall", controlledStatus: true }),
  ui: { listView: { initialColumns: ["name", "matter", "status", "approvedBy", "effectiveAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.ethicalWalls"),
    name: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Lifted", value: "lifted" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    reason: text({ access: privilegedFieldAccess, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    policyReference: text(),
    createdBy: relationship({
      ref: "User",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { update: denyAll },
    }),
    approvedBy: relationship({
      ref: "User",
      access: { create: denyAll, update: denyAll },
    }),
    effectiveAt: timestamp({ access: { create: denyAll, update: denyAll } }),
    liftedAt: timestamp({ access: { create: denyAll, update: denyAll } }),
    members: readOnlyRelationship("EthicalWallMember.wall", true),
    ...trackingFields,
  },
});

export const EthicalWallMember = list({
  db: uniqueConstraints(["wallId", "userId"]),
  access: {
    operation: {
      query: permissions.canReadMatters,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadEthicalWallRecord,
      update: rules.canManageEthicalWallRecord,
      delete: rules.canManageEthicalWallRecord,
    },
  },
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["wall", "matter", "user", "decision", "status"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    wall: requiredRelationship("EthicalWall.members"),
    user: requiredRelationship("User"),
    decision: select({
      type: "enum",
      options: [
        { label: "Allowed", value: "allowed" },
        { label: "Blocked", value: "blocked" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "active",
    }),
    approvedBy: requiredRelationship("User"),
    reason: text({ access: privilegedFieldAccess, validation: { isRequired: true } }),
    effectiveAt: timestamp({ defaultValue: { kind: "now" } }),
    revokedAt: timestamp(),
    ...trackingFields,
  },
});

export const MatterStatusEvent = list({
  access: {
    operation: {
      query: permissions.canReadMatters,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadMatterRecord,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    isHidden: ({ session }) => !permissions.canReadMatters({ session }),
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["matter", "fromStatus", "toStatus", "occurredAt", "actorUser"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter.statusEvents"),
    fromStatus: text(),
    toStatus: text({ validation: { isRequired: true } }),
    action: text({ validation: { isRequired: true } }),
    reason: text({ access: privilegedFieldAccess, ui: { displayMode: "textarea" } }),
    actorUser: relationship({ ref: "User" }),
    actorAgent: relationship({ ref: "AgentPrincipal" }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: json({ access: privilegedFieldAccess }),
    ...trackingFields,
  },
});
