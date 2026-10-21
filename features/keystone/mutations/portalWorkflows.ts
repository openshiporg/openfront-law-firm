import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from ".keystone/types";

import { permissions, type PermissionKey } from "../access";
import { sha256Digest } from "../lib/digests";
import {
  credentialDigest,
  issueCredential,
  parseCredential,
} from "../lib/machine-auth";
import { readPortalSharedResource } from "../lib/portal-auth";
import { runSerializableTransaction } from "../lib/transactions";
import { assertCurrentPortalActor, assertPortalAccountTarget, assertPortalMatterScope, policyGrantIsCurrent } from "../lib/portal-policy";
import { boundPortalShare, boundPortalShareWhere, portalShareIsCurrent, portalShareHeaderSelect } from "../lib/portal-share-binding";
import { executePortalGrant, type PortalGrantCommand } from "./portalPolicyWorkflows";
import {
  boundedReason,
  recordAuditEvent,
  requirePermission,
} from "./workflow-helpers";

function normalizedEmail(value: string) {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid portal email address is required.");
  }
  return email;
}

function futureDate(value: string | null | undefined, defaultDays: number, maxDays: number) {
  const date = value ? new Date(value) : new Date(Date.now() + defaultDays * 24 * 60 * 60_000);
  if (
    Number.isNaN(date.getTime()) ||
    date <= new Date() ||
    date.getTime() > Date.now() + maxDays * 24 * 60 * 60_000
  ) {
    throw new Error(`Expiration must be in the future and within ${maxDays} days.`);
  }
  return date;
}

export async function invitePortalAccount(
  _root: unknown,
  args: { contactId: string; email: string; expiresAt?: string | null },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  const email = normalizedEmail(args.email);
  const expiresAt = futureDate(args.expiresAt, 2, 7);
  const invite = issueCredential("portal_invite");
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-invite:${firmId}:${email}`}))`;
    const contact = await tx.contact.findFirst({ where: { id: args.contactId, firmId }, select: { id: true } });
    if (!contact) throw new Error("Portal contact was not found in the active firm.");
    const existing = await tx.portalAccount.findFirst({ where: { firmId, email } });
    if (existing && existing.contactId !== contact.id) {
      throw new Error("Portal email is already assigned to another contact in this firm.");
    }
    if (existing) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${existing.id}`}))`;
    const now = new Date();
    const revokedSessions = existing
      ? await tx.portalSession.updateMany({
          where: { portalAccountId: existing.id, status: "active" },
          data: { status: "revoked", revokedAt: now },
        })
      : { count: 0 };
    const account = existing
      ? await tx.portalAccount.update({
          where: { id: existing.id },
          data: {
            status: "invited",
            resetTokenDigest: "",
            resetExpiresAt: null,
            inviteTokenDigest: invite.digest,
            inviteTokenPrefix: invite.prefix,
            inviteExpiresAt: expiresAt,
            invitedAt: now,
            suspendedAt: null,
            closedAt: null,
          },
        })
      : await tx.portalAccount.create({
          data: {
            firmId,
            contactId: contact.id,
            email,
            status: "invited",
            inviteTokenDigest: invite.digest,
            inviteTokenPrefix: invite.prefix,
            inviteExpiresAt: expiresAt,
            invitedAt: now,
          },
        });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "portal.account_invited",
      category: "authorization",
      actorUserId: userId,
      contactId: contact.id,
      metadata: {
        portalAccountId: account.id,
        inviteExpiresAt: expiresAt.toISOString(),
        previousStatus: existing?.status ?? null,
        activeSessionsRevoked: revokedSessions.count,
      },
    });
    return { account, inviteToken: invite.token };
  });
}

