import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { activeFirmId, isSignedIn, permissions } from "../access";
import { activeFirmRelationshipHooks, denyAll, firmOwnedHooks } from "../tenancy";
import { readOnlyRelationship, requireRelationshipPrismaField, scopedAccess, uniqueConstraints } from "./fields";
import { trackingFields } from "./trackingFields";
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from "../../shared/store-logo";
import { sanitizeStoreLogoSvg } from "../../shared/sanitize-store-logo";

export const Firm = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageFirm,
      update: permissions.canManageFirm,
      delete: denyAll,
    },
    filter: {
      query: ({ session }) => {
        const id = activeFirmId(session);
        return id ? { id: { equals: id } } : false;
      },
      update: ({ session }) => {
        const id = activeFirmId(session);
        return id ? { id: { equals: id } } : false;
      },
      delete: () => false,
    },
  },
  hooks: activeFirmRelationshipHooks({ lifecycle: "firm" }),
  ui: { listView: { initialColumns: ["name", "slug", "status", "defaultTimezone"] } },
  fields: {
    isDemo: checkbox({ defaultValue: false, access: { create: denyAll, update: denyAll } }),
    name: text({ validation: { isRequired: true } }),
    displayName: text({ validation: { length: { min: 2, max: 120 } } }),
    shortName: text({ validation: { length: { min: 2, max: 40 } } }),
    brandTagline: text({ validation: { length: { max: 180 } } }),
    brandColor: text({
      validation: { match: { regex: /^(?:#[0-9a-f]{6})?$/i, explanation: "Use a six-digit hexadecimal color, or leave it blank for neutral." } },
    }),
    supportEmail: text({ validation: { length: { max: 320 } } }),
    logoIcon: text({
      defaultValue: DEFAULT_STORE_LOGO_ICON,
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
        if (resolvedData[fieldKey] === undefined) return undefined;
        const safe = sanitizeStoreLogoSvg(String(resolvedData[fieldKey] || DEFAULT_STORE_LOGO_ICON));
        if (!safe) throw new Error("Logo must be a safe SVG document.");
        return safe;
      } },
    }),
    logoColor: text({ defaultValue: "0", hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === undefined ? undefined : normalizeStoreLogoColor(resolvedData[fieldKey]) } }),
    slug: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Onboarding", value: "onboarding" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "onboarding",
      validation: { isRequired: true },
    }),
    defaultTimezone: text({ defaultValue: "UTC", validation: { isRequired: true } }),
    defaultCurrency: text({
      defaultValue: "USD",
      validation: {
        isRequired: true,
        match: { regex: /^[A-Z]{3}$/, explanation: "Use a three-letter uppercase currency code." },
      },
    }),
    // Inverse writes such as `roles: { set: [] }` would detach children without their
    // own hooks running; offices and roles are created and changed from their own lists.
    offices: readOnlyRelationship("Office.firm", true),
    memberships: readOnlyRelationship("FirmMembership.firm", true),
    activeUsers: readOnlyRelationship("User.activeFirm", true),
    roles: readOnlyRelationship("Role.firm", true),
    ...trackingFields,
  },
});

export const Office = list({
  db: uniqueConstraints(["firmId", "code"]),
  access: scopedAccess("canReadPeople", "canManageFirm"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "code", "status", "timezone"] } },
  fields: {
    firm: relationship({
      ref: "Firm.offices",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { create: denyAll, update: denyAll },
    }),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    timezone: text({ defaultValue: "UTC", validation: { isRequired: true } }),
    email: text({ access: { read: permissions.canReadPeople } }),
    phone: text({ access: { read: permissions.canReadPeople } }),
    primaryMemberships: readOnlyRelationship("FirmMembership.primaryOffice", true),
    allowedMemberships: readOnlyRelationship("FirmMembership.allowedOffices", true),
    ...trackingFields,
  },
});

export const FirmMembership = list({
  db: uniqueConstraints(["firmId", "userId"]),
  graphql: { omit: { create: true, update: true, delete: true } },
  access: {
    operation: {
      query: isSignedIn,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: ({ session }) => {
        const firmId = activeFirmId(session);
        if (!firmId || !session?.itemId) return false;
        const firm = { firm: { id: { equals: firmId } } };
        return permissions.canReadPeople({ session })
          ? firm
          : { AND: [firm, { user: { id: { equals: session.itemId } } }] };
      },
      update: ({ session }) => {
        const firmId = activeFirmId(session);
        return firmId ? { firm: { id: { equals: firmId } } } : false;
      },
      delete: () => false,
    },
  },
  hooks: firmOwnedHooks({ lifecycle: "membership" }),
  ui: { listView: { initialColumns: ["user", "firm", "status", "primaryOffice", "role"] } },
  fields: {
    firm: relationship({
      ref: "Firm.memberships",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: { create: denyAll, update: denyAll },
    }),
    user: relationship({
      ref: "User.firmMemberships",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
    }),
    role: relationship({
      ref: "Role.memberships",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
    }),
    primaryOffice: relationship({ ref: "Office.primaryMemberships" }),
    allowedOffices: relationship({ ref: "Office.allowedMemberships", many: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Ended", value: "ended" },
      ],
      defaultValue: "invited",
      validation: { isRequired: true },
    }),
    title: text(),
    startedAt: timestamp(),
    endedAt: timestamp(),
    ...trackingFields,
  },
});
