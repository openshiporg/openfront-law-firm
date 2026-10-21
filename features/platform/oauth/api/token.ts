import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { keystoneContext } from "@/features/keystone/context";
import {
  credentialDigest,
  effectiveOAuthScopes,
  issueCredential,
  loadActiveHumanSession,
  parseCredential,
  secretsMatch,
} from "@/features/keystone/lib/machine-auth";
import {
  prismaWithoutGraphQLErrorConversion,
  runSerializableTransaction,
} from "@/features/keystone/lib/transactions";
import { isOAuthFormContentType, OAuthFormError, readBoundedOAuthForm } from "../lib/boundedForm";

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { "cache-control": "no-store", pragma: "no-cache" } },
  );
}

function tokenResponse(accessToken: string, refreshToken: string, scopes: string[]) {
  return NextResponse.json(
    {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: scopes.join(" "),
    },
    { headers: { "cache-control": "no-store", pragma: "no-cache" } },
  );
}

function clientCredentials(request: Request, form: URLSearchParams) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, separator)),
          clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        };
      }
    } catch {
      return { clientId: "", clientSecret: "" };
    }
  }
  return {
    clientId: String(form.get("client_id") ?? ""),
    clientSecret: String(form.get("client_secret") ?? ""),
  };
}

function validVerifier(value: string) {
  return value.length >= 43 && value.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(value);
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function authenticateClient(request: Request, form: URLSearchParams) {
  const { clientId, clientSecret } = clientCredentials(request, form);
  const parsed = parseCredential(clientSecret);
  if (!clientId || !parsed || parsed.kind !== "oauth_client") return null;
  const prisma: typeof keystoneContext.prisma = prismaWithoutGraphQLErrorConversion(keystoneContext.prisma);
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: {
      id: true,
      firmId: true,
      status: true,
      clientSecretDigest: true,
    },
  });
  const presentedDigest = credentialDigest("oauth_client", clientSecret);
  if (
    !client ||
    client.status !== "active" ||
    !secretsMatch(client.clientSecretDigest, presentedDigest)
  ) {
    return null;
  }
  return client;
}

