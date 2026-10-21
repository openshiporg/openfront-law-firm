import type { Context } from ".keystone/types";

import { sha256Digest } from "../lib/digests";
import { isGraphqlInt } from "../lib/int32";
import { runSerializableTransaction } from "../lib/transactions";
import { assertCurrentCommandActor } from "./command-authority";
import {
  assertMatterAccess,
  boundedReason,
  optionalBoundedText,
  recordAuditEvent,
  requirePermission,
  workflowActor,
} from "./workflow-helpers";

/** Human-recorded sources only. Court, email and signature-provider versions
 * belong to authenticated adapters and are never caller-asserted here. */
const ingestSources = new Set(["upload", "generated", "import"]);
const versionableStatuses = new Set(["draft", "active"]);
const MAX_SIGNATURE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

function idempotencyKey(value: string | null | undefined, label: string) {
  const key = value?.trim() ?? "";
  if (!/^[A-Za-z0-9:_-]{16,200}$/.test(key)) {
    throw new Error(`${label} must be 16-200 letters, digits, colons, underscores or hyphens.`);
  }
  return key;
}

function fileName(value: string | null | undefined) {
  const name = value?.trim() ?? "";
  const hasControlCharacter = [...name].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!name || name.length > 255 || /[\\/]/.test(name) || hasControlCharacter || name === "." || name === "..") {
    throw new Error("File name must be 1-255 characters without path separators or control characters.");
  }
  return name;
}

/** Storage references are namespaced to the firm and document so a caller
 * cannot bind another tenant's or another document's object to this version. */
function objectKey(value: string | null | undefined, firmId: string, documentId: string) {
  const key = value?.trim() ?? "";
  const prefix = `firms/${firmId}/documents/${documentId}/`;
  if (
    key.length > 1024 ||
    !key.startsWith(prefix) ||
    key.length === prefix.length ||
    key.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
    !/^[A-Za-z0-9._~/-]+$/.test(key)
  ) {
    throw new Error(`Object key must be a storage path under ${prefix} without traversal segments.`);
  }
  return key;
}

function mediaType(value: string | null | undefined) {
  const type = value?.trim().toLowerCase() ?? "";
  if (type.length > 255 || !/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/.test(type)) {
    throw new Error("Media type must be a single type/subtype value.");
  }
  return type;
}

function checksum(value: string | null | undefined) {
  const digest = value?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Checksum must be a SHA-256 hex digest.");
  return digest;
}

function byteSize(value: number) {
  if (!isGraphqlInt(value) || value < 1) throw new Error("Byte size must be a positive 32-bit integer.");
  return value;
}

async function lockDocument(tx: any, firmId: string, documentId: string) {
  // Same lock order as transitionDocument/disposal so versioning serializes with them.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document:${firmId}:${documentId}`}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`retention-document:${firmId}:${documentId}`}))`;
}

async function loadVersionableDocument(tx: any, firmId: string, documentId: string, userId: string) {
  const document = await tx.document.findFirst({ where: { id: documentId, firmId } });
  if (!document) throw new Error("Document was not found in the active firm.");
  if (document.matterId) await assertMatterAccess(tx, firmId, document.matterId, userId);
  if (!versionableStatuses.has(document.status)) {
    throw new Error("Versions can be recorded only on draft or active documents.");
  }
  return document;
}

