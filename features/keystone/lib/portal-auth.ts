import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PortalReadError } from "./portal-read-error";

import {
  credentialDigest,
  parseCredential,
} from "./machine-auth";
import { prismaWithoutGraphQLErrorConversion, runSerializableTransaction } from "./transactions";
import { normalizeStoreLogoColor, safeStoreLogo } from "../../shared/store-logo";
import { boundPortalShare, boundPortalShareWhere, portalShareIsCurrent, portalShareCandidateWhere, portalShareHeaderSelect } from "./portal-share-binding";

export async function authenticatePortalSession(
  rawToken: string,
  prisma: any,
  pepper?: string,
) {
  const client = prismaWithoutGraphQLErrorConversion(prisma) as any;
  const parsed = parseCredential(rawToken);
  if (!parsed || parsed.kind !== "portal_session") return null;
  const digest = credentialDigest("portal_session", rawToken, pepper);
  const session = await client.portalSession.findUnique({
    where: { tokenDigest: digest },
    include: { portalAccount: { include: {
      firm: { select: { id: true, status: true } },
      contact: { select: { id: true, firmId: true, status: true } },
    } } },
  });
  const now = new Date();
  if (
    !session ||
    session.status !== "active" ||
    session.expiresAt <= now ||
    session.portalAccount?.id !== session.portalAccountId ||
    session.portalAccount?.status !== "active" ||
    session.portalAccount?.contact?.id !== session.portalAccount.contactId ||
    session.portalAccount?.contact?.firmId !== session.firmId ||
    !session.portalAccount?.contact?.status || session.portalAccount.contact.status === "archived" ||
    session.portalAccount?.firmId !== session.firmId ||
    session.portalAccount?.firm?.id !== session.firmId ||
    session.portalAccount?.firm?.status !== "active"
  ) {
    return null;
  }
  await client.portalSession.update({
    where: { id: session.id },
    data: { lastUsedAt: now },
  });
  return {
    sessionId: session.id,
    firmId: session.firmId,
    portalAccountId: session.portalAccountId,
    contactId: session.portalAccount.contactId,
  };
}

export async function revokePortalSession(rawToken: string, prisma: any, pepper?: string) {
  const client = prismaWithoutGraphQLErrorConversion(prisma) as any;
  const parsed = parseCredential(rawToken);
  if (!parsed || parsed.kind !== "portal_session") return false;
  const tokenDigest = credentialDigest("portal_session", rawToken, pepper);
  const result = await client.portalSession.updateMany({
    where: { tokenDigest, status: "active" },
    data: { status: "revoked", revokedAt: new Date() },
  });
  return result.count > 0;
}

type PortalFirmBrandRow = {
  name: string; displayName: string | null; shortName: string | null; brandTagline: string | null
  brandColor: string | null; supportEmail: string | null; logoIcon: string | null; logoColor: string | null; defaultTimezone: string
};

export async function portalFirmBrand(rawToken: string, prisma: any, pepper?: string) {
  const client = prismaWithoutGraphQLErrorConversion(prisma) as any;
  const identity = await authenticatePortalSession(rawToken, client, pepper);
  if (!identity) throw new PortalReadError("invalid_session");
  return client.firm.findFirst({
    where: { id: identity.firmId, status: "active" },
    select: { name: true, displayName: true, shortName: true, brandTagline: true, brandColor: true, supportEmail: true, logoIcon: true, logoColor: true, defaultTimezone: true },
  }).then((firm: PortalFirmBrandRow | null) => firm && {
    ...firm,
    logoIcon: safeStoreLogo(firm.logoIcon),
    logoColor: normalizeStoreLogoColor(firm.logoColor),
  });
}

export const PORTAL_INVOICE_LINE_LIMIT = 200;
export const PORTAL_THREAD_MESSAGE_LIMIT = 50;

export type PortalSharedResourceSummary = {
  id: string;
  resourceType: string;
  grantedAt: Date;
  expiresAt: Date | null;
  matterNumber: string;
  matterTitle: string;
  /** Client-visible label of the shared item: document title, document-version file
   * name, invoice number, or thread subject. Null when the record carries none. */
  resourceTitle: string | null;
};

export type PortalSharedResourcePage = { items: PortalSharedResourceSummary[]; nextCursor: string | null };

export const PORTAL_SHARE_PAGE_SIZE = 25;
const PORTAL_HEADER_BATCH = 100;
// Upper bound on headers scanned per request; a continuation resumes after them.
const PORTAL_HEADER_SCAN_LIMIT = 1000;

