import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { keystoneContext } from "@/features/keystone/context";
import {
  authenticatedUserId,
  requestHasTrustedOrigin,
} from "@/features/keystone/lib/authenticated-request";
import { sha256Digest } from "@/features/keystone/lib/digests";
import {
  effectiveOAuthScopes,
  issueCredential,
  loadActiveHumanSession,
  normalizeMachineScopes,
} from "@/features/keystone/lib/machine-auth";
import {
  prismaWithoutGraphQLErrorConversion,
  runSerializableTransaction,
} from "@/features/keystone/lib/transactions";
import { isOAuthFormContentType, OAuthFormError, readBoundedOAuthForm } from "../lib/boundedForm";

const prisma: typeof keystoneContext.prisma = prismaWithoutGraphQLErrorConversion(keystoneContext.prisma);

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function validState(value: string) {
  return value.length >= 16 && value.length <= 512 && /^[A-Za-z0-9._~-]+$/.test(value);
}

function validCodeChallenge(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

async function authorizationUser(userId: string, firmId: string, client: Pick<typeof keystoneContext.prisma, "user"> = prisma) {
  return loadActiveHumanSession(client, userId, firmId);
}

async function authorizationRequest(request: Request) {
  const params = new URL(request.url).searchParams;
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const responseType = params.get("response_type") ?? "";
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const codeChallengeMethod = params.get("code_challenge_method") ?? "";
  const requestedScopes = normalizeMachineScopes(
    (params.get("scope") ?? "").split(/\s+/).filter(Boolean),
  );
  if (
    !clientId ||
    responseType !== "code" ||
    !validState(state) ||
    codeChallengeMethod !== "S256" ||
    !validCodeChallenge(codeChallenge)
  ) {
    throw new Error("OAuth authorization requires code response type, state, and S256 PKCE.");
  }
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: {
      id: true,
      firmId: true,
      name: true,
      status: true,
      redirectUris: true,
      allowedScopes: true,
    },
  });
  if (!client || client.status !== "active") throw new Error("OAuth client is unavailable.");
  const redirectUris = Array.isArray(client.redirectUris) ? client.redirectUris : [];
  const allowedScopes = Array.isArray(client.allowedScopes) ? client.allowedScopes : [];
  if (!redirectUris.includes(redirectUri)) throw new Error("Redirect URI is not registered.");
  if (requestedScopes.some((scope) => !allowedScopes.includes(scope))) {
    throw new Error("Requested scope is not allowed for this client.");
  }
  return { client, redirectUri, requestedScopes, state, codeChallenge };
}