export async function ingestDocumentVersion(
  _root: unknown,
  args: {
    documentId: string;
    idempotencyKey: string;
    fileName: string;
    objectKey: string;
    mediaType: string;
    byteSize: number;
    checksumSha256: string;
    source?: string | null;
    sourceMessageId?: string | null;
    notes?: string | null;
    makeCurrent?: boolean | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey, "Version idempotency key");
  const source = args.source?.trim() || "upload";
  if (!ingestSources.has(source)) {
    throw new Error("Only uploaded, generated or imported versions can be recorded by staff; provider sources require their adapter.");
  }
  const version = {
    fileName: fileName(args.fileName),
    objectKey: objectKey(args.objectKey, firmId, args.documentId),
    mediaType: mediaType(args.mediaType),
    byteSize: byteSize(args.byteSize),
    checksumSha256: checksum(args.checksumSha256),
    source,
    notes: optionalBoundedText(args.notes, "Version notes", 2000) ?? "",
    sourceMessageId: args.sourceMessageId ?? null,
  };
  const makeCurrent = Boolean(args.makeCurrent);
  const versionKey = `${firmId}:${args.documentId}:${key}`;
  const requestDigest = sha256Digest({ documentId: args.documentId, ...version, makeCurrent });
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await lockDocument(tx, firmId, args.documentId);
    const document = await loadVersionableDocument(tx, firmId, args.documentId, userId);
    const existing = await tx.documentVersion.findFirst({ where: { versionKey } });
    if (existing) {
      const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: `document-version:${versionKey}` } });
      if (existing.firmId !== firmId || existing.documentId !== document.id || replay?.metadata?.requestDigest !== requestDigest) {
        throw new Error("Version idempotency key was already used with a different payload.");
      }
      return { version: existing, document, replayed: true };
    }
    if (version.sourceMessageId) {
      const message = await tx.communicationMessage.findFirst({
        where: { id: version.sourceMessageId, firmId, matterId: document.matterId ?? null },
        select: { id: true },
      });
      if (!message) throw new Error("Source message must belong to the same firm and matter as the document.");
    }
    const latest = await tx.documentVersion.aggregate({
      where: { firmId, documentId: document.id },
      _max: { versionNumber: true },
    });
    const versionNumber = (latest?._max?.versionNumber ?? 0) + 1;
    const created = await tx.documentVersion.create({
      data: {
        firmId,
        matterId: document.matterId ?? null,
        documentId: document.id,
        versionKey,
        versionNumber,
        fileName: version.fileName,
        objectKey: version.objectKey,
        mediaType: version.mediaType,
        byteSize: version.byteSize,
        checksumSha256: version.checksumSha256,
        source: version.source,
        createdById: userId,
        sourceMessageId: version.sourceMessageId,
        notes: version.notes,
      },
    });
    const updatedDocument = makeCurrent
      ? await tx.document.update({ where: { id: document.id }, data: { currentVersionId: created.id } })
      : document;
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: `document-version:${versionKey}`,
        eventType: "document.version_recorded",
        category: "legal_workflow",
        outcome: "succeeded",
        ...workflowActor(context, userId),
        matterId: document.matterId ?? null,
        documentId: document.id,
        occurredAt: new Date(),
        metadata: {
          versionId: created.id,
          versionNumber,
          checksumSha256: version.checksumSha256,
          byteSize: version.byteSize,
          source: version.source,
          madeCurrent: makeCurrent,
          ...(makeCurrent ? { previousCurrentVersionId: document.currentVersionId ?? null } : {}),
          requestDigest,
        },
      },
    });
    return { version: created, document: updatedDocument, replayed: false };
  });
}

export async function setDocumentCurrentVersion(
  _root: unknown,
  args: { documentId: string; versionId: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const reason = boundedReason(args.reason, "Current version reason", 5, 2000);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    await lockDocument(tx, firmId, args.documentId);
    const document = await loadVersionableDocument(tx, firmId, args.documentId, userId);
    const version = await tx.documentVersion.findFirst({
      where: { id: args.versionId, firmId, documentId: document.id },
      select: { id: true, versionNumber: true, checksumSha256: true },
    });
    if (!version) throw new Error("Current version must be an immutable version of this same document.");
    if (document.currentVersionId === version.id) return { document, replayed: true };
    const updated = await tx.document.update({
      where: { id: document.id },
      data: { currentVersionId: version.id },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "document.current_version_set",
      category: "legal_workflow",
      ...workflowActor(context, userId),
      matterId: document.matterId ?? null,
      documentId: document.id,
      metadata: {
        versionId: version.id,
        versionNumber: version.versionNumber,
        checksumSha256: version.checksumSha256,
        previousCurrentVersionId: document.currentVersionId ?? null,
        reasonDigest: sha256Digest(reason),
      },
    });
    return { document: updated, replayed: false };
  });
}

