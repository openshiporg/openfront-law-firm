import { list } from "@keystone-6/core";
import { checkbox, integer, select, text, timestamp } from "@keystone-6/core/fields";

import { isInteractiveHuman, permissions, rules, type AccessArgs } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import { firmRelationship, uniqueConstraints } from "./fields";
import { trackingFields } from "./trackingFields";

/**
 * Operator-controlled publication of the public site for a real (non-fixture)
 * firm: customer accounts, consultation booking and the firm's own privacy,
 * first-contact and About text. Nothing is published until a human firm
 * manager writes the firm's notices and explicitly publishes; notice edits bump
 * a version that each booking records as acknowledgment evidence.
 */
const humanFirmManager = (args: AccessArgs) =>
  permissions.canManageFirm(args) && isInteractiveHuman(args);

const systemManaged = { create: denyAll, update: denyAll } as const;
const hiddenOnCreate = { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } as const;

const baseHooks = firmOwnedHooks();
const MAX_NOTICE = 20000;

function nextVersion(field: "privacyNotice" | "firstContactNotice", resolvedData: any, item: any) {
  const versionKey = `${field}Version` as const;
  const changed = typeof resolvedData[field] === "string" && resolvedData[field].trim() !== (item?.[field] ?? "").trim();
  if (!changed) return;
  resolvedData[field] = resolvedData[field].trim();
  resolvedData[versionKey] = Number(item?.[versionKey] ?? 0) + 1;
}

function stampPublication(resolvedData: any, item: any, session: any) {
  if (resolvedData.status === "published" && item?.status !== "published") {
    resolvedData.publishedAt = new Date();
    resolvedData.publishedByUserId = String(session?.itemId ?? "");
  }
}

function validatePublication(args: any) {
  const value = (key: string) => (args.resolvedData?.[key] !== undefined ? args.resolvedData[key] : args.item?.[key]);
  const status = value("status");
  const accounts = Boolean(value("publicAccountsEnabled"));
  const booking = Boolean(value("publicBookingEnabled"));
  for (const key of ["privacyNotice", "firstContactNotice", "aboutStatement"]) {
    const text = value(key);
    if (typeof text === "string" && text.length > MAX_NOTICE) args.addValidationError(`${key} must be ${MAX_NOTICE} characters or fewer.`);
  }
  if (booking && !accounts) args.addValidationError("Consultation booking requires customer accounts to be enabled.");
  if (status === "published" && (accounts || booking)) {
    if (!String(value("privacyNotice") ?? "").trim()) args.addValidationError("Publish the firm's privacy notice before enabling customer accounts or booking.");
    if (booking && !String(value("firstContactNotice") ?? "").trim()) args.addValidationError("Publish the firm's first-contact notice before enabling consultation booking.");
  }
}

export const PublicSitePolicy = list({
  db: uniqueConstraints(["firmId"]),
  access: {
    operation: { query: permissions.canManageFirm, create: humanFirmManager, update: humanFirmManager, delete: denyAll },
    filter: { query: rules.activeFirmOwned, update: rules.activeFirmOwned, delete: () => false },
  },
  hooks: {
    ...baseHooks,
    resolveInput: {
      create: (args: any) => {
        const data: any = baseHooks.resolveInput.create(args);
        nextVersion("privacyNotice", data, null);
        nextVersion("firstContactNotice", data, null);
        stampPublication(data, null, args.context.session);
        return data;
      },
      update: ({ resolvedData, item, context }: any) => {
        nextVersion("privacyNotice", resolvedData, item);
        nextVersion("firstContactNotice", resolvedData, item);
        stampPublication(resolvedData, item, context.session);
        return resolvedData;
      },
    },
    validate: {
      create: async (args: any) => {
        await baseHooks.validate.create(args);
        validatePublication(args);
      },
      update: async (args: any) => {
        await baseHooks.validate.update(args);
        validatePublication(args);
      },
    },
  },
  ui: {
    hideDelete: true,
    listView: { initialColumns: ["status", "publicAccountsEnabled", "publicBookingEnabled", "publishedAt"] },
  },
  fields: {
    firm: firmRelationship(),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    publicAccountsEnabled: checkbox({ defaultValue: false }),
    publicBookingEnabled: checkbox({ defaultValue: false }),
    privacyNotice: text({ ui: { displayMode: "textarea", description: "The firm's own privacy notice, shown at /privacy and linked before any customer collection." } }),
    privacyNoticeVersion: integer({ defaultValue: 0, access: systemManaged, ui: hiddenOnCreate }),
    firstContactNotice: text({ ui: { displayMode: "textarea", description: "Shown before a prospective client enters any details; each booking records the version acknowledged." } }),
    firstContactNoticeVersion: integer({ defaultValue: 0, access: systemManaged, ui: hiddenOnCreate }),
    aboutStatement: text({ ui: { displayMode: "textarea", description: "Firm-approved About text for the public site." } }),
    publishedAt: timestamp({ access: systemManaged, ui: hiddenOnCreate }),
    publishedByUserId: text({ access: systemManaged, ui: hiddenOnCreate }),
    ...trackingFields,
  },
});
