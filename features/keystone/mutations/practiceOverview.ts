import type { Context } from ".keystone/types";

import { formatMoneyLabel } from "../../platform/lib/money";
import { activeFirmId, permissions } from "../access";

export type PracticeOverviewMetric = {
  key: string;
  label: string;
  value: number;
  href: string;
};

export type PracticeOverviewQueueItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  status: string;
  at: Date | null;
  href: string;
  canAct: boolean;
};

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.valueOf()) ? null : date;
}

function displayName(contact: any) {
  return String(contact?.displayName ?? "No contact name");
}

async function intakeOverview(context: any) {
  if (!permissions.canReadIntake({ session: context.session })) {
    return { metrics: [] as PracticeOverviewMetric[], queue: [] as PracticeOverviewQueueItem[] };
  }
  const [activeCount, records] = await Promise.all([
    context.query.Intake.count({
      where: { status: { in: ["new", "screening", "conflict_review", "consultation", "decision"] } },
    }),
    context.query.Intake.findMany({
      where: { status: { in: ["new", "screening", "conflict_review", "consultation", "decision"] } },
      orderBy: { receivedAt: "desc" },
      take: 6,
      query: "id intakeNumber title status receivedAt primaryContact { id displayName } assignedTo { id name }",
    }),
  ]);
  return {
    metrics: [{ key: "active-intakes", label: "Active intakes", value: activeCount, href: "/dashboard/platform/intake" }],
    queue: records.map((record: any) => ({
      id: record.id,
      kind: "Intake",
      title: record.title,
      subtitle: `${record.intakeNumber} · ${displayName(record.primaryContact)}`,
      status: record.status,
      at: iso(record.receivedAt),
      href: `/dashboard/platform/intake#pipeline-${record.id}`,
      canAct: permissions.canManageIntake({ session: context.session }),
    })),
  };
}