export async function GET(request: Request) {
  try {
    const userId = await authenticatedUserId(request);
    if (!userId) return oauthError("login_required", "Sign in before authorizing an application.", 401);
    const authorization = await authorizationRequest(request);
    const user = await authorizationUser(userId, authorization.client.firmId);
    if (!user) return oauthError("access_denied", "The user is not active in the OAuth client's firm.", 403);
    const scopes = effectiveOAuthScopes(user, {
      clientAllowedScopes: authorization.client.allowedScopes,
      consentScopes: authorization.requestedScopes,
      tokenScopes: authorization.requestedScopes,
    });
    if (scopes.length !== authorization.requestedScopes.length) {
      return oauthError("access_denied", "One or more requested scopes exceed the user's current firm permissions.", 403);
    }

    const scopeList = scopes
      .map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`)
      .join("");
    const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize ${escapeHtml(authorization.client.name)}</title></head>
<body><main><h1>Authorize ${escapeHtml(authorization.client.name)}</h1><p>Signed in as ${escapeHtml(user.data.name)}. Review the exact requested access:</p><ul>${scopeList}</ul>
<form method="post"><button name="decision" value="approve" type="submit">Approve</button><button name="decision" value="deny" type="submit">Deny</button></form>
</main></body></html>`;
    return new NextResponse(page, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        "referrer-policy": "same-origin",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return oauthError(
      "invalid_request",
      error instanceof Error ? error.message : "Invalid OAuth authorization request.",
    );
  }
}

export async function POST(request: Request) {
  if (!isOAuthFormContentType(request.headers.get("content-type"))) {
    return oauthError("invalid_request", "OAuth consent requests must use form encoding.", 415);
  }
  if (!requestHasTrustedOrigin(request)) {
    return oauthError("invalid_request", "OAuth consent requires a trusted same-origin request.", 403);
  }
  let form: URLSearchParams;
  try {
    form = await readBoundedOAuthForm(request);
  } catch (error) {
    if (error instanceof OAuthFormError) return oauthError("invalid_request", error.message, error.status);
    throw error;
  }
  try {
    const userId = await authenticatedUserId(request);
    if (!userId) return oauthError("login_required", "Sign in before authorizing an application.", 401);
    const authorization = await authorizationRequest(request);
    const decision = String(form.get("decision") ?? "");
    if (!new Set(["approve", "deny"]).has(decision)) {
      return oauthError("invalid_request", "Invalid OAuth consent decision.");
    }
    const issuedCode = decision === "approve" ? issueCredential("oauth_code") : null;
    const result = await runSerializableTransaction(prisma, async (tx: Prisma.TransactionClient) => {
      const lockKey = `oauth-consent:${authorization.client.firmId}:${authorization.client.id}:${userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const [user, currentClient] = await Promise.all([
        authorizationUser(userId, authorization.client.firmId, tx),
        tx.oAuthClient.findUnique({ where: { id: authorization.client.id } }),
      ]);
      if (!user) throw new Error("access_denied");
      const redirectUris = Array.isArray(currentClient?.redirectUris) ? currentClient.redirectUris : [];
      const allowedScopes = Array.isArray(currentClient?.allowedScopes) ? currentClient.allowedScopes : [];
      if (
        !currentClient ||
        currentClient.status !== "active" ||
        currentClient.firmId !== authorization.client.firmId ||
        !redirectUris.includes(authorization.redirectUri) ||
        authorization.requestedScopes.some((scope) => !allowedScopes.includes(scope))
      ) {
        throw new Error("invalid_grant");
      }
      const now = new Date();
      let codeToken: string | null = null;
      const scopes = decision === "approve" ? effectiveOAuthScopes(user, {
        clientAllowedScopes: currentClient.allowedScopes,
        consentScopes: authorization.requestedScopes,
        tokenScopes: authorization.requestedScopes,
      }) : [];
      if (decision === "approve" && scopes.length !== authorization.requestedScopes.length) {
        throw new Error("access_denied");
      }
      if (decision === "approve") {
        const recentCodes = await tx.oAuthToken.count({
          where: {
            clientId: currentClient.id,
            userId,
            tokenType: "authorization_code",
            createdAt: { gte: new Date(now.getTime() - 60_000) },
          },
        });
        if (recentCodes >= 10) throw new Error("temporarily_unavailable");
        const consentDigest = sha256Digest({
          clientId: currentClient.id,
          userId,
          firmId: currentClient.firmId,
          scopes,
          grantedAt: now.toISOString(),
        });
        const existing = await tx.oAuthConsent.findFirst({
          where: { clientId: currentClient.id, userId, firmId: currentClient.firmId },
        });
        const consent = existing
          ? await tx.oAuthConsent.update({
              where: { id: existing.id },
              data: { status: "active", scopes, consentDigest, grantedAt: now, revokedAt: null },
            })
          : await tx.oAuthConsent.create({
              data: {
                firmId: currentClient.firmId,
                clientId: currentClient.id,
                userId,
                status: "active",
                scopes,
                consentDigest,
                grantedAt: now,
              },
            });
        await tx.oAuthToken.create({
          data: {
            firmId: currentClient.firmId,
            clientId: currentClient.id,
            userId,
            consentId: consent.id,
            tokenType: "authorization_code",
            tokenDigest: issuedCode!.digest,
            tokenPrefix: issuedCode!.prefix,
            status: "active",
            scopes,
            redirectUri: authorization.redirectUri,
            state: authorization.state,
            codeChallenge: authorization.codeChallenge,
            codeChallengeMethod: "S256",
            expiresAt: new Date(now.getTime() + 10 * 60_000),
          },
        });
        codeToken = issuedCode!.token;
      }
      await tx.auditEvent.create({
        data: {
          firmId: currentClient.firmId,
          eventId: randomUUID(),
          eventType: decision === "approve" ? "oauth.consent_granted" : "oauth.consent_denied",
          category: "authentication",
          outcome: "succeeded",
          actorUserId: userId,
          actorType: "user",
          occurredAt: now,
          metadata: { oauthClientId: currentClient.id, scopes }
        },
      });
      return { codeToken, approved: decision === "approve" };
    });

    const redirect = new URL(authorization.redirectUri);
    redirect.searchParams.set("state", authorization.state);
    if (result.approved) redirect.searchParams.set("code", result.codeToken!);
    else redirect.searchParams.set("error", "access_denied");
    return NextResponse.redirect(redirect, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    if (new Set(["invalid_grant", "access_denied", "temporarily_unavailable"]).has(message)) {
      return oauthError(message, "OAuth consent is invalid, unavailable, or expired.", message === "temporarily_unavailable" ? 429 : 400);
    }
    return oauthError("server_error", "OAuth consent could not be recorded.", 500);
  }
}
