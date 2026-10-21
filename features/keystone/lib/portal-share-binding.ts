import { z } from "zod";
import { assertCurrentPortalActor, assertPortalMatterScope, policyGrantIsCurrent } from "./portal-policy";

// Runtime validation of a minimal authorization header, not generated Context types.
const id = z.string().min(1);
const linkedMatter = z.object({ id, firmId: id });
const resource = z.object({ id, firmId: id, matterId: id });
const document = resource.extend({ status: z.literal("active"), confidentiality: z.literal("client_shareable") });
export const portalResourceTypes = z.enum(["document", "document_version", "invoice", "communication_thread"]);
const header = z.object({
  id, firmId: id, matterId: id, portalAccountId: id, matterAccessId: id,
  grantVersion: z.number().int().nonnegative(), policyRevision: z.number().int().nonnegative(), contactId: id.nullable(),
  status: z.literal("active"), expiresAt: z.date().nullable(),
  grantedAt: z.date(), grantedById: id,
  resourceType: portalResourceTypes,
  documentId: id.nullable(), documentVersionId: id.nullable(),
  invoiceId: id.nullable(), communicationThreadId: id.nullable(),
  matter: linkedMatter,
  document: document.nullable(),
  documentVersion: z.object({ id, firmId: id, documentId: id, document }).nullable(),
  invoice: resource.extend({ status: z.enum(["issued", "partially_paid", "paid", "overdue"]) }).nullable(),
  communicationThread: resource.extend({ status: z.literal("open") }).nullable(),
  matterAccess: z.object({
    id, firmId: id, matterId: id, portalAccountId: id,
    contactId: id.nullable(), grantedById: id, grantedAt: z.date(),
    status: z.literal("active"), expiresAt: z.date().nullable(),
    policyRevision: z.number().int().nonnegative(), version: z.number().int().nonnegative(),
    canReadDocuments: z.boolean(), canReadInvoices: z.boolean(), canReadMessages: z.boolean(),
  }),
});

export const portalShareHeaderSelect = {
  id: true, firmId: true, matterId: true, portalAccountId: true, matterAccessId: true,
  grantVersion: true, policyRevision: true, contactId: true,
  status: true, grantedAt: true, grantedById: true, expiresAt: true, resourceType: true,
  documentId: true, documentVersionId: true, invoiceId: true, communicationThreadId: true,
  matter: { select: { id: true, firmId: true } },
  document: { select: { id: true, firmId: true, matterId: true, status: true, confidentiality: true } },
  documentVersion: { select: { id: true, firmId: true, documentId: true, document: { select: { id: true, firmId: true, matterId: true, status: true, confidentiality: true } } } },
  invoice: { select: { id: true, firmId: true, matterId: true, status: true } },
  communicationThread: { select: { id: true, firmId: true, matterId: true, status: true } },
  matterAccess: { select: {
    id: true, firmId: true, matterId: true, portalAccountId: true, contactId: true,
    grantedById: true, grantedAt: true, status: true, expiresAt: true,
    policyRevision: true, version: true,
    canReadDocuments: true, canReadInvoices: true, canReadMessages: true,
  } },
} as const;

export type PortalIdentity = { firmId: string; portalAccountId: string; contactId: string };

export function boundPortalShare(value: unknown, identity: PortalIdentity, now = new Date()) {
  const parsed = header.safeParse(value);
  if (!parsed.success) return null;
  const share = parsed.data;
  const grant = share.matterAccess;
  if (share.firmId !== identity.firmId || share.portalAccountId !== identity.portalAccountId ||
      grant.id !== share.matterAccessId || grant.firmId !== share.firmId ||
      grant.matterId !== share.matterId || grant.portalAccountId !== share.portalAccountId ||
      share.grantVersion !== grant.version || share.policyRevision !== grant.policyRevision ||
      (share.contactId !== null && share.contactId !== identity.contactId) ||
      (share.policyRevision > 0 && share.contactId !== grant.contactId) ||
      share.matter.id !== share.matterId || share.matter.firmId !== share.firmId ||
      (share.expiresAt && share.expiresAt <= now) || (grant.expiresAt && grant.expiresAt <= now) ||
      share.grantedAt < grant.grantedAt ||
      (grant.contactId !== null && grant.contactId !== identity.contactId) ||
      (grant.policyRevision > 0 && (!grant.contactId || grant.version < 1))) return null;
  // Explicit revision 0 is historical evidence, not inferred new policy/consent.
  const names = ["document", "documentVersion", "invoice", "communicationThread"] as const;
  if (names.some((name) => (share[`${name}Id`] === null) !== (share[name] === null))) return null;
  const selected = names.filter((name) => share[`${name}Id`] !== null);
  const name = { document: "document", document_version: "documentVersion", invoice: "invoice", communication_thread: "communicationThread" } as const;
  const field = name[share.resourceType];
  if (selected.length !== 1 || selected[0] !== field) return null;
  const linked = share[field];
  if (!linked || linked.id !== share[`${field}Id`] || linked.firmId !== share.firmId) return null;
  const target = "document" in linked ? linked.document : linked;
  if ("document" in linked && linked.documentId !== linked.document.id) return null;
  if (target.firmId !== share.firmId || target.matterId !== grant.matterId) return null;
  const capability = share.resourceType === "invoice" ? grant.canReadInvoices :
    share.resourceType === "communication_thread" ? grant.canReadMessages : grant.canReadDocuments;
  return capability ? share : null;
}