async function matterOverview(context: any) {
  if (!permissions.canReadMatters({ session: context.session })) {
    return { metrics: [] as PracticeOverviewMetric[], queue: [] as PracticeOverviewQueueItem[] };
  }
  const [openCount, records] = await Promise.all([
    context.query.Matter.count({
      where: { status: { in: ["proposed", "pending_conflict", "open", "on_hold", "closing"] } },
    }),
    context.query.Matter.findMany({
      where: { status: { in: ["proposed", "pending_conflict", "open", "on_hold", "closing"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      query: "id matterNumber title status confidentiality updatedAt client { id displayName } responsibleAttorney { id name }",
    }),
  ]);
  return {
    metrics: [{ key: "open-matters", label: "Open matters", value: openCount, href: "/dashboard/platform/matters" }],
    queue: records.map((record: any) => ({
      id: record.id,
      kind: record.confidentiality === "restricted" ? "Restricted matter" : "Matter",
      title: record.title,
      subtitle: `${record.matterNumber} · ${displayName(record.client)}`,
      status: record.status,
      at: iso(record.updatedAt),
      href: `/dashboard/platform/matters#active-${record.id}`,
      canAct: permissions.canManageMatters({ session: context.session }),
    })),
  };
}

// Queue items carry Date instants (GraphQL DateTime). Undated items sort last and
// equal instants fall back to kind then id so the order is deterministic.
export function compareQueueItems(left: Pick<PracticeOverviewQueueItem, "at" | "kind" | "id">, right: Pick<PracticeOverviewQueueItem, "at" | "kind" | "id">) {
  const leftTime = left.at ? left.at.getTime() : Number.NaN;
  const rightTime = right.at ? right.at.getTime() : Number.NaN;
  const leftDated = !Number.isNaN(leftTime);
  const rightDated = !Number.isNaN(rightTime);
  if (leftDated !== rightDated) return leftDated ? -1 : 1;
  if (leftDated && leftTime !== rightTime) return leftTime - rightTime;
  return left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
}

async function workOverview(context: any) {
  const canReadCalendar = permissions.canReadCalendar({ session: context.session });
  const canReadTasks = permissions.canReadTasks({ session: context.session });
  const [deadlineCount, deadlines, taskCount, tasks] = await Promise.all([
    canReadCalendar
      ? context.query.Deadline.count({ where: { status: { in: ["draft", "pending"] } } })
      : 0,
    canReadCalendar
      ? context.query.Deadline.findMany({
          where: { status: { in: ["draft", "pending"] } },
          orderBy: { dueAt: "asc" },
          take: 5,
          query: "id title status dueAt isVerified matter { id matterNumber title } assignedTo { id name }",
        })
      : [],
    canReadTasks
      ? context.query.LegalTask.count({ where: { status: { in: ["open", "in_progress", "blocked"] } } })
      : 0,
    canReadTasks
      ? context.query.LegalTask.findMany({
          where: { status: { in: ["open", "in_progress", "blocked"] } },
          orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
          take: 5,
          query: "id title status priority dueAt matter { id matterNumber title } assignedTo { id name }",
        })
      : [],
  ]);
  const queue = [
    ...deadlines.map((record: any) => ({
      id: record.id,
      kind: record.isVerified ? "Verified deadline" : "Unverified deadline",
      title: record.title,
      subtitle: record.matter?.matterNumber ?? "Matter unavailable",
      status: record.status,
      at: iso(record.dueAt),
      href: `/dashboard/platform/work#deadlines-${record.id}`,
      canAct: permissions.canManageCalendar({ session: context.session }),
    })),
    ...tasks.map((record: any) => ({
      id: record.id,
      kind: "Task",
      title: record.title,
      subtitle: record.matter?.matterNumber ?? "Matter unavailable",
      status: record.status,
      at: iso(record.dueAt),
      href: `/dashboard/platform/work#tasks-${record.id}`,
      canAct: permissions.canManageTasks({ session: context.session }),
    })),
  ].sort(compareQueueItems).slice(0, 8);
  return {
    metrics: [
      ...(canReadCalendar ? [{ key: "open-deadlines", label: "Open deadlines", value: deadlineCount, href: "/dashboard/platform/work" }] : []),
      ...(canReadTasks ? [{ key: "open-tasks", label: "Open tasks", value: taskCount, href: "/dashboard/platform/work" }] : []),
    ],
    queue,
  };
}

async function billingOverview(context: any) {
  const canReadBilling = permissions.canReadBilling({ session: context.session }) ||
    permissions.canManageBilling({ session: context.session });
  if (!canReadBilling) {
    return { metrics: [] as PracticeOverviewMetric[], queue: [] as PracticeOverviewQueueItem[] };
  }
  const [unbilledTime, outstandingInvoices, invoices] = await Promise.all([
    context.query.TimeEntry.count({
      where: { isBillable: { equals: true }, status: { in: ["draft", "submitted", "approved"] } },
    }),
    context.query.Invoice.count({
      where: { status: { in: ["issued", "partially_paid", "overdue"] } },
    }),
    context.query.Invoice.findMany({
      where: { status: { in: ["draft", "approved", "issued", "partially_paid", "overdue"] } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 6,
      query: "id invoiceNumber status totalMinor balanceDueMinor currencyCode dueAt client { id displayName } matter { id matterNumber title }",
    }),
  ]);
  return {
    metrics: [
      { key: "unbilled-time", label: "Unbilled entries", value: unbilledTime, href: "/dashboard/platform/time-expenses" },
      { key: "outstanding-invoices", label: "Outstanding bills", value: outstandingInvoices, href: "/dashboard/platform/billing" },
    ],
    queue: invoices.map((record: any) => ({
      id: record.id,
      kind: "Invoice",
      title: `${record.invoiceNumber} · ${displayName(record.client)}`,
      subtitle: `${formatMoneyLabel(record.balanceDueMinor, record.currencyCode)} due`,
      status: record.status,
      at: iso(record.dueAt),
      href: `/dashboard/platform/billing#invoices-${record.id}`,
      canAct: permissions.canManageBilling({ session: context.session }),
    })),
  };
}

async function governanceOverview(context: any) {
  if (!permissions.canReadRetention({ session: context.session }) &&
      !permissions.canManageRetention({ session: context.session })) {
    return { metrics: [] as PracticeOverviewMetric[], queue: [] as PracticeOverviewQueueItem[] };
  }
  const [holdCount, holds] = await Promise.all([
    context.query.RetentionHold.count({ where: { status: { equals: "active" } } }),
    context.query.RetentionHold.findMany({
      where: { status: { equals: "active" } },
      orderBy: { effectiveAt: "desc" },
      take: 5,
      query: "id name status effectiveAt matter { id matterNumber title } document { id title }",
    }),
  ]);
  return {
    metrics: [{ key: "active-holds", label: "Active holds", value: holdCount, href: "/dashboard/platform/governance" }],
    queue: holds.map((record: any) => ({
      id: record.id,
      kind: "Legal hold",
      title: record.name,
      subtitle: record.matter?.matterNumber ?? record.document?.title ?? "Firm-level hold",
      status: record.status,
      at: iso(record.effectiveAt),
      href: `/dashboard/platform/governance#holds-${record.id}`,
      canAct: permissions.canManageRetention({ session: context.session }),
    })),
  };
}

export async function practiceOverview(
  _root: unknown,
  _args: unknown,
  context: Context,
) {
  const firmId = activeFirmId(context.session as any);
  if (!firmId || !permissions.canAccessDashboard({ session: context.session as any })) {
    throw new Error("An active firm dashboard session is required.");
  }
  const [intake, matters, work, billing, governance] = await Promise.all([
    intakeOverview(context),
    matterOverview(context),
    workOverview(context),
    billingOverview(context),
    governanceOverview(context),
  ]);
  return {
    firmId,
    firmName: String((context.session as any)?.data?.activeFirm?.name ?? "Active firm"),
    generatedAt: new Date(),
    metrics: [...intake.metrics, ...matters.metrics, ...work.metrics, ...billing.metrics, ...governance.metrics],
    intakeQueue: intake.queue,
    matterQueue: matters.queue,
    workQueue: work.queue,
    billingQueue: billing.queue,
    governanceQueue: governance.queue,
  };
}
