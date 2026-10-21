import type { Context } from ".keystone/types";

import { formatInstant } from "../../platform/lib/datetime";
import { formatMoneyLabel } from "../../platform/lib/money";
import { activeFirmId, permissions, type PermissionKey } from "../access";
import { communicationDispatchState, webhookDispatchState } from "../../shared/dispatch-outcome";
import { practiceOverview, type PracticeOverviewQueueItem } from "./practiceOverview";

const CATEGORIES = new Set([
  "intake", "matters", "contacts", "work", "documents", "communications",
  "time-expenses", "billing", "accounting", "portal", "governance", "reports",
  "data", "integrations",
]);

export type WorkspaceSource = Source;

type Source = {
  key: string;
  title: string;
  description: string;
  model: string;
  permissions: PermissionKey[];
  where?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  query: string;
  kind: string;
  previewOnly?: boolean;
  historyStatuses?: string[];
  map(record: any): Omit<PracticeOverviewQueueItem, "kind" | "href" | "canAct">;
};

const iso = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.valueOf()) ? null : date;
};
const money = (minor: unknown, currency: unknown) => formatMoneyLabel(minor, currency);
const matterLabel = (record: any) => record.matter?.matterNumber ?? "Firm-level";

export const practiceWorkspaceSources: Record<string, Source[]> = {
  intake: [
    {
      key: "pipeline", title: "Intake pipeline", description: "Prospects requiring screening, consultation, or an engagement decision.",
      model: "Intake", permissions: ["canReadIntake"],
      where: { status: { in: ["new", "screening", "conflict_review", "consultation", "decision"] } },
      orderBy: [{ receivedAt: "desc" }, { id: "asc" }], query: "id intakeNumber status receivedAt", kind: "Intake",
      map: (record) => ({ id: record.id, title: record.intakeNumber, subtitle: "Prospective-client intake · open the pipeline to act", status: record.status, at: iso(record.receivedAt) }),
    },
    {
      key: "conflicts", title: "Conflict review status", description: "Conflict checks awaiting review, oldest first. Review each check in the conflict review panel.",
      model: "ConflictCheck", permissions: ["canReadIntake", "canRunConflictChecks", "canResolveConflicts"],
      where: { status: { in: ["requested", "running", "review_required"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      query: "status createdAt", kind: "Conflict check", previewOnly: true,
      map: (record) => ({ id: "conflict-preview", title: "Conflict check", subtitle: "Awaiting conflict review", status: record.status, at: iso(record.createdAt) }),
    },
  ],
  matters: [
    {
      key: "active", title: "Active matter register", description: "Authorized matters that are proposed, open, held, or closing.",
      model: "Matter", permissions: ["canReadMatters"], where: { status: { in: ["proposed", "pending_conflict", "open", "on_hold", "closing"] } },
      orderBy: { updatedAt: "desc" }, query: "id matterNumber title status confidentiality updatedAt client { displayName } responsibleAttorney { name }", kind: "Matter",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${record.matterNumber} · ${record.client?.displayName ?? "No client"}${record.confidentiality === "restricted" ? " · restricted" : ""}`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "walls", title: "Access decisions", description: "Ethical walls requiring approval or currently restricting matter access.",
      model: "EthicalWall", permissions: ["canReadMatters"], where: { status: { in: ["draft", "active"] } }, orderBy: { updatedAt: "desc" },
      query: "id name status effectiveAt matter { matterNumber title } membersCount", kind: "Ethical wall",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.matter?.matterNumber ?? "Matter"} · ${record.membersCount ?? 0} decisions`, status: record.status, at: iso(record.effectiveAt) }),
    },
  ],
  contacts: [
    {
      key: "directory", title: "People and organizations", description: "Firm-owned identities with relationship context for intake and matters.",
      model: "Contact", permissions: ["canReadPeople"], where: { status: { not: { equals: "archived" } } }, orderBy: { updatedAt: "desc" },
      query: "id displayName contactType status primaryEmail updatedAt", kind: "Contact",
      map: (record) => ({ id: record.id, title: record.displayName, subtitle: `${record.contactType} · ${record.primaryEmail || "No primary email"}`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "relationships", title: "Matter relationships", description: "Matter-specific roles and sides; contact identity is never flattened into one global role.",
      model: "MatterParty", permissions: ["canReadMatters"], where: { status: { equals: "active" } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id partyRole side status updatedAt", kind: "Matter party",
      map: (record) => ({ id: record.id, title: `${String(record.partyRole).replaceAll("_", " ")} relationship`, subtitle: `${String(record.side).replaceAll("_", " ")} side`, status: record.status, at: iso(record.updatedAt) }),
    },
  ],
  work: [
    {
      key: "consultations", title: "Consultation calendar", description: "Requested and scheduled prospective-client meetings visible to the current intake role.",
      model: "Consultation", permissions: ["canReadIntake"], where: { status: { in: ["requested", "scheduled"] } }, orderBy: { startsAt: "asc" },
      query: "id status startsAt endsAt timezone location intake { intakeNumber title } host { name }", kind: "Consultation",
      map: (record) => ({ id: record.id, title: record.intake?.title ?? "Prospective-client consultation", subtitle: `${formatInstant(record.startsAt, record.timezone)} · ${record.intake?.intakeNumber ?? "Intake"} · ${record.host?.name ?? "unassigned host"}${record.location ? ` · ${record.location}` : ""}`, status: record.status, at: iso(record.startsAt) }),
    },
    {
      key: "docket", title: "Docket activity", description: "Recent filings, hearings, orders, and notices with source verification state.",
      model: "DocketEntry", permissions: ["canReadCalendar", "canReadMatters"], where: { status: { in: ["draft", "filed", "entered"] } }, orderBy: { occurredAt: "desc" },
      query: "id title entryType status occurredAt isVerified matter { matterNumber } docket { docketNumber }", kind: "Docket entry",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${matterLabel(record)} · ${record.docket?.docketNumber ?? "docket"} · ${record.isVerified ? "verified" : "unverified"}`, status: record.status, at: iso(record.occurredAt) }),
    },
    {
      key: "deadlines", title: "Deadline review", description: "Upcoming obligations with source and verification state visible before action.",
      model: "Deadline", permissions: ["canReadCalendar", "canReadMatters"], where: { status: { in: ["draft", "pending"] } }, orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      query: "id title status dueAt timezone isVerified source matter { matterNumber } assignedTo { name }", kind: "Deadline",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `Due ${formatInstant(record.dueAt, record.timezone)} · ${matterLabel(record)} · ${record.isVerified ? "verified" : "requires verification"} · ${record.assignedTo?.name ?? "unassigned"}`, status: record.status, at: iso(record.dueAt) }),
    },
    {
      key: "tasks", title: "Assigned work", description: "Open, in-progress, and blocked work ordered by due date.",
      model: "LegalTask", permissions: ["canReadTasks", "canReadMatters"], where: { status: { in: ["open", "in_progress", "blocked"] } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
      query: "id title status priority dueAt blockedReason matter { matterNumber } assignedTo { name }", kind: "Task",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${matterLabel(record)} · ${record.priority} · ${record.assignedTo?.name ?? "unassigned"}`, status: record.status, at: iso(record.dueAt) }),
    },
  ],
  documents: [
    {
      key: "documents", title: "Document work", description: "Logical documents with immutable version history and current publication state.",
      model: "Document", permissions: ["canReadDocuments", "canManageDocuments"], where: { status: { in: ["draft", "active", "archived"] } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id title status category updatedAt", kind: "Document",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${record.category} · document metadata`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "signatures", title: "Signature handoffs", description: "Open signature requests; each opens to its exact document version and signers.",
      model: "SignatureRequest", permissions: ["canReadDocuments", "canManageDocuments"], where: { status: { in: ["draft", "sent", "partially_signed"] } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id title status updatedAt", kind: "Signature request",
      map: (record) => ({ id: record.id, title: record.title || "Signature request", subtitle: "Signature request · open for document version and signers", status: record.status, at: iso(record.updatedAt) }),
    },
  ],
  communications: [
    {
      key: "drafts", title: "Drafts ready for review", description: "Outbound drafts that can be queued only after recipients and controlled deliveries exist.",
      model: "CommunicationMessage", permissions: ["canReadCommunications", "canManageCommunications"], where: { status: { equals: "draft" } }, orderBy: { updatedAt: "desc" },
      query: "id subject direction channel status updatedAt matter { matterNumber } thread { subject } deliveriesCount", kind: "Message",
      map: (record) => ({ id: record.id, title: record.subject || record.thread?.subject || "Untitled draft", subtitle: `${matterLabel(record)} · ${record.channel} · ${record.deliveriesCount ?? 0} controlled deliveries`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "threads", title: "Conversation queue", description: "Open matter and intake threads, ordered by recent activity.",
      model: "CommunicationThread", permissions: ["canReadCommunications", "canReadMatters"], where: { status: { equals: "open" } }, orderBy: { lastMessageAt: "desc" },
      query: "id subject status primaryChannel lastMessageAt matter { matterNumber } intake { intakeNumber } messagesCount", kind: "Thread",
      map: (record) => ({ id: record.id, title: record.subject, subtitle: `${record.matter?.matterNumber ?? record.intake?.intakeNumber ?? "Firm-level"} · ${record.primaryChannel} · ${record.messagesCount ?? 0} messages`, status: record.status, at: iso(record.lastMessageAt) }),
    },
    {
      key: "delivery", title: "Delivery follow-up", description: "Failed, bounced, and pending provider handoffs requiring operator attention.",
      model: "CommunicationDelivery", permissions: ["canReadCommunications"], where: { status: { in: ["pending", "failed", "bounced"] } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      query: "id status channel errorCode attemptCount lastAttemptAt message { subject }", kind: "Delivery",
      map: (record) => ({ id: record.id, title: record.message?.subject ? `Delivery · ${record.message.subject}` : "Message delivery", subtitle: `${record.channel} · ${record.attemptCount ?? 0} attempts · ${communicationDispatchState(record.status, record.errorCode).guidance}`, status: communicationDispatchState(record.status, record.errorCode).status, at: iso(record.lastAttemptAt) }),
    },
  ],
  "time-expenses": [
    {
      key: "time", title: "Time review", description: "Draft, submitted, and approved unbilled work with matter scope preserved.",
      model: "TimeEntry", permissions: ["canReadBilling", "canManageBilling"], where: { status: { in: ["draft", "submitted", "approved"] } }, orderBy: { workDate: "desc" },
      query: "id description status workDate durationMinutes amountMinor currencyCode isBillable matter { matterNumber } user { name }", kind: "Time entry",
      map: (record) => ({ id: record.id, title: record.description, subtitle: `${matterLabel(record)} · ${record.durationMinutes} min · ${record.isBillable ? formatMoneyLabel(record.amountMinor, record.currencyCode, "billable · unpriced") : "non-billable"}`, status: record.status, at: iso(record.workDate) }),
    },
    {
      key: "expenses", title: "Expense review", description: "Submitted costs and disbursements awaiting approval or billing.",
      model: "Expense", permissions: ["canReadBilling", "canManageBilling"], where: { status: { in: ["draft", "submitted", "approved"] } }, orderBy: { incurredAt: "desc" },
      query: "id description status incurredAt amountMinor currencyCode isBillable matter { matterNumber } vendor { displayName }", kind: "Expense",
      map: (record) => ({ id: record.id, title: record.description, subtitle: `${matterLabel(record)} · ${money(record.amountMinor, record.currencyCode)} · ${record.vendor?.displayName ?? "No vendor"}`, status: record.status, at: iso(record.incurredAt) }),
    },
  ],
  billing: [
    {
      key: "invoices", title: "Billing and collections", description: "Draft bills, issued balances, and overdue receivables.",
      model: "Invoice", permissions: ["canReadBilling", "canManageBilling"], where: { status: { in: ["draft", "approved", "issued", "partially_paid", "overdue"] } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      query: "id invoiceNumber status totalMinor paidMinor balanceDueMinor currencyCode dueAt client { displayName } matter { matterNumber } linesCount", kind: "Invoice",
      map: (record) => ({ id: record.id, title: `${record.invoiceNumber} · ${record.client?.displayName ?? "Client"}`, subtitle: `${matterLabel(record)} · ${money(record.balanceDueMinor, record.currencyCode)} due · ${record.linesCount ?? 0} lines`, status: record.status, at: iso(record.dueAt) }),
    },
    {
      key: "payments", title: "Payments and refunds", description: "Receipts and provider state that still require capture, settlement, allocation, or review.",
      model: "Payment", permissions: ["canReadPayments", "canManagePayments", "canReadBilling"], where: { status: { in: ["pending", "authorized", "captured"] } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      query: "id paymentNumber status createdAt", kind: "Payment",
      map: (record) => ({ id: record.id, title: record.paymentNumber, subtitle: "Payment awaiting capture, settlement or allocation", status: record.status, at: iso(record.createdAt) }),
    },
  ],
  accounting: [
    {
      key: "accounts", title: "Trust account control", description: "Trust accounts and operating state; balances are derived from append-only entries.",
      model: "TrustAccount", permissions: ["canReadTrust", "canManageTrust"], orderBy: { updatedAt: "desc" },
      query: "id name accountType status currencyCode bankAccountLastFour updatedAt ledgerAccountsCount reconciliationsCount", kind: "Trust account",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.accountType} · ${record.currencyCode} · ••••${record.bankAccountLastFour || "----"}`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "ledgers", title: "Client and matter ledgers", description: "Active subledgers available for exact client-liability postings.",
      model: "TrustLedgerAccount", permissions: ["canReadTrust", "canManageTrust"], where: { status: { in: ["active", "frozen"] } }, orderBy: { updatedAt: "desc" },
      query: "id ledgerNumber status currencyCode updatedAt trustAccount { id name } client { displayName } matter { matterNumber }", kind: "Client ledger",
      map: (record) => ({ id: record.id, title: `${record.ledgerNumber} · ${record.client?.displayName ?? "Client"}`, subtitle: `${record.trustAccount?.name ?? "Trust account"} · ${record.currencyCode} · ${record.matter?.matterNumber ?? "client-level"}`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "reconciliation", title: "Reconciliation queue", description: "Open periods and differences requiring independent review.",
      model: "TrustReconciliation", permissions: ["canReadTrust", "canManageTrust"], where: { status: { in: ["draft", "in_review", "reopened"] } }, orderBy: { periodEnd: "asc" },
      query: "id status periodStart periodEnd differenceMinor currencyCode trustAccount { name } reviewedBy { name }", kind: "Reconciliation",
      map: (record) => ({ id: record.id, title: record.trustAccount?.name ?? "Trust reconciliation", subtitle: `${money(record.differenceMinor, record.currencyCode)} difference · ${record.reviewedBy?.name ?? "unreviewed"}`, status: record.status, at: iso(record.periodEnd) }),
    },
  ],
  portal: [
    {
      key: "accounts", title: "Client access", description: "Invitations and active client identities without exposing tokens.",
      model: "PortalAccount", permissions: ["canReadPortal", "canManagePortal"], where: { status: { in: ["invited", "active", "suspended"] } }, orderBy: { updatedAt: "desc" },
      query: "id email status invitedAt lastLoginAt contact { displayName } matterAccessesCount sharesCount", kind: "Portal account",
      map: (record) => ({ id: record.id, title: record.contact?.displayName ?? record.email, subtitle: `${record.email} · ${record.matterAccessesCount ?? 0} matter grants · ${record.sharesCount ?? 0} shares`, status: record.status, at: iso(record.lastLoginAt ?? record.invitedAt) }),
    },
    {
      key: "grants", title: "Matter grants", description: "Exact matter capabilities available to active portal accounts.",
      model: "PortalMatterAccess", permissions: ["canReadPortal", "canManagePortal"], where: { status: { equals: "active" } }, orderBy: { updatedAt: "desc" },
      query: "id status expiresAt updatedAt portalAccount { email contact { displayName } } matter { matterNumber title } canReadDocuments canUploadDocuments canReadInvoices canReadMessages", kind: "Matter grant",
      map: (record) => ({ id: record.id, title: record.portalAccount?.contact?.displayName ?? record.portalAccount?.email ?? "Portal account", subtitle: `${matterLabel(record)} · exact capabilities`, status: record.status, at: iso(record.expiresAt ?? record.updatedAt) }),
    },
    {
      key: "shares", title: "Active resource shares", description: "Exact documents, invoices, versions, and conversations currently shared with clients.",
      model: "PortalShare", permissions: ["canReadPortal", "canManagePortal"], where: { status: { equals: "active" } }, orderBy: { grantedAt: "desc" },
      query: "id status resourceType grantedAt expiresAt portalAccount { email contact { displayName } } matter { matterNumber title }", kind: "Portal share",
      map: (record) => ({ id: record.id, title: record.portalAccount?.contact?.displayName ?? record.portalAccount?.email ?? "Portal account", subtitle: `${matterLabel(record)} · ${record.resourceType.replaceAll("_", " ")}`, status: record.status, at: iso(record.expiresAt ?? record.grantedAt) }),
    },
    {
      key: "eligible-contacts", title: "Eligible contacts", description: "Current contacts available for a portal invitation.",
      model: "Contact", permissions: ["canReadPeople", "canManagePortal"], where: { status: { not: { equals: "archived" } } }, orderBy: { updatedAt: "desc" },
      query: "id displayName contactType status primaryEmail updatedAt", kind: "Contact",
      map: (record) => ({ id: record.id, title: record.displayName, subtitle: record.primaryEmail || "No primary email", status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "eligible-matters", title: "Readable matter preview", description: "Open matters you can read. Whether a client can be given access is decided by the access policy above.",
      model: "Matter", permissions: ["canReadMatters"], where: { status: { in: ["open", "on_hold", "closing"] } }, orderBy: { updatedAt: "desc" },
      query: "id matterNumber status updatedAt", kind: "Matter",
      map: (record) => ({ id: record.id, title: record.matterNumber, subtitle: "Readable matter · check the access policy before granting", status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "shareable-documents", title: "Shareable documents", description: "Client-shareable documents available within authorized matters.",
      model: "Document", permissions: ["canReadDocuments", "canManagePortal"], where: { status: { equals: "active" }, confidentiality: { equals: "client_shareable" } }, orderBy: { updatedAt: "desc" },
      query: "id title status category updatedAt matter { matterNumber }", kind: "Document",
      map: (record) => ({ id: record.id, title: record.title, subtitle: `${matterLabel(record)} · ${record.category}`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "shareable-invoices", title: "Shareable invoices", description: "Issued client bills available within authorized matters.",
      model: "Invoice", permissions: ["canReadBilling", "canManagePortal"], where: { status: { in: ["issued", "partially_paid", "paid", "overdue"] } }, orderBy: { updatedAt: "desc" },
      query: "id invoiceNumber status balanceDueMinor currencyCode updatedAt matter { matterNumber } client { displayName }", kind: "Invoice",
      map: (record) => ({ id: record.id, title: record.invoiceNumber, subtitle: `${matterLabel(record)} · ${money(record.balanceDueMinor, record.currencyCode)} due`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "shareable-threads", title: "Shareable conversations", description: "Open matter conversations available within authorized matters.",
      model: "CommunicationThread", permissions: ["canReadCommunications", "canManagePortal"], where: { status: { equals: "open" } }, orderBy: { lastMessageAt: "desc" },
      query: "id subject status primaryChannel lastMessageAt matter { matterNumber }", kind: "Thread",
      map: (record) => ({ id: record.id, title: record.subject, subtitle: `${matterLabel(record)} · ${record.primaryChannel}`, status: record.status, at: iso(record.lastMessageAt) }),
    },
  ],
  governance: [
    {
      key: "holds", title: "Legal holds", description: "Active matter, document, and contact holds that block disposition.",
      model: "RetentionHold", permissions: ["canReadRetention", "canManageRetention"], where: { status: { equals: "active" } }, orderBy: { effectiveAt: "desc" },
      query: "id name status effectiveAt matter { matterNumber } document { title } contact { displayName } policy { name }", kind: "Legal hold",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.matter?.matterNumber ?? record.document?.title ?? record.contact?.displayName ?? "Firm-level"} · ${record.policy?.name ?? "manual"}`, status: record.status, at: iso(record.effectiveAt) }),
    },
    {
      key: "evidence", title: "Retention evidence", description: "Recent append-only hold, archive, restoration, and disposition actions.",
      model: "RetentionAction", permissions: ["canReadRetention"], orderBy: { occurredAt: "desc" },
      query: "id actionType resourceType occurredAt matter { matterNumber } document { title } performedBy { name }", kind: "Retention action",
      map: (record) => ({ id: record.id, title: `${record.actionType} · ${record.resourceType}`, subtitle: `${record.matter?.matterNumber ?? record.document?.title ?? "Scoped record"} · ${record.performedBy?.name ?? "system"}`, status: "completed", at: iso(record.occurredAt) }),
    },
  ],
  data: [
    {
      key: "connections", title: "Import connections", description: "Active provider connections that can own source identity mappings for controlled imports.",
      model: "IntegrationConnection", permissions: ["canManageIntegrations"], where: { status: { equals: "active" } }, orderBy: { updatedAt: "desc" },
      query: "id name provider category status updatedAt externalLinksCount", kind: "Import connection",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.provider} · ${record.category} · ${record.externalLinksCount ?? 0} linked records`, status: record.status, at: iso(record.updatedAt) }),
    },
    {
      key: "links", title: "Migration identity map", description: "External record links and synchronization fingerprints used to stage portable data.",
      model: "ExternalRecordLink", permissions: ["canReadIntegrations", "canManageIntegrations"], orderBy: { updatedAt: "desc" },
      query: "id resourceType externalId status lastSyncedAt updatedAt connection { name provider } matter { matterNumber } contact { displayName }", kind: "External link",
      map: (record) => ({ id: record.id, title: `${record.resourceType} · ${record.externalId}`, subtitle: `${record.connection?.name ?? record.connection?.provider ?? "Provider"} · ${record.matter?.matterNumber ?? record.contact?.displayName ?? "Firm record"}`, status: record.status, at: iso(record.lastSyncedAt ?? record.updatedAt) }),
    },
    {
      key: "exports", title: "Export evidence", description: "Recent audited transfer and integration events available to bounded export tooling.",
      model: "AuditEvent", permissions: ["canViewAudit"], where: { category: { in: ["integration", "legal_workflow", "financial"] } }, orderBy: { occurredAt: "desc" },
      query: "id eventType category outcome occurredAt matter { matterNumber } actorUser { name }", kind: "Audit evidence",
      map: (record) => ({ id: record.id, title: record.eventType, subtitle: `${record.category} · ${record.matter?.matterNumber ?? "Firm-level"} · ${record.actorUser?.name ?? "system"}`, status: record.outcome, at: iso(record.occurredAt) }),
    },
  ],
  integrations: [
    {
      key: "connections", title: "Provider health", description: "Configured provider connections, sync health, and reauthorization needs.",
      model: "IntegrationConnection", permissions: ["canReadIntegrations", "canManageIntegrations"], orderBy: { updatedAt: "desc" },
      query: "id name provider category status lastSyncedAt lastErrorAt updatedAt office { name } externalLinksCount", kind: "Connection",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.provider} · ${record.category} · ${record.office?.name ?? "all offices"}`, status: record.status, at: iso(record.lastErrorAt ?? record.lastSyncedAt ?? record.updatedAt) }),
    },
    {
      key: "webhooks", title: "Delivery operations", description: "Queued, admitted, unresolved and rejected handoffs. Unknown outcomes require reconciliation, not resend.",
      model: "WebhookDelivery", permissions: ["canReadIntegrations", "canManageIntegrations"], where: { status: { in: ["pending", "processing", "failed", "dead_letter"] } }, orderBy: { updatedAt: "desc" },
      query: "id eventId eventType status lastError attemptCount nextAttemptAt updatedAt subscription { name } matter { matterNumber }", kind: "Webhook delivery",
      map: (record) => ({ id: record.id, title: record.eventType, subtitle: `${record.subscription?.name ?? "Subscription"} · ${record.eventId} · ${record.attemptCount ?? 0} attempts · ${webhookDispatchState(record.status, record.lastError).guidance}`, status: webhookDispatchState(record.status, record.lastError).status, at: iso(record.nextAttemptAt ?? record.updatedAt) }),
    },
    {
      key: "credentials", title: "Machine access review", description: "Scoped API keys without secret material.",
      model: "ApiKey", permissions: ["canReadMachineCredentials", "canManageMachineCredentials"], where: { status: { equals: "active" } }, orderBy: { expiresAt: "asc" },
      query: "id name prefix status scopes expiresAt lastUsedAt owner { name }", kind: "API key",
      map: (record) => ({ id: record.id, title: record.name, subtitle: `${record.prefix}… · ${(record.scopes ?? []).join(", ") || "no scopes"} · ${record.owner?.name ?? "firm-owned"}`, status: record.status, at: iso(record.expiresAt ?? record.lastUsedAt) }),
    },
  ],
};

// GraphQL list field for every workspace model; tests validate these against schema.graphql.
export const workspaceListQueries: Record<string, string> = {
  Intake: "intakes", ConflictCheck: "conflictChecks", Matter: "matters", EthicalWall: "ethicalWalls",
  Contact: "contacts", MatterParty: "matterParties", Consultation: "consultations", DocketEntry: "docketEntries",
  Deadline: "deadlines", LegalTask: "legalTasks", Document: "documents", SignatureRequest: "signatureRequests",
  CommunicationMessage: "communicationMessages", CommunicationThread: "communicationThreads",
  CommunicationDelivery: "communicationDeliveries", TimeEntry: "timeEntries", Expense: "expenses", Invoice: "invoices",
  Payment: "payments", TrustAccount: "trustAccounts", TrustLedgerAccount: "trustLedgerAccounts",
  TrustReconciliation: "trustReconciliations", PortalAccount: "portalAccounts", PortalMatterAccess: "portalMatterAccesses",
  PortalShare: "portalShares", RetentionHold: "retentionHolds", RetentionAction: "retentionActions",
  IntegrationConnection: "integrationConnections", ExternalRecordLink: "externalRecordLinks", AuditEvent: "auditEvents",
  WebhookDelivery: "webhookDeliveries", ApiKey: "apiKeys",
};

// Full-register controls. Search paths only name text the register already projects, so a
// filter can never act as an oracle for a field the viewer is not shown.
export type WorkspaceRegisterOptions = { search?: string[]; dateField?: string; nameField?: string };
const contactSearch = ["firstName", "lastName", "organizationName", "preferredName", "primaryEmail"];
export const workspaceRegisterOptions: Record<string, WorkspaceRegisterOptions> = {
  "intake:pipeline": { search: ["intakeNumber"], dateField: "receivedAt", nameField: "intakeNumber" },
  "intake:conflicts": { dateField: "createdAt" },
  "matters:active": { search: ["matterNumber", "title"], dateField: "updatedAt", nameField: "title" },
  "matters:walls": { search: ["name"], dateField: "effectiveAt", nameField: "name" },
  "contacts:directory": { search: contactSearch, dateField: "updatedAt" },
  "contacts:relationships": { dateField: "updatedAt" },
  "work:consultations": { search: ["intake.title", "intake.intakeNumber"], dateField: "startsAt" },
  "work:docket": { search: ["title"], dateField: "occurredAt", nameField: "title" },
  "work:deadlines": { search: ["title"], dateField: "dueAt", nameField: "title" },
  "work:tasks": { search: ["title"], dateField: "dueAt", nameField: "title" },
  "documents:documents": { search: ["title"], dateField: "updatedAt", nameField: "title" },
  "documents:signatures": { dateField: "updatedAt" },
  "communications:drafts": { search: ["subject"], dateField: "updatedAt", nameField: "subject" },
  "communications:threads": { search: ["subject"], dateField: "lastMessageAt", nameField: "subject" },
  "communications:delivery": { dateField: "lastAttemptAt" },
  "time-expenses:time": { search: ["description"], dateField: "workDate", nameField: "description" },
  "time-expenses:expenses": { search: ["description"], dateField: "incurredAt", nameField: "description" },
  "billing:invoices": { search: ["invoiceNumber"], dateField: "dueAt", nameField: "invoiceNumber" },
  "billing:payments": { search: ["paymentNumber"], dateField: "createdAt", nameField: "paymentNumber" },
  "accounting:accounts": { search: ["name"], dateField: "updatedAt", nameField: "name" },
  "accounting:ledgers": { search: ["ledgerNumber"], dateField: "updatedAt", nameField: "ledgerNumber" },
  "accounting:reconciliation": { search: ["trustAccount.name"], dateField: "periodEnd" },
  "portal:accounts": { search: ["email"], dateField: "updatedAt", nameField: "email" },
  "portal:grants": { search: ["portalAccount.email"], dateField: "updatedAt" },
  "portal:shares": { search: ["portalAccount.email"], dateField: "grantedAt" },
  "portal:eligible-contacts": { search: contactSearch, dateField: "updatedAt" },
  "portal:eligible-matters": { search: ["matterNumber"], dateField: "updatedAt", nameField: "matterNumber" },
  "portal:shareable-documents": { search: ["title"], dateField: "updatedAt", nameField: "title" },
  "portal:shareable-invoices": { search: ["invoiceNumber"], dateField: "updatedAt", nameField: "invoiceNumber" },
  "portal:shareable-threads": { search: ["subject"], dateField: "lastMessageAt", nameField: "subject" },
  "governance:holds": { search: ["name"], dateField: "effectiveAt", nameField: "name" },
  "governance:evidence": { dateField: "occurredAt" },
  "data:connections": { search: ["name", "provider"], dateField: "updatedAt", nameField: "name" },
  "data:links": { search: ["externalId"], dateField: "updatedAt" },
  "data:exports": { search: ["eventType"], dateField: "occurredAt" },
  "integrations:connections": { search: ["name", "provider"], dateField: "updatedAt", nameField: "name" },
  "integrations:webhooks": { search: ["eventType", "eventId"], dateField: "updatedAt" },
  "integrations:credentials": { search: ["name", "prefix"], dateField: "expiresAt", nameField: "name" },
};

export function workspaceSource(category: string, key: string) {
  return (practiceWorkspaceSources[category] ?? []).find((source) => source.key === key) ?? null;
}

export function workspaceItemHref(category: string, source: Source, recordId: string) {
  if (source.previewOnly) return `/dashboard/platform/${category}#${source.key}`;
  if (source.kind === "Matter") return `/dashboard/platform/matters/${encodeURIComponent(recordId)}`;
  return `/dashboard/platform/${category}#${source.key}-${recordId}`;
}

// Shared by the resolver's first page and every later register page so both project
// identical, access-filtered fields.
export function mapWorkspaceRecord(category: string, source: Source, record: any, ordinal: number, canAct: boolean): PracticeOverviewQueueItem {
  return {
    ...source.map(record),
    id: source.previewOnly ? `conflict-preview-${ordinal}` : record.id,
    kind: source.kind,
    href: workspaceItemHref(category, source, String(record.id ?? "")),
    canAct: source.previewOnly ? false : canAct,
  };
}

const actionPermissions: Partial<Record<string, PermissionKey>> = {
  Intake: "canManageIntake",
  "Conflict check": "canResolveConflicts",
  Matter: "canManageMatters",
  Deadline: "canManageCalendar",
  Task: "canManageTasks",
  Message: "canManageCommunications",
  Document: "canManageDocuments",
  "Time entry": "canManageBilling",
  Expense: "canManageBilling",
  Invoice: "canManageBilling",
  "Legal hold": "canManageRetention",
  Connection: "canManageIntegrations",
  "Trust account": "canManageTrust",
  "Client ledger": "canManageTrust",
  Reconciliation: "canManageTrust",
};

async function loadSource(context: any, category: string, source: Source) {
  const allowed = source.permissions.some((permission) => permissions[permission]({ session: context.session }));
  if (!allowed) return null;
  const api = context.query[source.model];
  const [total, records] = await Promise.all([
    api.count({ where: source.where ?? {} }),
    api.findMany({
      where: source.where ?? {},
      orderBy: source.orderBy ?? { updatedAt: "desc" },
      take: 12,
      query: source.query,
    }),
  ]);
  const actionPermission = actionPermissions[source.kind];
  const canAct = actionPermission ? permissions[actionPermission]({ session: context.session }) : false;
  return {
    key: source.key,
    title: source.title,
    description: source.description,
    total,
    items: records.map((record: any, index: number) => mapWorkspaceRecord(category, source, record, index + 1, canAct)),
  };
}

export async function practiceWorkspace(
  _root: unknown,
  args: { category: string },
  context: Context,
) {
  const category = args.category?.trim().toLowerCase();
  if (!CATEGORIES.has(category)) throw new Error("Practice workspace category is unsupported.");
  if (!activeFirmId(context.session as any) || !permissions.canAccessDashboard({ session: context.session as any })) {
    throw new Error("An active firm dashboard session is required.");
  }

  if (category === "reports") {
    const overview = await practiceOverview(null, null, context);
    const queues = [
      ["intake", "Intake conversion", "Current prospective-client work.", overview.intakeQueue, ["active-intakes"]],
      ["matters", "Matter inventory", "Current authorized matter inventory.", overview.matterQueue, ["open-matters"]],
      ["work", "Deadline and work pressure", "Upcoming authorized work.", overview.workQueue, ["open-deadlines", "open-tasks"]],
      ["billing", "Receivables", "Outstanding bill activity.", overview.billingQueue, ["outstanding-invoices"]],
      ["governance", "Hold exposure", "Active retention holds.", overview.governanceQueue, ["active-holds"]],
    ] as const;
    return {
      category,
      generatedAt: overview.generatedAt,
      metrics: overview.metrics.map((metric) => ({ ...metric, href: "/dashboard/platform/reports" })),
      sections: queues.map(([key, title, description, items, metricKeys]) => ({
        key,
        title,
        description,
        total: overview.metrics
          .filter((metric) => (metricKeys as readonly string[]).includes(metric.key))
          .reduce((total, metric) => total + metric.value, 0),
        items: items.map((item: PracticeOverviewQueueItem) => ({ ...item, href: `/dashboard/platform/reports#${key}-${item.id}` })),
      })),
      notices: ["Reports include only records available to the active firm, role, matter assignment, and ethical-wall state."],
    };
  }

  const loaded = await Promise.all((practiceWorkspaceSources[category] ?? []).map((source) => loadSource(context, category, source)));
  const sections = loaded.filter((section): section is NonNullable<typeof section> => Boolean(section));
  return {
    category,
    generatedAt: new Date(),
    metrics: sections.map((section) => ({
      key: section.key,
      label: section.title,
      value: section.total,
      href: `/dashboard/platform/${category}#${section.key}`,
    })),
    sections,
    notices: sections.length
      ? ["Only records visible to your active firm, role, matter assignment, and ethical-wall state are included."]
      : ["Your current role does not expose records for this workspace."],
  };
}
