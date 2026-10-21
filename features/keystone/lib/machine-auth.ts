import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  machineScopePermissionMap,
  permissionKeys,
  type Session,
} from "../access";
import { prismaWithoutGraphQLErrorConversion } from "./transactions";

export type CredentialKind = "api_key" | "oauth_access" | "oauth_refresh" | "oauth_code" | "oauth_client" | "agent" | "portal_invite" | "portal_session";
export type MachineAuthenticationType = "human" | "api_key" | "oauth" | "agent";

const tokenTags: Record<CredentialKind, string> = {
  api_key: "olfk",
  oauth_access: "olfoa",
  oauth_refresh: "olfor",
  oauth_code: "olfoc",
  oauth_client: "olfcs",
  agent: "olfa",
  portal_invite: "olfpi",
  portal_session: "olfps",
};

const tagKinds = new Map(Object.entries(tokenTags).map(([kind, tag]) => [tag, kind as CredentialKind]));
const tokenPattern = /^([a-z]+)_([a-f0-9]{16})_([A-Za-z0-9_-]{43})$/;

export const availableMachineScopes = Object.freeze(Object.keys(machineScopePermissionMap));

function credentialPepper(override?: string) {
  const value = override ?? process.env.MACHINE_CREDENTIAL_PEPPER ?? process.env.SESSION_SECRET;
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("MACHINE_CREDENTIAL_PEPPER or SESSION_SECRET must be at least 32 bytes.");
  }
  return value;
}

export function credentialDigest(kind: CredentialKind, token: string, pepper?: string) {
  return createHmac("sha256", credentialPepper(pepper))
    .update(kind)
    .update("\0")
    .update(token)
    .digest("hex");
}

export function issueCredential(kind: CredentialKind, pepper?: string) {
  const prefix = randomBytes(8).toString("hex");
  const token = `${tokenTags[kind]}_${prefix}_${randomBytes(32).toString("base64url")}`;
  return {
    token,
    prefix,
    digest: credentialDigest(kind, token, pepper),
  };
}

export function parseCredential(value: string | null | undefined) {
  if (!value || value.length > 128) return null;
  const match = value.match(tokenPattern);
  if (!match) return null;
  const kind = tagKinds.get(match[1]);
  if (!kind) return null;
  return { kind, prefix: match[2], token: value };
}

export function secretsMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeMachineScopes(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error("At least one and at most twenty machine scopes are required.");
  }
  const scopes = [...new Set(value.map((scope) => String(scope).trim()).filter(Boolean))];
  if (!scopes.length || scopes.some((scope) => !availableMachineScopes.includes(scope))) {
    throw new Error("Machine scopes contain an unsupported value.");
  }
  return scopes;
}

function normalizedScopeSet(value: unknown) {
  if (!Array.isArray(value)) return new Set<string>();
  try {
    return new Set(normalizeMachineScopes(value));
  } catch {
    return new Set<string>();
  }
}

export function effectiveOAuthScopes(
  session: Session | null,
  input: { clientAllowedScopes: unknown; consentScopes: unknown; tokenScopes: unknown },
) {
  const firmId = session?.data.activeFirm?.id;
  if (
    !session?.itemId ||
    session.data.status !== "active" ||
    !firmId ||
    !["onboarding", "active"].includes(session.data.activeFirm?.status ?? "")
  ) return [];
  const membership = session.data.firmMemberships?.find((candidate) =>
    candidate.status === "active" && candidate.firm?.id === firmId && candidate.role?.status === "active" && candidate.role.firm?.id === firmId,
  );
  const role = membership?.role;
  if (!role) return [];
  const roleScopes = new Set(availableMachineScopes.filter((scope) =>
    machineScopePermissionMap[scope].every((permission) => role[permission] === true),
  ));
  const clientScopes = normalizedScopeSet(input.clientAllowedScopes);
  const consentScopes = normalizedScopeSet(input.consentScopes);
  const tokenScopes = normalizedScopeSet(input.tokenScopes);
  return availableMachineScopes.filter((scope) =>
    roleScopes.has(scope) && clientScopes.has(scope) && consentScopes.has(scope) && tokenScopes.has(scope),
  );
}