export async function portalShareIsCurrent(tx: unknown, share: NonNullable<ReturnType<typeof boundPortalShare>>) {
  if (!await policyGrantIsCurrent(tx, share.matterAccess)) return false;
  const staffPermission = { document: "canReadDocuments", document_version: "canReadDocuments", invoice: "canReadBilling", communication_thread: "canReadCommunications" } as const;
  try {
    await assertCurrentPortalActor(tx, share.firmId, share.grantedById, ["canManagePortal", "canReadPortal", "canReadMatters", staffPermission[share.resourceType]]);
    await assertPortalMatterScope(tx, share.firmId, share.matterId, share.grantedById);
    return true;
  } catch { return false; }
}

export function portalShareCandidateWhere(identity: PortalIdentity, now: Date) {
  return {
    firmId: identity.firmId, portalAccountId: identity.portalAccountId, status: "active",
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    portalAccount: { id: identity.portalAccountId, firmId: identity.firmId, contactId: identity.contactId, status: "active",
      contact: { id: identity.contactId, firmId: identity.firmId, status: { not: "archived" } }, firm: { status: "active" } },
    matterAccess: { firmId: identity.firmId, portalAccountId: identity.portalAccountId, status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  };
}

// Literal same-tuple predicates: Prisma relation filters cannot compare columns
// belonging to different models. Header comparisons precede this private query.
export function boundPortalShareWhere(share: NonNullable<ReturnType<typeof boundPortalShare>>, identity: PortalIdentity, now: Date) {
  const grant = share.matterAccess;
  const resourceWhere = { firmId: identity.firmId, matterId: share.matterId };
  return {
    ...portalShareCandidateWhere(identity, now), id: share.id, matterId: share.matterId,
    matterAccessId: grant.id, resourceType: share.resourceType, grantedAt: share.grantedAt, grantedById: share.grantedById,
    grantVersion: share.grantVersion, policyRevision: share.policyRevision, contactId: share.contactId,
    documentId: share.documentId, documentVersionId: share.documentVersionId,
    invoiceId: share.invoiceId, communicationThreadId: share.communicationThreadId,
    matter: { id: share.matterId, firmId: identity.firmId },
    matterAccess: { id: grant.id, firmId: identity.firmId, matterId: share.matterId, portalAccountId: identity.portalAccountId,
      contactId: grant.contactId, grantedById: grant.grantedById, grantedAt: grant.grantedAt,
      policyRevision: grant.policyRevision, version: grant.version, status: "active",
      canReadDocuments: grant.canReadDocuments, canReadInvoices: grant.canReadInvoices, canReadMessages: grant.canReadMessages,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ...(share.resourceType === "document" ? { document: { id: share.documentId, ...resourceWhere, status: "active", confidentiality: "client_shareable" } } : {}),
    ...(share.resourceType === "document_version" ? { documentVersion: { id: share.documentVersionId, firmId: identity.firmId,
      documentId: share.documentVersion?.documentId,
      document: { id: share.documentVersion?.documentId, ...resourceWhere, status: "active", confidentiality: "client_shareable" } } } : {}),
    ...(share.resourceType === "invoice" ? { invoice: { id: share.invoiceId, ...resourceWhere, status: { in: ["issued", "partially_paid", "paid", "overdue"] } } } : {}),
    ...(share.resourceType === "communication_thread" ? { communicationThread: { id: share.communicationThreadId, ...resourceWhere, status: "open" } } : {}),
  };
}