export async function acceptPortalInvitation(
  _root: unknown,
  args: { inviteToken: string },
  context: Context,
) {
  const parsed = parseCredential(args.inviteToken);
  if (!parsed || parsed.kind !== "portal_invite") throw new Error("Portal invitation is invalid or expired.");
  const digest = credentialDigest("portal_invite", args.inviteToken);
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-invite:${digest}`}))`;
    const reference = await tx.portalAccount.findUnique({ where: { inviteTokenDigest: digest }, select: { id: true, firmId: true } });
    if (!reference) throw new Error("Portal invitation is invalid or expired.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${reference.firmId}:${reference.id}`}))`;
    const account = await tx.portalAccount.findUnique({ where: { inviteTokenDigest: digest }, include: { firm: { select: { status: true } }, contact: { select: { status: true, firmId: true } } } });
    if (
      !account ||
      account.status !== "invited" ||
      account.firm?.status !== "active" || account.contact?.firmId !== account.firmId || !account.contact?.status || account.contact.status === "archived" ||
      !account.inviteExpiresAt ||
      account.inviteExpiresAt <= new Date()
    ) {
      throw new Error("Portal invitation is invalid or expired.");
    }
    const sessionCredential = issueCredential("portal_session");
    const now = new Date();
    const accepted = await tx.portalAccount.update({
      where: { id: account.id },
      data: {
        status: "active",
        acceptedAt: now,
        resetTokenDigest: "",
        resetExpiresAt: null,
        inviteTokenDigest: null,
        inviteTokenPrefix: "",
        inviteExpiresAt: null,
      },
    });
    const session = await tx.portalSession.create({
      data: {
        firmId: account.firmId,
        portalAccountId: account.id,
        tokenDigest: sessionCredential.digest,
        tokenPrefix: sessionCredential.prefix,
        status: "active",
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000),
      },
    });
    await recordAuditEvent(tx, {
      firmId: account.firmId,
      eventType: "portal.invitation_accepted",
      category: "authentication",
      contactId: account.contactId,
      metadata: { portalAccountId: account.id, portalSessionId: session.id },
    });
    return { account: accepted, sessionToken: sessionCredential.token, expiresAt: session.expiresAt };
  });
}

const PORTAL_SIGNIN_TTL_MS = 15 * 60_000;
const PORTAL_SIGNIN_COOLDOWN_MS = 60_000;
const PORTAL_SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

/**
 * Returning-client sign-in: a one-use, 15-minute link mailed to the address the
 * firm already verified for an ACTIVE portal account. The response never
 * reveals whether an account exists or whether delivery succeeded. Links use
 * the separate reset digest, so they can never be redeemed as an invitation.
 */
export async function requestPortalSignInLink(
  email: string,
  prisma: any,
  send: (token: string, to: string) => Promise<void>,
) {
  let address: string;
  try {
    address = normalizedEmail(email);
  } catch {
    return;
  }
  const issued: Array<{ token: string; to: string }> = await runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-signin:${address}`}))`;
    const now = Date.now();
    const accounts = await tx.portalAccount.findMany({
      where: { email: address, status: "active", firm: { status: "active" }, contact: { status: { not: "archived" } } },
      orderBy: { id: "asc" }, take: 5,
      select: { id: true, firmId: true, contactId: true, email: true, resetExpiresAt: true },
    });
    const links: Array<{ token: string; to: string }> = [];
    for (const account of accounts) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${account.firmId}:${account.id}`}))`;
      const lastIssuedAt = account.resetExpiresAt ? account.resetExpiresAt.getTime() - PORTAL_SIGNIN_TTL_MS : 0;
      if (now - lastIssuedAt < PORTAL_SIGNIN_COOLDOWN_MS) continue;
      const credential = issueCredential("portal_invite");
      await tx.portalAccount.update({
        where: { id: account.id },
        data: { resetTokenDigest: credential.digest, resetExpiresAt: new Date(now + PORTAL_SIGNIN_TTL_MS) },
      });
      await recordAuditEvent(tx, {
        firmId: account.firmId,
        eventType: "portal.signin_link_issued",
        category: "authentication",
        contactId: account.contactId,
        metadata: { portalAccountId: account.id },
      });
      links.push({ token: credential.token, to: account.email });
    }
    return links;
  });
  for (const link of issued) {
    try {
      await send(link.token, link.to);
    } catch {
      // Delivery failure is not disclosed to the requester; the link simply expires.
    }
  }
}

