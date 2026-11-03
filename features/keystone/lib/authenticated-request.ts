import { getRequestOrigin } from "../../dashboard/lib/internalAppOrigin";
import { clientSourceFromHeaders, internalGraphqlEndpoint, internalIdentityHeaders } from "./internal-origin";

const authenticatedItemQuery = `
  query AuthenticatedOAuthUser {
    authenticatedItem {
      ... on User { id }
    }
    viewerCanAccessDashboard
  }
`;

export async function authenticatedUserId(
  request: Request,
  fetchImpl: typeof fetch = fetch,
  options: { requireDashboard?: boolean } = {},
) {
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie || cookie.length > 16_384) return null;
  // Server-to-self: loopback with THIS request's signed end-user identity; public origin only if PORT is unknown.
  const loopback = internalGraphqlEndpoint();
  const endpoint = new URL(loopback ?? "/api/graphql", loopback ? undefined : getRequestOrigin(request));
  const response = await fetchImpl(endpoint, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      cookie,
      ...(loopback ? internalIdentityHeaders(clientSourceFromHeaders(request.headers)) : {}),
    },
    body: JSON.stringify({ query: authenticatedItemQuery }),
  });
  if (!response.ok || response.status >= 300) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  const payload = await response.json() as {
    data?: { authenticatedItem?: { id?: unknown } | null; viewerCanAccessDashboard?: unknown };
    errors?: unknown[];
  };
  if (payload.errors?.length) return null;
  const id = payload.data?.authenticatedItem?.id;
  if (options.requireDashboard && payload.data?.viewerCanAccessDashboard !== true) return null;
  return typeof id === "string" && id ? id : null;
}

export function requestHasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(getRequestOrigin(request)).origin;
  } catch {
    return false;
  }
}