export function normalizeAgentCapabilities(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error("At least one and at most twenty agent capabilities are required.");
  }
  const capabilities = [...new Set(value.map((capability) => String(capability).trim()).filter(Boolean))];
  if (!capabilities.every((capability) => /^[a-z]+(?:[._-][a-z]+)+$/.test(capability))) {
    throw new Error("Agent capabilities contain an unsupported value.");
  }
  return capabilities;
}

export function normalizeRedirectUri(value: string) {
  const uri = new URL(value);
  const loopbackHttp = uri.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(uri.hostname);
  if (
    (uri.protocol !== "https:" && !loopbackHttp) ||
    uri.username ||
    uri.password ||
    uri.hash
  ) {
    throw new Error("Redirect URIs require HTTPS or loopback HTTP and cannot contain credentials or fragments.");
  }
  return uri.href;
}

export function normalizeRedirectUris(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error("OAuth clients require between one and twenty redirect URIs.");
  }
  return [...new Set(value.map((uri) => normalizeRedirectUri(String(uri))))];
}

const roleSelect = {
  id: true,
  name: true,
  status: true,
  firmId: true,
  ...Object.fromEntries(permissionKeys.map((permission) => [permission, true])),
};

const userSelect = {
  id: true,
  name: true,
  status: true,
  activeFirm: { select: { id: true, name: true, displayName: true, shortName: true, brandTagline: true, brandColor: true, supportEmail: true, status: true } },
  bootstrapRole: { select: roleSelect },
  firmMemberships: {
    select: {
      id: true,
      status: true,
      firm: { select: { id: true } },
      role: { select: roleSelect },
    },
  },
};

function sessionRole(role: any) {
  if (!role) return null;
  const { firmId, ...fields } = role;
  return { ...fields, firm: firmId ? { id: firmId } : null };
}

function machineSession({
  user,
  authenticationType,
  scopes,
  credentialId,
  oauthClientId,
  agentPrincipalId,
  agentCapabilities,
}: {
  user: any;
  authenticationType: MachineAuthenticationType;
  scopes: string[];
  credentialId?: string;
  oauthClientId?: string;
  agentPrincipalId?: string;
  agentCapabilities?: string[];
}): Session | null {
  const firmId = user?.activeFirm?.id;
  if (!user?.id || user.status !== "active" || !firmId) return null;
  const memberships = (user.firmMemberships ?? []).map((membership: any) => ({
    id: membership.id,
    status: membership.status,
    firm: membership.firm,
    role: sessionRole(membership.role),
  }));
  const activeMembership = memberships.find((membership: any) =>
    membership.status === "active" &&
    membership.firm?.id === firmId &&
    membership.role?.status === "active" && membership.role?.firm?.id === firmId,
  );
  if (!activeMembership || !["onboarding", "active"].includes(user.activeFirm.status)) return null;

  return {
    itemId: user.id,
    listKey: "User",
    authenticationType,
    machineScopes: scopes,
    ...(credentialId ? { credentialId } : {}),
    oauthClientId,
    agentPrincipalId,
    agentCapabilities,
    data: {
      name: user.name,
      status: user.status,
      activeFirm: user.activeFirm,
      role: sessionRole(user.bootstrapRole),
      firmMemberships: memberships,
    },
  } as Session;
}

export async function loadActiveHumanSession(
  prisma: any,
  userId: string,
  expectedFirmId: string,
) {
  prisma = prismaWithoutGraphQLErrorConversion(prisma) as any;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (user?.activeFirm?.id !== expectedFirmId) return null;
  return machineSession({
    user,
    authenticationType: "human",
    scopes: [],
    credentialId: "",
  });
}

export type MachineAuthenticationResult = {
  presented: boolean;
  session: Session | null;
  reason?: "malformed" | "invalid";
};

