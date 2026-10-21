import { list } from "@keystone-6/core";
import {
  checkbox,
  json,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { denyAll, firmOwnedHooks } from "../tenancy";
import { firmRelationship, immutableUpdateDeleteGraphql, readOnlyRelationship, requiredRelationship, scopedAccess, uniqueConstraints } from "./fields";
import { trackingFields } from "./trackingFields";

const canReadCalendar = ({ session }: any) =>
  permissions.canReadCalendar({ session }) || permissions.canReadMatters({ session });
const canManageCalendar = ({ session }: any) =>
  permissions.canManageCalendar({ session });

const matterCalendarAccess = {
  operation: {
    query: canReadCalendar,
    create: canManageCalendar,
    update: canManageCalendar,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadCalendarRecord,
    update: rules.canManageCalendarRecord,
    delete: rules.canManageCalendarRecord,
  },
};

const canReadTasks = ({ session }: any) =>
  permissions.canReadTasks({ session }) || permissions.canReadMatters({ session });
const canManageTasks = ({ session }: any) => permissions.canManageTasks({ session });

const taskAccess = {
  operation: {
    query: canReadTasks,
    create: canManageTasks,
    update: canManageTasks,
    delete: denyAll,
  },
  filter: {
    query: rules.canReadTaskRecord,
    update: rules.canManageTaskRecord,
    delete: rules.canManageTaskRecord,
  },
};

const privilegedCalendarField = {
  read: canReadCalendar,
  create: canManageCalendar,
  update: canManageCalendar,
};

const controlledCalendarField = {
  read: canReadCalendar,
  create: denyAll,
  update: denyAll,
};

const controlledTaskField = {
  read: canReadTasks,
  create: canManageTasks,
  update: denyAll,
};

export const Court = list({
  access: scopedAccess("canReadCalendar", "canManageCalendar"),
  hooks: firmOwnedHooks(),
  ui: { listView: { initialColumns: ["name", "courtType", "jurisdiction", "status"] } },
  fields: {
    firm: firmRelationship(),
    name: text({ validation: { isRequired: true } }),
    courtType: select({
      type: "enum",
      options: [
        { label: "Federal", value: "federal" },
        { label: "State / provincial", value: "state" },
        { label: "County / local", value: "local" },
        { label: "Administrative", value: "administrative" },
        { label: "Arbitration", value: "arbitration" },
        { label: "Other tribunal", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    jurisdiction: text({ validation: { isRequired: true } }),
    jurisdictionCode: text({ isIndexed: true }),
    division: text(),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      defaultValue: "active",
    }),
    address: relationship({ ref: "Address" }),
    phone: text(),
    website: text(),
    filingUrl: text(),
    dockets: readOnlyRelationship("Docket.court", true),
    ...trackingFields,
  },
});

export const Docket = list({
  db: uniqueConstraints(["matterId", "docketNumber"]),
  access: matterCalendarAccess,
  hooks: firmOwnedHooks({ lifecycle: "docket" }),
  ui: { listView: { initialColumns: ["docketNumber", "title", "status", "matter", "court"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    court: requiredRelationship("Court.dockets"),
    docketNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    title: text({ access: privilegedCalendarField, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Stayed", value: "stayed" },
        { label: "Appealed", value: "appealed" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    judgeContact: relationship({ ref: "Contact" }),
    clerkContact: relationship({ ref: "Contact" }),
    filedAt: timestamp(),
    closedAt: timestamp(),
    notes: text({ access: privilegedCalendarField, ui: { displayMode: "textarea" } }),
    entries: readOnlyRelationship("DocketEntry.docket", true),
    deadlines: readOnlyRelationship("Deadline.docket", true),
    ...trackingFields,
  },
});

export const DocketEntry = list({
  access: matterCalendarAccess,
  graphql: { omit: { create: true, update: true, delete: true } },
  hooks: firmOwnedHooks({ lifecycle: "docketEntry", controlledStatus: true }),
  ui: { listView: { initialColumns: ["title", "entryType", "status", "docket", "occurredAt"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    docket: requiredRelationship("Docket.entries"),
    title: text({ access: privilegedCalendarField, validation: { isRequired: true } }),
    entryType: select({
      type: "enum",
      options: [
        { label: "Filing", value: "filing" },
        { label: "Order", value: "order" },
        { label: "Hearing", value: "hearing" },
        { label: "Notice", value: "notice" },
        { label: "Service", value: "service" },
        { label: "Correspondence", value: "correspondence" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Filed", value: "filed" },
        { label: "Entered", value: "entered" },
        { label: "Rejected", value: "rejected" },
        { label: "Withdrawn", value: "withdrawn" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    externalEntryId: text(),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    filedAt: timestamp(),
    enteredAt: timestamp(),
    description: text({ access: privilegedCalendarField, ui: { displayMode: "textarea" } }),
    sourceUrl: text(),
    documentVersion: relationship({ ref: "DocumentVersion" }),
    isVerified: checkbox({ defaultValue: false }),
    verifiedBy: relationship({ ref: "User" }),
    verifiedAt: timestamp(),
    deadlines: readOnlyRelationship("Deadline.sourceEntry", true),
    ...trackingFields,
  },
});

const baseDeadlineHooks = firmOwnedHooks({ lifecycle: "deadline", controlledStatus: true });
const deadlineHooks = {
  ...baseDeadlineHooks,
  validate: {
    create: baseDeadlineHooks.validate.create,
    update: async (args: any) => {
      await baseDeadlineHooks.validate.update(args);
      const verifiedSnapshotFields = new Set([
        "matter", "docket", "sourceEntry", "title", "deadlineType", "dueAt", "timezone",
        "source", "calculationMethod", "ruleReference", "parentDeadline",
      ]);
      if (args.item.isVerified && Object.keys(args.resolvedData).some((field) => verifiedSnapshotFields.has(field))) {
        args.addValidationError("A verified deadline snapshot cannot be changed; create a corrected deadline with new verification evidence.");
      }
    },
  },
};

export const Deadline = list({
  access: {
    ...matterCalendarAccess,
    operation: { ...matterCalendarAccess.operation, update: denyAll },
    filter: { ...matterCalendarAccess.filter, update: () => false },
  },
  graphql: immutableUpdateDeleteGraphql,
  hooks: deadlineHooks,
  ui: { listView: { initialColumns: ["title", "status", "dueAt", "matter", "assignedTo", "isVerified"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    docket: relationship({ ref: "Docket.deadlines" }),
    sourceEntry: relationship({ ref: "DocketEntry.deadlines" }),
    title: text({ access: privilegedCalendarField, validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Pending", value: "pending" },
        { label: "Completed", value: "completed" },
        { label: "Missed", value: "missed" },
        { label: "Waived", value: "waived" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    deadlineType: select({
      type: "enum",
      options: [
        { label: "Court", value: "court" },
        { label: "Statutory", value: "statutory" },
        { label: "Contractual", value: "contractual" },
        { label: "Internal", value: "internal" },
        { label: "Limitation", value: "limitation" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    dueAt: timestamp({ validation: { isRequired: true } }),
    timezone: text({ defaultValue: "UTC", validation: { isRequired: true } }),
    source: select({
      type: "enum",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Court rule", value: "court_rule" },
        { label: "Docket integration", value: "docket_integration" },
        { label: "Agent proposed", value: "agent_proposed" },
        { label: "Imported", value: "imported" },
      ],
      defaultValue: "manual",
    }),
    calculationMethod: text({ access: privilegedCalendarField, ui: { displayMode: "textarea" } }),
    ruleReference: text(),
    isVerified: checkbox({ access: controlledCalendarField, defaultValue: false }),
    verifiedBy: relationship({ ref: "User", access: controlledCalendarField }),
    verifiedAt: timestamp({ access: controlledCalendarField }),
    assignedTo: relationship({ ref: "User" }),
    completedAt: timestamp({ access: controlledCalendarField }),
    parentDeadline: relationship({ ref: "Deadline.dependentDeadlines" }),
    dependentDeadlines: readOnlyRelationship("Deadline.parentDeadline", true),
    tasks: readOnlyRelationship("LegalTask.deadline", true),
    metadata: json({ access: privilegedCalendarField }),
    ...trackingFields,
  },
});

export const LegalTask = list({
  access: taskAccess,
  hooks: firmOwnedHooks({ lifecycle: "legalTask", controlledStatus: true }),
  ui: { listView: { initialColumns: ["title", "status", "priority", "dueAt", "matter", "assignedTo"] } },
  fields: {
    firm: firmRelationship(),
    matter: requiredRelationship("Matter"),
    deadline: relationship({ ref: "Deadline.tasks" }),
    title: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "In progress", value: "in_progress" },
        { label: "Blocked", value: "blocked" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "open",
      validation: { isRequired: true },
    }),
    priority: select({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "Normal", value: "normal" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" },
      ],
      defaultValue: "normal",
    }),
    assignedTo: relationship({ ref: "User" }),
    assignedBy: relationship({ ref: "User" }),
    dueAt: timestamp(),
    completedAt: timestamp({ access: controlledTaskField }),
    parentTask: relationship({ ref: "LegalTask.subtasks" }),
    subtasks: readOnlyRelationship("LegalTask.parentTask", true),
    dependsOn: relationship({ ref: "LegalTask.dependents", many: true }),
    dependents: relationship({ ref: "LegalTask.dependsOn", many: true }),
    blockedReason: text({ access: controlledTaskField, ui: { displayMode: "textarea" } }),
    ...trackingFields,
  },
});
