import { assertCurrentCommandActor, lockCurrentFirmMember } from "./command-authority";
import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import {
  activeFirmId,
  isInteractiveHumanSession,
  machineScopePermissionMap,
  permissions,
  type Session,
} from "../access";
import { sha256Digest } from "../lib/digests";
import {
  issueCredential,
  normalizeAgentCapabilities,
  normalizeMachineScopes,
  normalizeRedirectUris,
} from "../lib/machine-auth";
import { runSerializableTransaction } from "../lib/transactions";

function requireHumanSession(context: Context, permission: "canManageMachineCredentials" | "canApproveAgentActions") {
  const session = context.session as Session | undefined;
  const firmId = activeFirmId(session);
  if (
    !session?.itemId ||
    !firmId ||
    !isInteractiveHumanSession(session) ||
    !permissions[permission]({ session })
  ) {
    throw new Error("A human administrator with credential authority is required.");
  }
  return { session, firmId };
}

function boundedName(value: string, label: string) {
  const name = value?.trim();
  if (!name || name.length > 120) throw new Error(`${label} must be between 1 and 120 characters.`);
  return name;
}

function boundedReason(value: string | null | undefined) {
  const reason = value?.trim();
  if (!reason || reason.length < 3 || reason.length > 1000) {
    throw new Error("A revocation reason between 3 and 1000 characters is required.");
  }
  return reason;
}

function futureExpiration(value: string | null | undefined, maxDays: number) {
  if (!value) return null;
  const expiresAt = new Date(value);
  const now = Date.now();
  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now ||
    expiresAt.getTime() > now + maxDays * 24 * 60 * 60 * 1000
  ) {
    throw new Error(`Expiration must be in the future and within ${maxDays} days.`);
  }
  return expiresAt;
}

async function activeFirmUser(prisma: any, firmId: string, userId: string) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      status: "active",
      firmMemberships: { some: { firmId, status: "active", role: { status: "active" } } },
    },
    select: { id: true },
  });
}

async function audit(tx: any, data: {
  firmId: string;
  eventType: string;
  actorUserId: string;
  metadata: Record<string, unknown>;
}) {
  await tx.auditEvent.create({
    data: {
      firmId: data.firmId,
      eventId: randomUUID(),
      eventType: data.eventType,
      category: "authentication",
      outcome: "succeeded",
      actorUserId: data.actorUserId,
      actorType: "user",
      occurredAt: new Date(),
      metadata: data.metadata,
    },
  });
}

export async function issueApiKey(
  _root: unknown,
  args: {
    name: string;
    scopes: string[];
    ownerId?: string | null;
    expiresAt?: string | null;
  },
  context: Context,
) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const name = boundedName(args.name, "API key name");
  const scopes = normalizeMachineScopes(args.scopes);
  const ownerId = args.ownerId ?? session.itemId;
  const expiresAt = futureExpiration(args.expiresAt, 366);
  const credential = issueCredential("api_key");
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const owner = await lockCurrentFirmMember(tx, ownerId, firmId);
    if (!owner || owner.data.activeFirm?.status !== "active" || scopes.some((scope) =>
      machineScopePermissionMap[scope].some((permission) => !permissions[permission]({ session: owner })),
    )) {
      throw new Error("API-key scopes must be within the current same-firm owner role.");
    }
    const key = await tx.apiKey.create({
      data: {
        firmId,
        ownerId,
        name,
        prefix: credential.prefix,
        secretDigest: credential.digest,
        status: "active",
        scopes,
        expiresAt,
        createdById: session.itemId,
      },
    });
    await audit(tx, {
      firmId,
      eventType: "api_key.issued",
      actorUserId: session.itemId,
      metadata: { apiKeyId: key.id, ownerId, scopes, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return { credential: key, secret: credential.token };
  });
}

export async function revokeApiKey(
  _root: unknown,
  args: { id: string; reason: string },
  context: Context,
) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const reason = boundedReason(args.reason);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const key = await tx.apiKey.findFirst({ where: { id: args.id, firmId } });
    if (!key) throw new Error("API key was not found in the active firm.");
    if (key.status === "revoked") return { credential: key, replayed: true };
    const revoked = await tx.apiKey.update({
      where: { id: key.id },
      data: {
        status: "revoked",
        revokedById: session.itemId,
        revokedAt: new Date(),
        revocationReason: `sha256:${sha256Digest(reason)}`,
      },
    });
    await audit(tx, {
      firmId,
      eventType: "api_key.revoked",
      actorUserId: session.itemId,
      metadata: { apiKeyId: key.id, reasonDigest: sha256Digest(reason) },
    });
    return { credential: revoked, replayed: false };
  });
}

