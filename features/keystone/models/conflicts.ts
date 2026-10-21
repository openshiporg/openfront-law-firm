import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
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
  systemEvidenceGraphql,
  requiredRelationship,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const canReadConflicts = ({ session }: any) =>
  permissions.canReadIntake({ session }) ||
  permissions.canRunConflictChecks({ session }) ||
  permissions.canResolveConflicts({ session });

const canCreateConflictChecks = ({ session }: any) =>
  permissions.canRunConflictChecks({ session });

const canResolveConflicts = ({ session }: any) =>
  permissions.canResolveConflicts({ session });

const conflictAccess = {
  operation: {
    query: canReadConflicts,
    create: canCreateConflictChecks,
    update: denyAll,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadConflictRecord,
    update: () => false,
    delete: rules.canResolveConflictRecord,
  },
};

const conflictEvidenceAccess = {
  read: canReadConflicts,
  create: canCreateConflictChecks,
  update: canResolveConflicts,
};

const withheldConflictNarrative = {
  read: denyAll,
};

function immutableConflictInputAccess(query: (args: any) => any) {
  return {
    operation: {
      query: canReadConflicts,
      create: canCreateConflictChecks,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query,
      update: () => false,
      delete: () => false,
    },
  };
}

export const ConflictCheck = list({
  db: uniqueConstraints(["firmId", "checkNumber"]),
  access: conflictAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "conflictCheck", controlledStatus: true }),
  ui: { listView: { initialColumns: ["checkNumber", "status", "intake", "requestedBy", "completedAt"] } },
  fields: {
    firm: firmRelationship(),
    checkNumber: text({ isIndexed: true, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Running", value: "running" },
        { label: "Review required", value: "review_required" },
        { label: "Cleared", value: "cleared" },
        { label: "Conflict found", value: "conflict_found" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
    }),
    intake: relationship({ ref: "Intake.conflictChecks" }),
    matter: relationship({ ref: "Matter.conflictChecks" }),
    requestedBy: requiredRelationship("User"),
    reviewedBy: relationship({ ref: "User" }),
    searchScope: select({
      type: "enum",
      options: [
        { label: "Active firm", value: "active_firm" },
        { label: "Contacts", value: "contacts" },
        { label: "Matters", value: "matters" },
        { label: "Contacts and matters", value: "contacts_and_matters" },
      ],
      defaultValue: "contacts_and_matters",
    }),
    searchVersion: text({ defaultValue: "v1", validation: { isRequired: true } }),
    startedAt: timestamp(),
    completedAt: timestamp(),
    reviewedAt: timestamp(),
    summary: text({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    failureReason: text({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    terms: readOnlyRelationship("ConflictSearchTerm.check", true),
    matches: readOnlyRelationship("ConflictMatch.check", true),
    dispositions: readOnlyRelationship("ConflictDisposition.check", true),
    ...trackingFields,
  },
});

export const ConflictSearchTerm = list({
  access: immutableConflictInputAccess(rules.canReadConflictTerm),
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["check", "term", "termType", "sourceContact"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    check: requiredRelationship("ConflictCheck.terms"),
    term: text({ access: conflictEvidenceAccess, validation: { isRequired: true } }),
    normalizedTerm: text({ access: conflictEvidenceAccess, validation: { isRequired: true }, isIndexed: true }),
    termType: select({
      type: "enum",
      options: [
        { label: "Person", value: "person" },
        { label: "Organization", value: "organization" },
        { label: "Alias", value: "alias" },
        { label: "Matter", value: "matter" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    sourceContact: relationship({ ref: "Contact" }),
    includeAliases: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
});

export const ConflictMatch = list({
  access: immutableConflictInputAccess(rules.canReadConflictMatch),
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks({ lifecycle: "conflictMatch", controlledStatus: true }),
  ui: { listView: { initialColumns: ["check", "status", "matchType", "matchedContact", "matchedMatter", "score"] } },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    check: requiredRelationship("ConflictCheck.matches"),
    status: select({
      type: "enum",
      options: [
        { label: "Potential", value: "potential" },
        { label: "Reviewing", value: "reviewing" },
        { label: "Cleared", value: "cleared" },
        { label: "Escalated", value: "escalated" },
      ],
      defaultValue: "potential",
      validation: { isRequired: true },
    }),
    matchType: select({
      type: "enum",
      options: [
        { label: "Exact name", value: "exact_name" },
        { label: "Alias", value: "alias" },
        { label: "Fuzzy name", value: "fuzzy_name" },
        { label: "Related party", value: "related_party" },
        { label: "Matter text", value: "matter_text" },
        { label: "Manual", value: "manual" },
      ],
      validation: { isRequired: true },
    }),
    matchedContact: relationship({ ref: "Contact" }),
    matchedMatter: relationship({ ref: "Matter.conflictMatches" }),
    matchedMatterParty: relationship({ ref: "MatterParty.conflictMatches" }),
    score: integer({ validation: { min: 0, max: 100 } }),
    matchedValue: text({ access: { read: denyAll }, graphql: { omit: { read: true } } }),
    evidenceExcerpt: text({ access: { read: denyAll }, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    sourceType: text({ access: { read: denyAll }, graphql: { omit: { read: true } } }),
    sourceId: text({ access: { read: denyAll }, graphql: { omit: { read: true } } }),
    reviewedBy: relationship({ ref: "User" }),
    reviewedAt: timestamp(),
    dispositions: readOnlyRelationship("ConflictDisposition.match", true),
    ...trackingFields,
  },
});

export const ConflictDisposition = list({
  access: {
    operation: {
      query: canReadConflicts,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
    filter: {
      query: rules.canReadConflictDisposition,
      update: () => false,
      delete: () => false,
    },
  },
  graphql: systemEvidenceGraphql,
  hooks: firmOwnedHooks(),
  ui: {
    hideCreate: (args) => !canResolveConflicts(args),
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["check", "match", "outcome", "reviewer", "decidedAt"] },
  },
  fields: {
    firm: firmRelationship(),
    matter: relationship({ ref: "Matter" }),
    check: requiredRelationship("ConflictCheck.dispositions"),
    match: relationship({ ref: "ConflictMatch.dispositions" }),
    outcome: select({
      type: "enum",
      options: [
        { label: "Clear", value: "clear" },
        { label: "Conflict", value: "conflict" },
        { label: "More information required", value: "needs_more_information" },
        { label: "Approved exception recorded", value: "approved_exception" },
      ],
      validation: { isRequired: true },
    }),
    reviewer: requiredRelationship("User"),
    rationale: text({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    conditions: text({ access: withheldConflictNarrative, graphql: { omit: { read: true } }, ui: { displayMode: "textarea" } }),
    policyReference: text({ access: withheldConflictNarrative, graphql: { omit: { read: true } } }),
    decidedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    ...trackingFields,
  },
});
