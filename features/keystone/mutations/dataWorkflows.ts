import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { accessibleMatterStorageWhere } from "../lib/matter-access";
import { runSerializableTransaction } from "../lib/transactions";
import { requirePermission } from "./workflow-helpers";

const CONTACT_TYPES = new Set(["person", "organization"]);
const CONTACT_STATUSES = new Set(["prospective_client", "client", "former_client", "opposing", "other"]);
const EXPORT_SCOPES = new Set(["contacts", "matters", "time_entries", "invoices", "audit"]);

export type ContactImportRowInput = {
  sourceId?: string | null;
  contactType?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

type NormalizedContact = {
  sourceId: string;
  contactType: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  email: string;
  phone: string;
  status: string;
};

type ExportScope = "contacts" | "matters" | "time_entries" | "invoices" | "audit";

type ExportRows = {
  contacts: unknown[];
  matters: unknown[];
  timeEntries: unknown[];
  invoices: unknown[];
  auditEvents: unknown[];
};

function projectedExportRows(scope: ExportScope, rows: unknown[]): ExportRows {
  return {
    contacts: scope === "contacts" ? rows : [],
    matters: scope === "matters" ? rows : [],
    timeEntries: scope === "time_entries" ? rows : [],
    invoices: scope === "invoices" ? rows : [],
    auditEvents: scope === "audit" ? rows : [],
  };
}

function bounded(value: unknown, maximum: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.slice(0, maximum);
}

function fieldTooLong(row: Record<string, unknown>, key: string, maximum: number) {
  return typeof row[key] === "string" && row[key].trim().length > maximum;
}

function durableKey(value: string) {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 160) throw new Error("Idempotency key must be between 12 and 160 characters.");
  return key;
}

export function normalizeContactImportRows(input: unknown) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 500) {
    throw new Error("Contact import requires between 1 and 500 rows.");
  }
  if (JSON.stringify(input).length > 750_000) throw new Error("Contact import payload is too large.");

  const rows = input.map((candidate, index) => {
    const row = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : {};
    const contactType = bounded(row.contactType, 30).toLowerCase() || "person";
    const status = bounded(row.status, 40).toLowerCase() || "prospective_client";
    const normalized: NormalizedContact = {
      sourceId: bounded(row.sourceId, 200),
      contactType,
      firstName: bounded(row.firstName, 200),
      lastName: bounded(row.lastName, 200),
      organizationName: bounded(row.organizationName, 300),
      email: bounded(row.email, 320).toLowerCase(),
      phone: bounded(row.phone, 80),
      status,
    };
    const errors: string[] = [];
    for (const [key, maximum] of [
      ["sourceId", 200], ["firstName", 200], ["lastName", 200], ["organizationName", 300],
      ["email", 320], ["phone", 80], ["contactType", 30], ["status", 40],
    ] as const) {
      if (fieldTooLong(row, key, maximum)) errors.push(`${key} must be ${maximum} characters or fewer`);
    }
    if (!normalized.sourceId) errors.push("sourceId is required and must be 200 characters or fewer");
    if (!CONTACT_TYPES.has(contactType)) errors.push("contactType must be person or organization");
    if (!CONTACT_STATUSES.has(status)) errors.push("status is unsupported");
    if (contactType === "person" && !normalized.firstName && !normalized.lastName) errors.push("person requires a first or last name");
    if (contactType === "organization" && !normalized.organizationName) errors.push("organization requires organizationName");
    if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) errors.push("email is invalid");
    return { rowNumber: index + 1, valid: errors.length === 0, errors, normalized };
  });
  const duplicateSourceIds = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.normalized.sourceId)) duplicateSourceIds.add(row.normalized.sourceId);
    seen.add(row.normalized.sourceId);
  }
  for (const row of rows) {
    if (duplicateSourceIds.has(row.normalized.sourceId)) {
      row.valid = false;
      row.errors.push("sourceId is duplicated in this batch");
    }
  }
  return {
    valid: rows.every((row) => row.valid),
    rowCount: rows.length,
    errorCount: rows.filter((row) => !row.valid).length,
    digest: sha256Digest(rows.map((row) => row.normalized)),
    rows,
  };
}

export async function previewContactImport(_root: unknown, args: { rows: ContactImportRowInput[] }, context: Context) {
  requirePermission(context, "canManagePeople", { humanOnly: true });
  requirePermission(context, "canManageIntegrations", { humanOnly: true });
  return normalizeContactImportRows(args.rows);
}