export async function issueOAuthClient(
  _root: unknown,
  args: {
    name: string;
    redirectUris: string[];
    scopes: string[];
    description?: string | null;
  },
  context: Context,
) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const name = boundedName(args.name, "OAuth client name");
  const redirectUris = normalizeRedirectUris(args.redirectUris);
  const scopes = normalizeMachineScopes(args.scopes);
  const description = args.description?.trim() || null;
  if (description && description.length > 2000) throw new Error("OAuth client description is too long.");
  const clientId = `olfc_${randomUUID().replaceAll("-", "")}`;
  const secret = issueCredential("oauth_client");
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const client = await tx.oAuthClient.create({
      data: {
        firmId,
        ownerId: session.itemId,
        name,
        clientId,
        clientSecretDigest: secret.digest,
        status: "active",
        isConfidential: true,
        redirectUris,
        allowedScopes: scopes,
        description: description ?? "",
        createdById: session.itemId,
      },
    });
    await audit(tx, {
      firmId,
      eventType: "oauth_client.issued",
      actorUserId: session.itemId,
      metadata: { oauthClientId: client.id, clientId, redirectUris, scopes },
    });
    return { client, clientSecret: secret.token };
  });
}

export async function revokeOAuthClient(
  _root: unknown,
  args: { id: string; reason: string },
  context: Context,
) {
  const { session, firmId } = requireHumanSession(context, "canManageMachineCredentials");
  const reason = boundedReason(args.reason);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageMachineCredentials");
    const client = await tx.oAuthClient.findFirst({ where: { id: args.id, firmId } });
    if (!client) throw new Error("OAuth client was not found in the active firm.");
    if (client.status === "revoked") return { client, replayed: true };
    const now = new Date();
    const revoked = await tx.oAuthClient.update({
      where: { id: client.id },
      data: { status: "revoked", revokedById: session.itemId, revokedAt: now },
    });
    await Promise.all([
      tx.oAuthToken.updateMany({
        where: { clientId: client.id, status: "active" },
        data: { status: "revoked", revokedAt: now },
      }),
      tx.oAuthConsent.updateMany({
        where: { clientId: client.id, status: "active" },
        data: { status: "revoked", revokedAt: now },
      }),
    ]);
    await audit(tx, {
      firmId,
      eventType: "oauth_client.revoked",
      actorUserId: session.itemId,
      metadata: { oauthClientId: client.id, reasonDigest: sha256Digest(reason) },
    });
    return { client: revoked, replayed: false };
  });
}

export async function issueAgentCredential(
  _root: unknown,
  args: {
    agentPrincipalId: string;
    name: string;
    capabilities: string[];
    expiresAt?: string | null;
  },
  context: Context,
) {
  const { session, firmId } = requireHumanSession(context, "canApproveAgentActions");
  if (!permissions.canManageAgents({ session })) {
    throw new Error("Agent-management permission is required.");
  }
  const name = boundedName(args.name, "Agent credential name");
  const capabilities = normalizeAgentCapabilities(args.capabilities);
  const expiresAt = futureExpiration(args.expiresAt, 90);
  const credential = issueCredential("agent");
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    const principal = await tx.agentPrincipal.findFirst({
      where: { id: args.agentPrincipalId, firmId, status: "active" },
      select: {
        id: true,
        grants: {
          where: {
            status: "active",
            OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
            AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
          },
          select: { capabilities: true },
        },
      },
    });
    if (!principal) throw new Error("Active agent principal was not found in the selected firm.");
    const granted = new Set(principal.grants.flatMap((grant: any) => grant.capabilities));
    if (capabilities.some((capability) => !granted.has(capability))) {
      throw new Error("Agent credential capabilities must be covered by a current approved grant.");
    }
    const created = await tx.agentCredential.create({
      data: {
        firmId,
        agentPrincipalId: principal.id,
        name,
        prefix: credential.prefix,
        secretHash: credential.digest,
        status: "active",
        scopes: capabilities,
        createdById: session.itemId,
        expiresAt,
      },
    });
    await audit(tx, {
      firmId,
      eventType: "agent_credential.issued",
      actorUserId: session.itemId,
      metadata: { agentCredentialId: created.id, principalId: principal.id, capabilities },
    });
    return { credential: created, secret: credential.token };
  });
}

export async function revokeAgentCredential(
  _root: unknown,
  args: { id: string; reason: string },
  context: Context,
) {
  const { session, firmId } = requireHumanSession(context, "canApproveAgentActions");
  if (!permissions.canManageAgents({ session })) {
    throw new Error("Agent-management permission is required.");
  }
  const reason = boundedReason(args.reason);
  const prisma = context.prisma as any;
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canApproveAgentActions");
    await assertCurrentCommandActor(tx, context, "canManageAgents");
    const credential = await tx.agentCredential.findFirst({ where: { id: args.id, firmId } });
    if (!credential) throw new Error("Agent credential was not found in the active firm.");
    if (credential.status === "revoked") return { credential, replayed: true };
    const revoked = await tx.agentCredential.update({
      where: { id: credential.id },
      data: { status: "revoked", revokedAt: new Date(), revokedById: session.itemId },
    });
    await audit(tx, {
      firmId,
      eventType: "agent_credential.revoked",
      actorUserId: session.itemId,
      metadata: { agentCredentialId: credential.id, reasonDigest: sha256Digest(reason) },
    });
    return { credential: revoked, replayed: false };
  });
}
