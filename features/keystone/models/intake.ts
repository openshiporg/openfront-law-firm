import { list } from "@keystone-6/core";
import {
  integer,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import {
  firmRelationship,
  readOnlyRelationship,
  requireRelationshipPrismaField,
  requiredRelationship,
  scopedAccess,
  uniqueConstraints,
} from "./fields";
import { trackingFields } from "./trackingFields";

const intakeAccess = scopedAccess("canReadIntake", "canManageIntake");
const controlledIntakeIdentityAccess = {
  read: ({ session }: any) => permissions.canReadIntake({ session }),
  create: ({ session }: any) => permissions.canManageIntake({ session }),
  update: denyAll,
};

const sensitiveIntakeAccess = {
  read: ({ session }: any) => permissions.canReadIntake({ session }),
  create: ({ session }: any) => permissions.canManageIntake({ session }),
  update: ({ session }: any) => permissions.canManageIntake({ session }),
};

export const Intake = list({
  db: uniqueConstraints(["firmId", "intakeNumber"]),
  access: intakeAccess,
  hooks: firmOwnedHooks({ lifecycle: "intake", controlledStatus: true }),
  ui: {
    listView: { initialColumns: ["intakeNumber", "title", "status", "primaryContact", "assignedTo"] },
  },
  fields: {
    firm: firmRelationship(),
    intakeNumber: text({ isIndexed: true, access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } }, validation: { isRequired: true } }),
    title: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      access: controlledIntakeIdentityAccess,
      graphql: { omit: { update: true } },
      options: [
        { label: "New", value: "new" },
        { label: "Screening", value: "screening" },
        { label: "Conflict review", value: "conflict_review" },
        { label: "Consultation", value: "consultation" },
        { label: "Decision", value: "decision" },
        { label: "Converted", value: "converted" },
        { label: "Declined", value: "declined" },
        { label: "Withdrawn", value: "withdrawn" },
      ],
      defaultValue: "new",
      validation: { isRequired: true },
    }),
    source: select({
      type: "enum",
      options: [
        { label: "Website", value: "website" },
        { label: "Referral", value: "referral" },
        { label: "Phone", value: "phone" },
        { label: "Walk-in", value: "walk_in" },
        { label: "Import", value: "import" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "other",
    }),
    primaryContact: relationship({
      ref: "Contact",
      db: { foreignKey: true, extendPrismaSchema: requireRelationshipPrismaField },
      access: controlledIntakeIdentityAccess,
      graphql: { omit: { update: true } },
    }),
    office: relationship({ ref: "Office" }),
    practiceArea: relationship({ ref: "PracticeArea" }),
    openedBy: relationship({ ref: "User" }),
    assignedTo: relationship({ ref: "User" }),
    receivedAt: timestamp({ access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } }, defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    summary: text({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    desiredOutcome: text({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    adversePartySummary: text({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    declineReason: text({ access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } }, ui: { displayMode: "textarea" } }),
    decidedAt: timestamp({ access: controlledIntakeIdentityAccess, graphql: { omit: { update: true } } }),
    participants: readOnlyRelationship("IntakeParticipant.intake", true),
    submissions: readOnlyRelationship("IntakeSubmission.intake", true),
    consultations: readOnlyRelationship("Consultation.intake", true),
    conflictChecks: readOnlyRelationship("ConflictCheck.intake", true),
    convertedMatter: readOnlyRelationship("Matter.intake"),
    ...trackingFields,
  },
});

export const IntakeParticipant = list({
  access: intakeAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["intake", "contact", "participantRole", "status"] } },
  fields: {
    firm: firmRelationship(),
    intake: requiredRelationship("Intake.participants"),
    contact: requiredRelationship("Contact"),
    participantRole: select({
      type: "enum",
      options: [
        { label: "Prospective client", value: "prospective_client" },
        { label: "Adverse party", value: "adverse_party" },
        { label: "Related party", value: "related_party" },
        { label: "Witness", value: "witness" },
        { label: "Referrer", value: "referrer" },
        { label: "Other", value: "other" },
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
    notes: text({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    ...trackingFields,
  },
});

export const IntakeSubmission = list({
  access: intakeAccess,
  hooks: firmOwnedHooks({ lifecycle: "intakeSubmission" }),
  ui: { listView: { initialColumns: ["intake", "status", "schemaVersion", "submittedAt", "reviewedBy"] } },
  fields: {
    firm: firmRelationship(),
    intake: requiredRelationship("Intake.submissions"),
    submittedByContact: relationship({ ref: "Contact" }),
    reviewedBy: relationship({ ref: "User" }),
    status: select({
      type: "enum",
      options: [
        { label: "Submitted", value: "submitted" },
        { label: "Under review", value: "under_review" },
        { label: "Accepted", value: "accepted" },
        { label: "Superseded", value: "superseded" },
      ],
      defaultValue: "submitted",
      validation: { isRequired: true },
    }),
    schemaVersion: text({ validation: { isRequired: true } }),
    formSchema: json({ access: sensitiveIntakeAccess }),
    responses: json({
      access: {
        ...sensitiveIntakeAccess,
        update: denyAll,
      },
    }),
    submittedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    reviewedAt: timestamp(),
    reviewNotes: text({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    supersedes: relationship({ ref: "IntakeSubmission" }),
    ...trackingFields,
  },
});

export const Consultation = list({
  db: uniqueConstraints(["firmId", "requestKey"]),
  graphql: { omit: { create: true, update: true, delete: true } },
  access: { ...intakeAccess, operation: { ...intakeAccess.operation, create: denyAll, update: denyAll, delete: denyAll } },
  hooks: firmOwnedHooks({ lifecycle: "consultation" }),
  ui: { listView: { initialColumns: ["intake", "status", "startsAt", "host", "office"] } },
  fields: {
    firm: firmRelationship(),
    intake: requiredRelationship("Intake.consultations"),
    account: readOnlyRelationship("User.consultations"),
    requestKey: text({ db: { isNullable: true }, defaultValue: null, graphql: { omit: true } }),
    requestDigest: text({ graphql: { omit: true } }),
    serviceTitle: text(),
    serviceSnapshot: json({ access: { create: denyAll, update: denyAll } }),
    feeMinor: integer({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 2147483647 }, access: { create: denyAll, update: denyAll } }),
    currencyCode: text({ defaultValue: "USD", access: { create: denyAll, update: denyAll } }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Scheduled", value: "scheduled" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "No show", value: "no_show" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
    }),
    startsAt: timestamp(),
    endsAt: timestamp(),
    timezone: text({ defaultValue: "UTC", validation: { isRequired: true } }),
    office: relationship({ ref: "Office" }),
    host: relationship({ ref: "User" }),
    participants: relationship({ ref: "Contact", many: true }),
    location: text(),
    outcome: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Recommend engagement", value: "recommend_engagement" },
        { label: "Decline", value: "decline" },
        { label: "Follow up", value: "follow_up" },
      ],
      defaultValue: "pending",
    }),
    notes: text({ access: sensitiveIntakeAccess, ui: { displayMode: "textarea" } }),
    cancellationReason: text({ access: sensitiveIntakeAccess }),
    ...trackingFields,
  },
});