type PortalCursorPosition = { grantedAt: Date; id: string };
const portalCursor = z.object({ a: z.string(), g: z.string().datetime(), i: z.string().min(1).max(64) });

/** Opaque continuation bound to the portal account and the grantedAt desc / id asc order. */
function encodePortalCursor(portalAccountId: string, position: PortalCursorPosition) {
  return Buffer.from(JSON.stringify({ a: portalAccountId, g: position.grantedAt.toISOString(), i: position.id })).toString("base64url");
}

function decodePortalCursor(cursor: string | null | undefined, portalAccountId: string): PortalCursorPosition | null {
  if (!cursor) return null;
  try {
    if (cursor.length > 512) throw new PortalReadError("invalid_cursor");
    const parsed = portalCursor.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (parsed.success && parsed.data.a === portalAccountId) return { grantedAt: new Date(parsed.data.g), id: parsed.data.i };
  } catch {
    // fall through: malformed continuations are rejected below
  }
  throw new PortalReadError("invalid_cursor");
}

export async function listPortalSharedResources(
  rawToken: string,
  prisma: any,
  pepper?: string,
): Promise<PortalSharedResourceSummary[]> {
  return (await listPortalSharedResourcesPage(rawToken, prisma, {}, pepper)).items;
}

export async function listPortalSharedResourcesPage(
  rawToken: string,
  prisma: any,
  options: { cursor?: string | null } = {},
  pepper?: string,
): Promise<PortalSharedResourcePage> {
  return runSerializableTransaction(prisma, (tx: any) => listPortalSharedResourcesInTransaction(rawToken, tx, options.cursor ?? null, pepper));
}

async function listPortalSharedResourcesInTransaction(rawToken: string, prisma: any, cursor: string | null, pepper?: string): Promise<PortalSharedResourcePage> {
  const client = prismaWithoutGraphQLErrorConversion(prisma) as any;
  const identity = await authenticatePortalSession(rawToken, client, pepper);
  if (!identity) throw new PortalReadError("invalid_session");
  const now = new Date();
  let position = decodePortalCursor(cursor, identity.portalAccountId);
  // Header scans contain identity headers only: no private Matter title/number.
  // Candidates no longer current are skipped and scanning continues, so stale
  // grants can never crowd an older valid share out of reach.
  const predicates: ReturnType<typeof boundPortalShareWhere>[] = [];
  let scanned = 0;
  let exhausted = false;
  while (predicates.length < PORTAL_SHARE_PAGE_SIZE && scanned < PORTAL_HEADER_SCAN_LIMIT) {
    const candidates = portalShareCandidateWhere(identity, now);
    const after = position
      ? { OR: [{ grantedAt: { lt: position.grantedAt } }, { grantedAt: position.grantedAt, id: { gt: position.id } }] }
      : null;
    const headers: Array<{ id: string; grantedAt: Date }> = await client.portalShare.findMany({
      where: after ? { AND: [candidates, after] } : candidates,
      orderBy: [{ grantedAt: "desc" }, { id: "asc" }], take: PORTAL_HEADER_BATCH,
      select: portalShareHeaderSelect,
    });
    scanned += headers.length;
    let consumed = 0;
    for (const value of headers) {
      consumed += 1;
      position = { grantedAt: value.grantedAt, id: value.id };
      const share = boundPortalShare(value, identity, now);
      if (share && await portalShareIsCurrent(client, share)) {
        predicates.push(boundPortalShareWhere(share, identity, now));
        if (predicates.length === PORTAL_SHARE_PAGE_SIZE) break;
      }
    }
    if (headers.length < PORTAL_HEADER_BATCH && consumed === headers.length) {
      exhausted = true;
      break;
    }
  }
  const nextCursor = exhausted || !position ? null : encodePortalCursor(identity.portalAccountId, position);
  if (!predicates.length) return { items: [], nextCursor };
  // Authorization is in the storage predicate BEFORE private projection, not
  // merely a JS filter of already-loaded titles. Recheck exact grant versions.
  const rows: unknown[] = await client.portalShare.findMany({
    where: { OR: predicates },
    orderBy: [{ grantedAt: "desc" }, { id: "asc" }], take: PORTAL_SHARE_PAGE_SIZE,
    select: {
      ...portalShareHeaderSelect,
      matter: { select: { id: true, firmId: true, matterNumber: true, title: true } },
      document: { select: { ...portalShareHeaderSelect.document.select, title: true } },
      documentVersion: { select: { ...portalShareHeaderSelect.documentVersion.select, fileName: true, document: { select: { ...portalShareHeaderSelect.documentVersion.select.document.select, title: true } } } },
      invoice: { select: { ...portalShareHeaderSelect.invoice.select, invoiceNumber: true } },
      communicationThread: { select: { ...portalShareHeaderSelect.communicationThread.select, subject: true } },
    },
  });
  const summary = z.object({ id: z.string(), resourceType: z.string(), grantedAt: z.date(), expiresAt: z.date().nullable(),
    matter: z.object({ matterNumber: z.string(), title: z.string() }),
    document: z.object({ title: z.string().nullable().optional() }).nullable().optional(),
    documentVersion: z.object({ fileName: z.string().nullable().optional(), document: z.object({ title: z.string().nullable().optional() }).nullable().optional() }).nullable().optional(),
    invoice: z.object({ invoiceNumber: z.string().nullable().optional() }).nullable().optional(),
    communicationThread: z.object({ subject: z.string().nullable().optional() }).nullable().optional() });
  const result: PortalSharedResourceSummary[] = [];
  const admitted = new Map(predicates.map((predicate) => [predicate.id, JSON.stringify(predicate)]));
  for (const row of rows) {
    const bound = boundPortalShare(row, identity, now);
    const parsed = summary.safeParse(row);
    if (!bound || admitted.get(bound.id) !== JSON.stringify(boundPortalShareWhere(bound, identity, now)) || !parsed.success) {
      throw new Error("Portal share is not available to this account.");
    }
    const share = parsed.data;
    result.push({ id: share.id, resourceType: share.resourceType, grantedAt: share.grantedAt, expiresAt: share.expiresAt,
      matterNumber: share.matter.matterNumber, matterTitle: share.matter.title, resourceTitle: portalResourceTitle(share) });
  }
  return { items: result, nextCursor };
}