export async function applyContactImport(
  _root: unknown,
  args: { connectionId: string; idempotencyKey: string; rows: ContactImportRowInput[] },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePeople", { humanOnly: true });
  requirePermission(context, "canManageIntegrations", { humanOnly: true });
  const key = durableKey(args.idempotencyKey);
  const preview = normalizeContactImportRows(args.rows);
  if (!preview.valid) throw new Error("Contact import must pass preview validation before apply.");
  const requestDigest = sha256Digest({ connectionId: args.connectionId, rows: preview.rows.map((row) => row.normalized) });
  const eventId = `contact-import:${firmId}:${key}`;
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePeople");
    await assertCurrentCommandActor(tx, context, "canManageIntegrations");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId } });
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) throw new Error("Import idempotency key was reused with a different payload.");
      return { importedCount: replay.metadata?.contactIds?.length ?? 0, contactIds: replay.metadata?.contactIds ?? [], replayed: true };
    }
    const connection = await tx.integrationConnection.findFirst({
      where: { id: args.connectionId, firmId, status: "active" },
      select: { id: true },
    });
    if (!connection) throw new Error("Contact import requires an active integration connection in the firm.");
    const sourceIds = preview.rows.map((row) => row.normalized.sourceId);
    const collisions = await tx.externalRecordLink.count({
      where: { connectionId: connection.id, resourceType: "contact", externalId: { in: sourceIds }, status: { not: "unlinked" } },
    });
    if (collisions) throw new Error("One or more source IDs are already linked; resolve duplicates before applying the import.");

    const contactIds: string[] = [];
    for (const row of preview.rows) {
      const data = row.normalized;
      const contact = await tx.contact.create({
        data: {
          firmId,
          contactType: data.contactType,
          status: data.status,
          firstName: data.firstName,
          lastName: data.lastName,
          organizationName: data.organizationName,
          primaryEmail: data.email,
          primaryPhone: data.phone,
        },
      });
      await tx.externalRecordLink.create({
        data: {
          firmId,
          connectionId: connection.id,
          resourceType: "contact",
          externalId: data.sourceId,
          status: "linked",
          contactId: contact.id,
          fingerprint: sha256Digest(data),
          providerMetadata: { importRowNumber: row.rowNumber },
          lastSyncedAt: new Date(),
        },
      });
      contactIds.push(contact.id);
    }
    await tx.auditEvent.create({
      data: {
        firmId, eventId, eventType: "data.contact_import_applied", category: "integration", outcome: "succeeded",
        actorUserId: userId, actorType: "user", occurredAt: new Date(),
        metadata: { requestDigest, previewDigest: preview.digest, connectionId: connection.id, contactIds },
      },
    });
    return { importedCount: contactIds.length, contactIds, replayed: false };
  });
}

export async function preparePracticeExport(
  _root: unknown,
  args: { scope: string; idempotencyKey: string; limit?: number | null },
  context: Context,
) {
  const requestedScope = args.scope?.trim().toLowerCase();
  if (!EXPORT_SCOPES.has(requestedScope)) throw new Error("Unsupported export scope.");
  const scope = requestedScope as ExportScope;
  const permission = {
    contacts: "canReadPeople",
    matters: "canReadMatters",
    time_entries: "canReadBilling",
    invoices: "canReadBilling",
    audit: "canViewAudit",
  }[scope] as "canReadPeople" | "canReadMatters" | "canReadBilling" | "canViewAudit";
  const { firmId, userId } = requirePermission(context, permission, { humanOnly: true });
  const key = durableKey(args.idempotencyKey);
  const limit = args.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Export limit must be between 1 and 500 rows.");
  const requestDigest = sha256Digest({ scope, limit });
  const eventId = `data-export:${firmId}:${key}`;
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    // The request-start check above is advisory; revocation committed since then wins.
    await assertCurrentCommandActor(tx, context, permission);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId } });
    if (replay) {
      if (replay.metadata?.requestDigest !== requestDigest) throw new Error("Export idempotency key was reused with a different payload.");
      return {
        scope,
        rowCount: replay.metadata?.rowCount ?? 0,
        digest: replay.metadata?.exportDigest ?? "",
        ...projectedExportRows(scope, []),
        replayed: true,
      };
    }

    const matterWhere = accessibleMatterStorageWhere(firmId, userId);
    let rows: unknown[];
    if (scope === "contacts") {
      rows = await tx.contact.findMany({
        where: { firmId }, take: limit, orderBy: { updatedAt: "desc" },
        select: { id: true, contactType: true, status: true, firstName: true, lastName: true, organizationName: true, primaryEmail: true, primaryPhone: true, updatedAt: true },
      });
    } else if (scope === "matters") {
      rows = await tx.matter.findMany({
        where: matterWhere, take: limit, orderBy: { updatedAt: "desc" },
        select: { id: true, matterNumber: true, title: true, status: true, confidentiality: true, clientId: true, officeId: true, practiceAreaId: true, responsibleAttorneyId: true, openedAt: true, closedAt: true, updatedAt: true },
      });
    } else if (scope === "time_entries") {
      rows = await tx.timeEntry.findMany({
        where: { firmId, matter: matterWhere }, take: limit, orderBy: { workDate: "desc" },
        select: { id: true, matterId: true, userId: true, status: true, workDate: true, durationMinutes: true, description: true, isBillable: true, rateMinor: true, amountMinor: true, currencyCode: true },
      });
    } else if (scope === "invoices") {
      rows = await tx.invoice.findMany({
        where: { firmId, matter: matterWhere }, take: limit, orderBy: { updatedAt: "desc" },
        select: { id: true, matterId: true, clientId: true, invoiceNumber: true, status: true, currencyCode: true, subtotalMinor: true, discountMinor: true, taxMinor: true, totalMinor: true, paidMinor: true, balanceDueMinor: true, issuedAt: true, dueAt: true, updatedAt: true },
      });
    } else {
      rows = await tx.auditEvent.findMany({
        where: { firmId, OR: [{ matterId: null }, { matter: matterWhere }] }, take: limit, orderBy: { occurredAt: "desc" },
        select: { eventId: true, eventType: true, category: true, outcome: true, actorType: true, matterId: true, occurredAt: true },
      });
    }
    const exportDigest = sha256Digest(rows);
    await tx.auditEvent.create({
      data: {
        firmId, eventId, eventType: "data.export_prepared", category: "integration", outcome: "succeeded",
        actorUserId: userId, actorType: "user", occurredAt: new Date(),
        metadata: { requestDigest, exportDigest, scope, rowCount: rows.length },
      },
    });
    return {
      scope,
      rowCount: rows.length,
      digest: exportDigest,
      ...projectedExportRows(scope, rows),
      replayed: false,
    };
  });
}
