import { NextResponse } from "next/server";

import { getRequestOrigin } from "@/features/dashboard/lib/internalAppOrigin";

function dashboardPath(value: string | null) {
  if (!value) return "/dashboard";
  try {
    const parsed = new URL(value, "https://internal.invalid");
    if (
      parsed.origin !== "https://internal.invalid" ||
      !parsed.pathname.startsWith("/dashboard") ||
      parsed.pathname.startsWith("/dashboard/no-access")
    ) {
      return "/dashboard";
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/dashboard";
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const publicOrigin = getRequestOrigin(request);
  const requestedPath = dashboardPath(requestUrl.searchParams.get("from"));
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie || cookie.length > 16_384) {
    return NextResponse.redirect(new URL(`/dashboard/signin?from=${encodeURIComponent(requestedPath)}`, publicOrigin), 303);
  }
  try {
    const endpoint = new URL("/api/graphql", publicOrigin);
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "manual",
      cache: "no-store",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        query: `query SessionContinuation {
          authenticatedItem { ... on User { id } }
          viewerNeedsFirmOnboarding
          viewerCanAccessDashboard
        }`,
      }),
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) {
      throw new Error("Session continuation lookup failed.");
    }
    const payload = await response.json() as {
      data?: {
        authenticatedItem?: { id: string } | null;
        viewerNeedsFirmOnboarding?: boolean;
        viewerCanAccessDashboard?: boolean;
      };
      errors?: unknown[];
    };
    const data = payload.data;
    if (payload.errors?.length || !data?.authenticatedItem) {
      return NextResponse.redirect(new URL(`/dashboard/signin?from=${encodeURIComponent(requestedPath)}`, publicOrigin), 303);
    }
    if (data.viewerNeedsFirmOnboarding) {
      return NextResponse.redirect(
        new URL(`/dashboard/onboarding?from=${encodeURIComponent(requestedPath)}`, publicOrigin),
        303,
      );
    }
    const destination = data.viewerCanAccessDashboard ? requestedPath : "/dashboard/no-access";
    return NextResponse.redirect(new URL(destination, publicOrigin), 303);
  } catch {
    return NextResponse.redirect(new URL("/dashboard/signin", publicOrigin), 303);
  }
}