function portalResourceTitle(share: {
  resourceType: string;
  document?: { title?: string | null } | null;
  documentVersion?: { fileName?: string | null; document?: { title?: string | null } | null } | null;
  invoice?: { invoiceNumber?: string | null } | null;
  communicationThread?: { subject?: string | null } | null;
}) {
  const value = share.resourceType === "document" ? share.document?.title
    : share.resourceType === "document_version" ? share.documentVersion?.document?.title || share.documentVersion?.fileName
    : share.resourceType === "invoice" ? share.invoice?.invoiceNumber
    : share.resourceType === "communication_thread" ? share.communicationThread?.subject
    : null;
  return value?.trim() ? value.trim().slice(0, 300) : null;
}

async function recordPortalRead(
  client: any,
  identity: { portalAccountId: string; contactId: string; firmId: string },
  share: NonNullable<ReturnType<typeof boundPortalShare>>,
) {
  await client.auditEvent.create({
    data: {
      firmId: identity.firmId,
      eventId: randomUUID(),
      eventType: "portal.resource_read",
      category: "authorization",
      outcome: "succeeded",
      actorType: "portal_account",
      matterId: share.matterId,
      contactId: identity.contactId,
      occurredAt: new Date(),
      metadata: {
        portalAccountId: identity.portalAccountId,
        portalShareId: share.id,
        portalMatterAccessId: share.matterAccessId, grantVersion: share.grantVersion, policyRevision: share.policyRevision,
        resourceType: share.resourceType,
      },
    },
  });
}

export async function readPortalSharedResource(
  rawToken: string,
  shareId: string,
  prisma: any,
  pepper?: string,
) {
  return runSerializableTransaction(prisma, (tx: any) => readPortalSharedResourceInTransaction(rawToken, shareId, tx, pepper));
}

