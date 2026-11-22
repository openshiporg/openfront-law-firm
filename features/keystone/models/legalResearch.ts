/* Retrieved legal authority and cited research. A LegalSource is an official statute,
 * regulation or judgment read from its publisher onto one matter; its text is stored as
 * numbered paragraphs whose anchors follow the official numbering. Research notes cite
 * those paragraphs by id. Records are written only by the attach/save commands, which
 * retrieve from the official source and check every citation. */
import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import { firmRelationship, readOnlyRelationship, requiredRelationship, systemEvidenceGraphql, uniqueConstraints } from "./fields";
import { trackingFields } from "./trackingFields";

const canRead = ({ session }: any) => permissions.canReadDocuments({ session }) || permissions.canManageDocuments({ session });

const commandOnlyAccess = {
  operation: { query: canRead, create: denyAll, update: denyAll, delete: denyAll },
  filter: { query: rules.canReadDocumentRecord, update: () => false, delete: () => false },
};

const ui = { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" as const } };

export const LegalSource = list({
  db: uniqueConstraints(["matterId", "provider", "externalId", "contentSha256"]),
  access: commandOnlyAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { ...ui, listView: { initialColumns: ["citation", "kind", "matter", "retrievedAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    provider: select({
      type: "enum",
      options: [
        { label: "Maine Revised Statutes (Maine Legislature)", value: "maine_statutes" },
        { label: "eCFR (Office of the Federal Register)", value: "ecfr" },
        { label: "Maine Law Court (Maine Judicial Branch)", value: "maine_law_court" },
        { label: "CourtListener (Free Law Project)", value: "courtlistener" },
      ],
      validation: { isRequired: true },
    }),
    kind: select({
      type: "enum",
      options: [
        { label: "Statute", value: "statute" },
        { label: "Regulation", value: "regulation" },
        { label: "Judgment", value: "judgment" },
      ],
      validation: { isRequired: true },
    }),
    externalId: text({ validation: { isRequired: true } }),
    jurisdiction: text({ validation: { isRequired: true } }),
    citation: text({ validation: { isRequired: true } }),
    title: text({ validation: { isRequired: true } }),
    court: text(),
    decidedOn: text(),
    sourceAsOf: text(),
    officialUrl: text({ validation: { isRequired: true } }),
    sourceStatus: text(),
    contentSha256: text({ validation: { isRequired: true } }),
    paragraphCount: integer({ validation: { isRequired: true, min: 1 } }),
    retrievedAt: timestamp({ validation: { isRequired: true } }),
    retrievedBy: relationship({ ref: "User" }),
    paragraphs: readOnlyRelationship("LegalSourceParagraph.source", true),
    ...trackingFields,
  },
});

export const LegalSourceParagraph = list({
  db: uniqueConstraints(["sourceId", "anchor"]),
  access: commandOnlyAccess,
  graphql: { ...systemEvidenceGraphql, maxTake: 1000 },
  hooks: firmOwnedHooks(),
  ui: { ...ui, listView: { initialColumns: ["label", "source", "position"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    source: requiredRelationship("LegalSource.paragraphs"),
    position: integer({ validation: { isRequired: true, min: 0 } }),
    anchor: text({ validation: { isRequired: true } }),
    label: text({ validation: { isRequired: true } }),
    text: text({ validation: { isRequired: true }, db: { nativeType: "Text" }, ui: { displayMode: "textarea" } }),
    textSha256: text({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});

export const ResearchNote = list({
  access: commandOnlyAccess,
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { ...ui, listView: { initialColumns: ["title", "matter", "author", "updatedAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    title: text({ validation: { isRequired: true } }),
    body: text({ validation: { isRequired: true }, db: { nativeType: "Text" }, ui: { displayMode: "textarea" } }),
    author: relationship({ ref: "User" }),
    citedParagraphs: relationship({ ref: "LegalSourceParagraph", many: true }),
    claimCount: integer({ validation: { isRequired: true, min: 0 } }),
    supportedCount: integer({ validation: { isRequired: true, min: 0 } }),
    revision: integer({ validation: { isRequired: true, min: 1 }, defaultValue: 1 }),
    removedCitations: json({ ui: { itemView: { fieldMode: "read" } } }),
    ...trackingFields,
  },
});