export async function redeemPortalSignInLink(token: string, prisma: any) {
  const parsed = parseCredential(token);
  if (!parsed || parsed.kind !== "portal_invite") throw new Error("This sign-in link is invalid or has expired.");
  const digest = credentialDigest("portal_invite", token);
  return runSerializableTransaction(prisma, async (tx: any) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-signin-redeem:${digest}`}))`;
    const reference = await tx.portalAccount.findFirst({ where: { resetTokenDigest: digest }, select: { id: true, firmId: true } });
    if (!reference) throw new Error("This sign-in link is invalid or has expired.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${reference.firmId}:${reference.id}`}))`;
    const account = await tx.portalAccount.findFirst({
      where: { id: reference.id, firmId: reference.firmId, resetTokenDigest: digest },
      include: { firm: { select: { status: true } }, contact: { select: { status: true, firmId: true } } },
    });
    const now = new Date();
    if (
      !digest || !account || account.status !== "active" || !account.resetExpiresAt || account.resetExpiresAt <= now ||
      account.firm?.status !== "active" || account.contact?.firmId !== account.firmId || !account.contact?.status || account.contact.status === "archived"
    ) {
      throw new Error("This sign-in link is invalid or has expired.");
    }
    const sessionCredential = issueCredential("portal_session");
    await tx.portalAccount.update({ where: { id: account.id }, data: { resetTokenDigest: "", resetExpiresAt: null, lastLoginAt: now } });
    const session = await tx.portalSession.create({
      data: {
        firmId: account.firmId,
        portalAccountId: account.id,
        tokenDigest: sessionCredential.digest,
        tokenPrefix: sessionCredential.prefix,
        status: "active",
        expiresAt: new Date(now.getTime() + PORTAL_SESSION_TTL_MS),
      },
    });
    await recordAuditEvent(tx, {
      firmId: account.firmId,
      eventType: "portal.signin_link_redeemed",
      category: "authentication",
      contactId: account.contactId,
      metadata: { portalAccountId: account.id, portalSessionId: session.id },
    });
    return { sessionToken: sessionCredential.token, expiresAt: session.expiresAt };
  });
}

export async function grantPortalMatterAccess(
  _root: unknown,
  args: Omit<PortalGrantCommand, "operation">,
  context: Context,
) {
  const result = await executePortalGrant(_root, { ...args, operation: "grant" }, context);
  return result.grant;
}

const resourceFields: Record<string, {
  field: string;
  model: string;
  portalPermission: string;
  staffPermission: PermissionKey;
  where: (matterId: string) => Record<string, unknown>;
}> = {
  document: {
    field: "documentId",
    model: "document",
    portalPermission: "canReadDocuments",
    staffPermission: "canReadDocuments",
    where: (matterId) => ({ matterId, status: "active", confidentiality: "client_shareable" }),
  },
  document_version: {
    field: "documentVersionId",
    model: "documentVersion",
    portalPermission: "canReadDocuments",
    staffPermission: "canReadDocuments",
    where: (matterId) => ({ document: { matterId, status: "active", confidentiality: "client_shareable" } }),
  },
  invoice: {
    field: "invoiceId",
    model: "invoice",
    portalPermission: "canReadInvoices",
    staffPermission: "canReadBilling",
    where: (matterId) => ({ matterId, status: { in: ["issued", "partially_paid", "paid", "overdue"] } }),
  },
  communication_thread: {
    field: "communicationThreadId",
    model: "communicationThread",
    portalPermission: "canReadMessages",
    staffPermission: "canReadCommunications",
    where: (matterId) => ({ matterId, status: "open" }),
  },
};