export async function prepareSignatureRequest(
  _root: unknown,
  args: {
    documentVersionId: string;
    idempotencyKey: string;
    title: string;
    message?: string | null;
    expiresAt?: Date | string | null;
    integrationConnectionId?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManageDocuments", { humanOnly: true });
  const key = idempotencyKey(args.idempotencyKey, "Signature request idempotency key");
  const title = optionalBoundedText(args.title, "Signature request title", 300);
  if (!title) throw new Error("Signature request title is required.");
  const message = optionalBoundedText(args.message, "Signature request message", 5000) ?? "";
  let expiresAt: Date | null = null;
  if (args.expiresAt) {
    expiresAt = new Date(args.expiresAt);
    const remaining = expiresAt.getTime() - Date.now();
    if (Number.isNaN(remaining) || remaining <= 0 || remaining > MAX_SIGNATURE_LIFETIME_MS) {
      throw new Error("Signature request expiry must be in the future and within one year.");
    }
  }
  const auditId = `signature-request-prepared:${key}`;
  const requestDigest = sha256Digest({
    documentVersionId: args.documentVersionId,
    title,
    message,
    expiresAt: expiresAt?.toISOString() ?? null,
    integrationConnectionId: args.integrationConnectionId ?? null,
  });
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageDocuments");
    const identity = await tx.documentVersion.findFirst({
      where: { id: args.documentVersionId, firmId },
      select: { documentId: true },
    });
    if (!identity) throw new Error("Document version was not found in the active firm.");
    await lockDocument(tx, firmId, identity.documentId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`signature-prepare:${firmId}:${key}`}))`;
    const document = await loadVersionableDocument(tx, firmId, identity.documentId, userId);
    const replay = await tx.auditEvent.findFirst({ where: { firmId, eventId: auditId } });
    if (replay) {
      const request = await tx.signatureRequest.findFirst({ where: { id: replay.metadata?.signatureRequestId ?? "", firmId } });
      if (!request || replay.metadata?.requestDigest !== requestDigest) {
        throw new Error("Signature request idempotency key was already used with a different payload.");
      }
      return { request, replayed: true };
    }
    if (document.currentVersionId !== args.documentVersionId) {
      throw new Error("Signature requests must be prepared from the document's exact current version.");
    }
    let connection: { id: string; provider: string } | null = null;
    if (args.integrationConnectionId) {
      connection = await tx.integrationConnection.findFirst({
        where: { id: args.integrationConnectionId, firmId, status: "active", category: "signature" },
        select: { id: true, provider: true },
      });
      if (!connection) throw new Error("Signature connection must be an active signature integration in the active firm.");
    }
    const request = await tx.signatureRequest.create({
      data: {
        firmId,
        matterId: document.matterId ?? null,
        documentVersionId: args.documentVersionId,
        title,
        status: "draft",
        provider: connection?.provider ?? "",
        integrationConnectionId: connection?.id ?? null,
        message,
        expiresAt,
      },
    });
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: auditId,
        eventType: "signature.request_prepared",
        category: "legal_workflow",
        outcome: "succeeded",
        ...workflowActor(context, userId),
        matterId: document.matterId ?? null,
        documentId: document.id,
        occurredAt: new Date(),
        metadata: {
          signatureRequestId: request.id,
          documentVersionId: args.documentVersionId,
          integrationConnectionId: connection?.id ?? null,
          requestDigest,
        },
      },
    });
    return { request, replayed: false };
  });
}