export async function authenticateBearerToken(
  authorization: string | string[] | undefined,
  prisma: any,
  pepper?: string,
): Promise<MachineAuthenticationResult> {
  prisma = prismaWithoutGraphQLErrorConversion(prisma) as any;
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header) return { presented: false, session: null };
  const match = header.match(/^Bearer ([^\s]+)$/i);
  if (!match) return { presented: true, session: null, reason: "malformed" };
  const parsed = parseCredential(match[1]);
  if (!parsed || parsed.kind === "oauth_refresh" || parsed.kind === "oauth_code" || parsed.kind === "oauth_client") {
    return { presented: true, session: null, reason: "invalid" };
  }
  const now = new Date();

  if (parsed.kind === "api_key") {
    const credential = await prisma.apiKey.findUnique({
      where: { prefix: parsed.prefix },
      select: {
        id: true,
        firmId: true,
        secretDigest: true,
        status: true,
        scopes: true,
        expiresAt: true,
        owner: { select: userSelect },
      },
    });
    if (
      !credential ||
      credential.status !== "active" ||
      (credential.expiresAt && credential.expiresAt <= now) ||
      credential.secretDigest !== credentialDigest("api_key", parsed.token, pepper) ||
      credential.owner?.activeFirm?.id !== credential.firmId
    ) {
      return { presented: true, session: null, reason: "invalid" };
    }
    let scopes: string[];
    try {
      scopes = normalizeMachineScopes(credential.scopes);
    } catch {
      return { presented: true, session: null, reason: "invalid" };
    }
    const session = machineSession({
      user: credential.owner,
      authenticationType: "api_key",
      scopes,
      credentialId: credential.id,
    });
    if (!session) return { presented: true, session: null, reason: "invalid" };
    await prisma.apiKey.update({ where: { id: credential.id }, data: { lastUsedAt: now } });
    return { presented: true, session };
  }

  if (parsed.kind === "oauth_access") {
    const tokenDigest = credentialDigest("oauth_access", parsed.token, pepper);
    const token = await prisma.oAuthToken.findUnique({
      where: { tokenDigest },
      select: {
        id: true,
        firmId: true,
        tokenType: true,
        status: true,
        scopes: true,
        expiresAt: true,
        user: { select: userSelect },
        client: { select: { id: true, firmId: true, status: true, allowedScopes: true } },
        consent: { select: { status: true, scopes: true } },
      },
    });
    if (
      !token ||
      token.tokenType !== "access_token" ||
      token.status !== "active" ||
      token.expiresAt <= now ||
      token.client?.status !== "active" ||
      token.client?.firmId !== token.firmId ||
      token.consent?.status !== "active" ||
      token.user?.activeFirm?.id !== token.firmId
    ) {
      return { presented: true, session: null, reason: "invalid" };
    }
    const baseSession = machineSession({
      user: token.user,
      authenticationType: "oauth",
      scopes: [],
      credentialId: token.id,
      oauthClientId: token.client.id,
    });
    const scopes = effectiveOAuthScopes(baseSession, {
      clientAllowedScopes: token.client.allowedScopes,
      consentScopes: token.consent.scopes,
      tokenScopes: token.scopes,
    });
    if (!baseSession || !scopes.length) return { presented: true, session: null, reason: "invalid" };
    const session = { ...baseSession, machineScopes: scopes } as Session;
    await prisma.oAuthToken.update({ where: { id: token.id }, data: { lastUsedAt: now } });
    return { presented: true, session };
  }

  const credential = await prisma.agentCredential.findUnique({
    where: { prefix: parsed.prefix },
    select: {
      id: true,
      firmId: true,
      secretHash: true,
      status: true,
      scopes: true,
      expiresAt: true,
      agentPrincipal: {
        select: {
          id: true,
          firmId: true,
          status: true,
          owner: { select: userSelect },
        },
      },
    },
  });
  if (
    !credential ||
    credential.status !== "active" ||
    (credential.expiresAt && credential.expiresAt <= now) ||
    credential.secretHash !== credentialDigest("agent", parsed.token, pepper) ||
    credential.agentPrincipal?.status !== "active" ||
    credential.agentPrincipal?.firmId !== credential.firmId ||
    credential.agentPrincipal?.owner?.activeFirm?.id !== credential.firmId
  ) {
    return { presented: true, session: null, reason: "invalid" };
  }
  let capabilities: string[];
  try {
    capabilities = normalizeAgentCapabilities(credential.scopes);
  } catch {
    return { presented: true, session: null, reason: "invalid" };
  }
  const session = machineSession({
    user: credential.agentPrincipal.owner,
    authenticationType: "agent",
    scopes: [],
    credentialId: credential.id,
    agentPrincipalId: credential.agentPrincipal.id,
    agentCapabilities: capabilities,
  });
  if (!session) return { presented: true, session: null, reason: "invalid" };
  await Promise.all([
    prisma.agentCredential.update({ where: { id: credential.id }, data: { lastUsedAt: now } }),
    prisma.agentPrincipal.update({ where: { id: credential.agentPrincipal.id }, data: { lastActiveAt: now } }),
  ]);
  return { presented: true, session };
}