export async function sharePortalResource(
  _root: unknown,
  args: {
    portalMatterAccessId: string;
    resourceType: string;
    resourceId: string;
    expiresAt?: string | null;
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  const definition = resourceFields[args.resourceType];
  if (!definition) throw new Error("Unsupported portal resource type.");
  if (!permissions[definition.staffPermission]({ session: context.session as any })) {
    throw new Error("The current role cannot read the requested resource type.");
  }
  const expiresAt = args.expiresAt ? futureDate(args.expiresAt, 30, 366) : null;
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
    const target = await tx.portalMatterAccess.findFirst({
      where: { id: args.portalMatterAccessId, firmId }, select: { portalAccountId: true, matterId: true },
    });
    if (!target) throw new Error("Current portal matter access was not found.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${target.portalAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-access:${firmId}:${target.portalAccountId}:${target.matterId}`}))`;
    const access = await tx.portalMatterAccess.findFirst({
      where: {
        id: args.portalMatterAccessId,
        firmId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { ...portalShareHeaderSelect.matterAccess.select,
        portalAccount: { select: { id: true, firmId: true, contactId: true, status: true } } },
    });
    if (!access || access.portalAccount.status !== "active") {
      throw new Error("Current portal matter access was not found.");
    }
    if (access.portalAccount.id !== access.portalAccountId || access.portalAccount.firmId !== firmId ||
        access.portalAccountId !== target.portalAccountId || access.matterId !== target.matterId) {
      throw new Error("Current portal matter access was not found.");
    }
    await assertCurrentPortalActor(tx, firmId, userId, ["canManagePortal", "canReadPortal", "canReadMatters", definition.staffPermission]);
    await assertPortalMatterScope(tx, firmId, access.matterId, userId);
    await assertPortalAccountTarget(tx, firmId, access.portalAccountId, access.contactId ?? access.portalAccount.contactId, true);
    if (!await policyGrantIsCurrent(tx, access)) throw new Error("Grant policy or issuer authority changed; review a new grant before sharing.");
    if (!access[definition.portalPermission]) throw new Error("Portal matter access lacks the requested resource capability.");
    const resource = await tx[definition.model].findFirst({
      where: { id: args.resourceId, firmId, ...definition.where(access.matterId),
        ...(args.resourceType === "document_version" ? { document: { firmId, matterId: access.matterId, status: "active", confidentiality: "client_shareable" } } : {}) },
      select: { id: true },
    });
    if (!resource) throw new Error("Portal resource was not found in the exact matter scope.");
    const share = await tx.portalShare.create({
      data: {
        firmId,
        matterId: access.matterId,
        portalAccountId: access.portalAccountId,
        matterAccessId: access.id,
        grantVersion: access.version, policyRevision: access.policyRevision,
        contactId: access.portalAccount.contactId,
        status: "active",
        resourceType: args.resourceType,
        [definition.field]: resource.id,
        grantedById: userId,
        grantedAt: new Date(Math.max(Date.now(), access.grantedAt.getTime())),
        expiresAt,
      },
    });
    const identity = { firmId, portalAccountId: access.portalAccountId, contactId: access.portalAccount.contactId };
    const stored = boundPortalShare(await tx.portalShare.findFirst({ where: { id: share.id, firmId }, select: portalShareHeaderSelect }), identity);
    if (!stored || stored.matterAccessId !== access.id || stored.matterAccess.version !== access.version || !await portalShareIsCurrent(tx, stored) ||
        !await tx.portalShare.findFirst({ where: boundPortalShareWhere(stored, identity, new Date()), select: { id: true } })) {
      throw new Error("Portal share exact binding could not be confirmed.");
    }
    await recordAuditEvent(tx, {
      firmId,
      eventType: "portal.resource_shared",
      category: "authorization",
      actorUserId: userId,
      matterId: access.matterId,
      contactId: access.portalAccount.contactId,
      metadata: { portalShareId: share.id, resourceType: args.resourceType, resourceId: resource.id,
        portalMatterAccessId: access.id, grantVersion: access.version, policyRevision: access.policyRevision },
    });
    return share;
  });
}

export async function revokePortalGrant(
  _root: unknown,
  args: { id: string; grantType: "account" | "matter_access" | "share"; reason: string } & Partial<PortalGrantCommand>,
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, "canManagePortal", { humanOnly: true });
  if (args.grantType === "matter_access") {
    const result = await executePortalGrant(_root, { ...args, grantId: args.id, operation: "revoke" } as PortalGrantCommand, context);
    return { id: result.grant.id, status: result.grant.status, replayed: result.replayed };
  }
  const reason = boundedReason(args.reason, "Portal revocation reason", 5, 2000);
  if (!new Set(["account", "matter_access", "share"]).has(args.grantType)) {
    throw new Error("Unsupported portal grant type.");
  }
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManagePortal");
    await assertCurrentPortalActor(tx, firmId, userId, ["canManagePortal"]);
    const now = new Date();
    if (args.grantType === "account") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${args.id}`}))`;
      const account = await tx.portalAccount.findFirst({ where: { id: args.id, firmId } });
      if (!account) throw new Error("Portal account was not found in the active firm.");
      if (account.status === "closed") return { id: account.id, status: account.status, replayed: true };
      await Promise.all([
        tx.portalAccount.update({ where: { id: account.id }, data: { status: "closed", closedAt: now, resetTokenDigest: "", resetExpiresAt: null, inviteTokenDigest: null, inviteTokenPrefix: "", inviteExpiresAt: null } }),
        tx.portalSession.updateMany({ where: { portalAccountId: account.id, status: "active" }, data: { status: "revoked", revokedAt: now } }),
        tx.portalMatterAccess.updateMany({ where: { firmId, portalAccountId: account.id, status: "active" }, data: { status: "revoked", version: { increment: 1 }, revokedById: userId, revokedAt: now, revocationReason: reason } }),
        tx.portalShare.updateMany({ where: { portalAccountId: account.id, status: "active" }, data: { status: "revoked", revokedById: userId, revokedAt: now } }),
      ]);
      await recordAuditEvent(tx, {
        firmId,
        eventType: "portal.account_closed",
        category: "authorization",
        actorUserId: userId,
        contactId: account.contactId,
        metadata: { portalAccountId: account.id, reasonDigest: sha256Digest(reason) },
      });
      return { id: account.id, status: "closed", replayed: false };
    }
    const target = await tx.portalShare.findFirst({ where: { id: args.id, firmId }, select: { portalAccountId: true, matterId: true } });
    if (!target) throw new Error("Portal share was not found in the active firm.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-policy:${firmId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-account:${firmId}:${target.portalAccountId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-access:${firmId}:${target.portalAccountId}:${target.matterId}`}))`;
    await assertCurrentPortalActor(tx, firmId, userId, ["canManagePortal", "canReadPortal", "canReadMatters"]);
    const share = await tx.portalShare.findFirst({ where: { id: args.id, firmId, portalAccountId: target.portalAccountId, matterId: target.matterId } });
    if (!share) throw new Error("Portal share was not found in the active firm.");
    await assertPortalMatterScope(tx, firmId, share.matterId, userId);
    if (share.status === "revoked") return { id: share.id, status: share.status, replayed: true };
    await tx.portalShare.update({
      where: { id: share.id },
      data: { status: "revoked", revokedById: userId, revokedAt: now },
    });
    await recordAuditEvent(tx, {
      firmId,
      eventType: "portal.share_revoked",
      category: "authorization",
      actorUserId: userId,
      matterId: share.matterId,
      metadata: { portalShareId: share.id, reasonDigest: sha256Digest(reason) },
    });
    return { id: share.id, status: "revoked", replayed: false };
  });
}

export async function portalSharedResource(
  _root: unknown,
  args: { sessionToken: string; shareId: string },
  context: Context,
) {
  return readPortalSharedResource(args.sessionToken, args.shareId, context.prisma as any);
}