async function readPortalSharedResourceInTransaction(rawToken: string, shareId: string, prisma: any, pepper?: string) {
  const client = prismaWithoutGraphQLErrorConversion(prisma) as any;
  const identity = await authenticatePortalSession(rawToken, client, pepper);
  if (!identity) throw new PortalReadError("invalid_session");
  const now = new Date();
  const value: unknown = await client.portalShare.findFirst({
    where: { ...portalShareCandidateWhere(identity, now), id: shareId },
    select: portalShareHeaderSelect,
  });
  const share = boundPortalShare(value, identity, now);
  if (!share || share.id !== shareId || !await portalShareIsCurrent(client, share)) {
    throw new PortalReadError("unavailable_resource");
  }
  const current = await client.portalShare.findFirst({
    where: boundPortalShareWhere(share, identity, now), select: { id: true },
  });
  if (!current || current.id !== share.id) throw new PortalReadError("unavailable_resource");

  if (share.resourceType === "document") {
    const resource = await client.document.findFirst({
      where: {
        id: share.documentId,
        firmId: identity.firmId,
        matterId: share.matterId,
        status: "active",
        confidentiality: "client_shareable",
      },
      select: { id: true, title: true, category: true, status: true, updatedAt: true },
    });
    if (!resource || resource.id !== share.documentId) throw new Error("Shared document is unavailable.");
    await recordPortalRead(client, identity, share);
    return {
      resourceType: share.resourceType,
      document: resource,
      documentVersion: null,
      invoice: null,
      communicationThread: null,
    };
  }
  if (share.resourceType === "document_version") {
    const resource = await client.documentVersion.findFirst({
      where: {
        id: share.documentVersionId,
        firmId: identity.firmId,
        document: {
          id: share.documentVersion?.documentId,
          firmId: identity.firmId,
          matterId: share.matterAccess.matterId,
          status: "active",
          confidentiality: "client_shareable",
        },
      },
      select: {
        id: true,
        versionNumber: true,
        fileName: true,
        mediaType: true,
        byteSize: true,
        checksumSha256: true,
        createdAt: true,
      },
    });
    if (!resource || resource.id !== share.documentVersionId) throw new Error("Shared document version is unavailable.");
    await recordPortalRead(client, identity, share);
    return {
      resourceType: share.resourceType,
      document: null,
      documentVersion: resource,
      invoice: null,
      communicationThread: null,
    };
  }
  if (share.resourceType === "invoice") {
    const resource = await client.invoice.findFirst({
      where: {
        id: share.invoiceId,
        firmId: identity.firmId,
        matterId: share.matterId,
        status: { in: ["issued", "partially_paid", "paid", "overdue"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        currencyCode: true,
        totalMinor: true,
        paidMinor: true,
        balanceDueMinor: true,
        subtotalMinor: true,
        discountMinor: true,
        taxMinor: true,
        issuedAt: true,
        dueAt: true,
        // Issued lines are immutable billing snapshots of the same invoice/matter.
        lines: {
          where: { firmId: identity.firmId, matterId: share.matterId },
          orderBy: [{ serviceDate: "asc" }, { id: "asc" }],
          take: PORTAL_INVOICE_LINE_LIMIT + 1,
          select: { id: true, description: true, serviceDate: true, quantity: true, unitAmountMinor: true, lineTotalMinor: true, currencyCode: true },
        },
      },
    });
    if (!resource || resource.id !== share.invoiceId) throw new Error("Shared invoice is unavailable.");
    await recordPortalRead(client, identity, share);
    const { lines, ...invoice } = resource;
    return {
      resourceType: share.resourceType,
      document: null,
      documentVersion: null,
      invoice: { ...invoice, lines: lines.slice(0, PORTAL_INVOICE_LINE_LIMIT), hasMoreLines: lines.length > PORTAL_INVOICE_LINE_LIMIT },
      communicationThread: null,
    };
  }
  const resource = await client.communicationThread.findFirst({
    where: {
      id: share.communicationThreadId,
      firmId: identity.firmId,
      matterId: share.matterId,
      status: "open",
    },
    select: { id: true, subject: true, primaryChannel: true, status: true, lastMessageAt: true },
  });
  if (!resource || resource.id !== share.communicationThreadId) throw new Error("Shared communication thread is unavailable.");
  // Client-safe projection only: messages this client actually sent, or that were
  // actually sent/delivered TO this client. Internal notes, drafts, queued or
  // failed messages and messages to other participants never leave the firm.
  const messages = await client.communicationMessage.findMany({
    where: {
      threadId: resource.id, firmId: identity.firmId, matterId: share.matterId,
      OR: [
        { direction: "inbound", status: "received", senderContactId: identity.contactId },
        { direction: "outbound", status: { in: ["sent", "delivered"] },
          deliveries: { some: { recipientContactId: identity.contactId, status: { in: ["sent", "delivered"] } } } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: PORTAL_THREAD_MESSAGE_LIMIT + 1,
    select: { id: true, direction: true, subject: true, body: true, sentAt: true, receivedAt: true, createdAt: true },
  });
  await recordPortalRead(client, identity, share);
  return {
    resourceType: share.resourceType,
    document: null,
    documentVersion: null,
    invoice: null,
    communicationThread: {
      ...resource,
      messages: messages.slice(0, PORTAL_THREAD_MESSAGE_LIMIT).reverse(),
      hasOlderMessages: messages.length > PORTAL_THREAD_MESSAGE_LIMIT,
    },
  };
}