export async function POST(request: Request) {
  if (!isOAuthFormContentType(request.headers.get("content-type"))) {
    return oauthError("invalid_request", "OAuth token requests must use form encoding.", 415);
  }
  try {
    const form = await readBoundedOAuthForm(request);
    const grantType = String(form.get("grant_type") ?? "");
    if (!new Set(["authorization_code", "refresh_token"]).has(grantType)) {
      return oauthError("unsupported_grant_type", "Grant type is not supported.");
    }
    const client = await authenticateClient(request, form);
    if (!client) return oauthError("invalid_client", "Invalid client credentials.", 401);

    // Awaited so asynchronous exchange failures still reach this OAuth error envelope.
    if (grantType === "authorization_code") {
      return await exchangeAuthorizationCode(form, client);
    }
    return await exchangeRefreshToken(form, client);
  } catch (error) {
    if (error instanceof OAuthFormError) return oauthError("invalid_request", error.message, error.status);
    console.error("OAuth token request failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return oauthError("server_error", "OAuth token request could not be completed.", 500);
  }
}

async function exchangeAuthorizationCode(form: URLSearchParams, client: NonNullable<Awaited<ReturnType<typeof authenticateClient>>>) {
  const rawCode = String(form.get("code") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const verifier = String(form.get("code_verifier") ?? "");
  const parsed = parseCredential(rawCode);
  if (!parsed || parsed.kind !== "oauth_code" || !redirectUri || !validVerifier(verifier)) {
    return oauthError("invalid_request", "Code, redirect URI, and a valid PKCE verifier are required.");
  }
  const codeDigest = credentialDigest("oauth_code", rawCode);
  const prisma = keystoneContext.prisma;
  try {
    const issued = await runSerializableTransaction(prisma, async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`oauth-code:${codeDigest}`}))`;
      const code = await tx.oAuthToken.findUnique({
        where: { tokenDigest: codeDigest },
        include: { client: true, consent: true },
      });
      const currentUser = code ? await loadActiveHumanSession(tx, code.userId, code.firmId) : null;
      const now = new Date();
      if (
        !code ||
        code.tokenType !== "authorization_code" ||
        code.status !== "active" ||
        code.clientId !== client.id ||
        code.firmId !== client.firmId ||
        code.expiresAt <= now ||
        code.redirectUri !== redirectUri ||
        code.codeChallengeMethod !== "S256" ||
        !code.codeChallenge ||
        !secretsMatch(code.codeChallenge, pkceChallenge(verifier)) ||
        code.client?.status !== "active" ||
        code.consent?.status !== "active" ||
        !currentUser
      ) {
        throw new Error("invalid_grant");
      }
      const scopes = effectiveOAuthScopes(currentUser, {
        clientAllowedScopes: code.client?.allowedScopes,
        consentScopes: code.consent?.scopes,
        tokenScopes: code.scopes,
      });
      if (!scopes.length) throw new Error("invalid_grant");
      const access = issueCredential("oauth_access");
      const refresh = issueCredential("oauth_refresh");
      const familyId = randomUUID();
      await tx.oAuthToken.update({
        where: { id: code.id },
        data: { status: "consumed", consumedAt: now },
      });
      await Promise.all([
        tx.oAuthToken.create({
          data: {
            firmId: code.firmId,
            clientId: code.clientId,
            userId: code.userId,
            consentId: code.consentId,
            tokenType: "access_token",
            tokenDigest: access.digest,
            tokenPrefix: access.prefix,
            familyId,
            status: "active",
            scopes,
            parentTokenId: code.id,
            expiresAt: new Date(now.getTime() + 60 * 60_000),
          },
        }),
        tx.oAuthToken.create({
          data: {
            firmId: code.firmId,
            clientId: code.clientId,
            userId: code.userId,
            consentId: code.consentId,
            tokenType: "refresh_token",
            tokenDigest: refresh.digest,
            tokenPrefix: refresh.prefix,
            familyId,
            status: "active",
            scopes,
            parentTokenId: code.id,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
          },
        }),
      ]);
      await tx.auditEvent.create({
        data: {
          firmId: code.firmId,
          eventId: randomUUID(),
          eventType: "oauth.tokens_issued",
          category: "authentication",
          outcome: "succeeded",
          actorUserId: code.userId,
          actorType: "user",
          occurredAt: now,
          metadata: { oauthClientId: code.clientId, familyId, scopes },
        },
      });
      return { accessToken: access.token, refreshToken: refresh.token, scopes };
    });
    return tokenResponse(issued.accessToken, issued.refreshToken, issued.scopes);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_grant") {
      return oauthError("invalid_grant", "Authorization code is invalid, expired, or already used.");
    }
    throw error;
  }
}

async function exchangeRefreshToken(form: URLSearchParams, client: NonNullable<Awaited<ReturnType<typeof authenticateClient>>>) {
  const rawRefresh = String(form.get("refresh_token") ?? "");
  const parsed = parseCredential(rawRefresh);
  if (!parsed || parsed.kind !== "oauth_refresh") {
    return oauthError("invalid_request", "A valid refresh token is required.");
  }
  const refreshDigest = credentialDigest("oauth_refresh", rawRefresh);
  const prisma = keystoneContext.prisma;
  try {
    const issued = await runSerializableTransaction(prisma, async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`oauth-refresh:${refreshDigest}`}))`;
      const token = await tx.oAuthToken.findUnique({
        where: { tokenDigest: refreshDigest },
        include: { client: true, consent: true },
      });
      const currentUser = token ? await loadActiveHumanSession(tx, token.userId, token.firmId) : null;
      const now = new Date();
      if (
        !token ||
        token.tokenType !== "refresh_token" ||
        token.clientId !== client.id ||
        token.firmId !== client.firmId
      ) {
        throw new Error("invalid_grant");
      }
      if (token.status === "consumed" && token.familyId) {
        await tx.oAuthToken.updateMany({
          where: { familyId: token.familyId, status: "active" },
          data: { status: "revoked", revokedAt: now },
        });
        await tx.auditEvent.create({
          data: {
            firmId: token.firmId,
            eventId: randomUUID(),
            eventType: "oauth.refresh_reuse_rejected",
            category: "authentication",
            outcome: "denied",
            actorUserId: token.userId,
            actorType: "user",
            occurredAt: now,
            metadata: { oauthClientId: token.clientId, familyId: token.familyId },
          },
        });
        return { reused: true } as const;
      }
      if (
        token.status !== "active" ||
        !token.familyId ||
        token.expiresAt <= now ||
        token.client?.status !== "active" ||
        token.consent?.status !== "active" ||
        !currentUser
      ) {
        throw new Error("invalid_grant");
      }
      const scopes = effectiveOAuthScopes(currentUser, {
        clientAllowedScopes: token.client?.allowedScopes,
        consentScopes: token.consent?.scopes,
        tokenScopes: token.scopes,
      });
      if (!scopes.length) throw new Error("invalid_grant");
      const access = issueCredential("oauth_access");
      const refresh = issueCredential("oauth_refresh");
      await tx.oAuthToken.update({
        where: { id: token.id },
        data: { status: "consumed", consumedAt: now },
      });
      await Promise.all([
        tx.oAuthToken.create({
          data: {
            firmId: token.firmId,
            clientId: token.clientId,
            userId: token.userId,
            consentId: token.consentId,
            tokenType: "access_token",
            tokenDigest: access.digest,
            tokenPrefix: access.prefix,
            familyId: token.familyId,
            status: "active",
            scopes,
            parentTokenId: token.id,
            expiresAt: new Date(now.getTime() + 60 * 60_000),
          },
        }),
        tx.oAuthToken.create({
          data: {
            firmId: token.firmId,
            clientId: token.clientId,
            userId: token.userId,
            consentId: token.consentId,
            tokenType: "refresh_token",
            tokenDigest: refresh.digest,
            tokenPrefix: refresh.prefix,
            familyId: token.familyId,
            status: "active",
            scopes,
            parentTokenId: token.id,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
          },
        }),
      ]);
      return {
        reused: false,
        accessToken: access.token,
        refreshToken: refresh.token,
        scopes,
      } as const;
    });
    if (issued.reused) {
      return oauthError("invalid_grant", "Refresh token reuse was detected; the token family was revoked.");
    }
    return tokenResponse(issued.accessToken, issued.refreshToken, issued.scopes);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_grant") {
      return oauthError("invalid_grant", "Refresh token is invalid or expired.");
    }
    throw error;
  }
}
