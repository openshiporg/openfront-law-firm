import { graphql, list } from "@keystone-6/core";
import {
  checkbox,
  json,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import { firmRelationship, readOnlyRelationship, scopedAccess } from "./fields";
import { trackingFields } from "./trackingFields";

const piiRead = ({ session }: any) => permissions.canReadPeople({ session });
const piiWrite = ({ session }: any) => permissions.canManagePeople({ session });
const piiAccess = { read: piiRead, create: piiWrite, update: piiWrite };

export const Contact = list({
  access: scopedAccess("canReadPeople", "canManagePeople"),
  hooks: firmOwnedHooks(),
  ui: {
    labelField: "displayName",
    listView: { initialColumns: ["displayName", "contactType", "status", "primaryEmail"] },
  },
  fields: {
    firm: firmRelationship(),
    contactType: select({
      type: "enum",
      options: [
        { label: "Person", value: "person" },
        { label: "Organization", value: "organization" },
      ],
      defaultValue: "person",
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Prospective client", value: "prospective_client" },
        { label: "Client", value: "client" },
        { label: "Former client", value: "former_client" },
        { label: "Opposing", value: "opposing" },
        { label: "Other", value: "other" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "prospective_client",
      validation: { isRequired: true },
    }),
    firstName: text({ access: piiAccess }),
    middleName: text({ access: piiAccess }),
    lastName: text({ access: piiAccess }),
    organizationName: text({ access: piiAccess }),
    preferredName: text({ access: piiAccess }),
    primaryEmail: text({ access: piiAccess }),
    primaryPhone: text({ access: piiAccess }),
    dateOfBirth: timestamp({ access: piiAccess }),
    governmentIdLastFour: text({
      access: piiAccess,
      validation: {
        length: { min: 4, max: 4 },
        match: { regex: /^\d{4}$/, explanation: "Use only the final four digits." },
      },
    }),
    conflictSearchAliases: json({
      access: piiAccess,
      defaultValue: [],
      ui: { description: "Bounded alternate names for conflict searching; never credentials or full identity documents." },
    }),
    privilegedNotes: text({
      access: { read: denyAll, create: denyAll, update: denyAll },
      graphql: { omit: { read: true, create: true, update: true } },
      ui: {
        itemView: { fieldMode: "hidden" },
        createView: { fieldMode: "hidden" },
        description: "Matter-specific privileged content belongs on an authorized matter record, never a firm-wide contact.",
      },
    }),
    addresses: readOnlyRelationship("Address.contact", true),
    contactMethods: readOnlyRelationship("ContactMethod.contact", true),
    displayName: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item) {
          if (item.contactType === "organization") return String(item.organizationName || "Organization");
          return [item.firstName, item.middleName, item.lastName].filter(Boolean).join(" ") || "Unnamed contact";
        },
      }),
    }),
    ...trackingFields,
  },
});

export const Address = list({
  access: scopedAccess("canReadPeople", "canManagePeople"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["label", "contact", "city", "region", "postalCode"] } },
  fields: {
    firm: firmRelationship(),
    contact: relationship({ ref: "Contact.addresses" }),
    label: text({ defaultValue: "Primary" }),
    addressType: select({
      type: "enum",
      options: [
        { label: "Home", value: "home" },
        { label: "Work", value: "work" },
        { label: "Billing", value: "billing" },
        { label: "Mailing", value: "mailing" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "mailing",
    }),
    line1: text({ access: piiAccess }),
    line2: text({ access: piiAccess }),
    city: text({ access: piiAccess }),
    region: text({ access: piiAccess }),
    postalCode: text({ access: piiAccess }),
    countryCode: text({
      access: piiAccess,
      defaultValue: "US",
      validation: { match: { regex: /^[A-Z]{2}$/, explanation: "Use a two-letter uppercase country code." } },
    }),
    isPrimary: checkbox({ defaultValue: false }),
    ...trackingFields,
  },
});

export const ContactMethod = list({
  access: scopedAccess("canReadPeople", "canManagePeople"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["contact", "methodType", "label", "value", "isPrimary"] } },
  fields: {
    firm: firmRelationship(),
    contact: relationship({ ref: "Contact.contactMethods" }),
    methodType: select({
      type: "enum",
      options: [
        { label: "Email", value: "email" },
        { label: "Phone", value: "phone" },
        { label: "Secure portal", value: "portal" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    label: text(),
    value: text({ access: piiAccess, validation: { isRequired: true } }),
    isPrimary: checkbox({ defaultValue: false }),
    canContact: checkbox({ defaultValue: true }),
    verifiedAt: timestamp(),
    ...trackingFields,
  },
});
