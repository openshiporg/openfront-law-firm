import type { NextRequest } from "next/server";
import { handleDashboardRoutes, getAuthenticatedUser } from "@/features/dashboard/middleware";
import { handleStorefrontRoutes } from "@/features/storefront/middleware";
import { NextResponse } from "next/server";
import { isDashboardRoute } from "@/features/dashboard/lib/authFlow";

const dashboardPath = "/dashboard";

/**
 * The Railway-generated host is not where people should sign in: Stripe and email links
 * return to the canonical domain, and session cookies are per host. Pages on the
 * *.up.railway.app host redirect (308, path and query kept) to the configured origin.
 * API routes are excluded by the matcher, so webhooks, health checks and tools still work.
 */
function canonicalRedirect(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  if (!host.endsWith(".up.railway.app")) return null;
  const configured = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  let origin: URL;
  try { origin = new URL(configured); } catch { return null; }
  if (origin.protocol !== "https:" || origin.hostname === host || origin.hostname.endsWith(".up.railway.app")) return null;
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, origin.origin);
  return NextResponse.redirect(target, 308);
}

// Main middleware function that handles all routes
export async function proxy(request: NextRequest) {
  const canonical = canonicalRedirect(request);
  if (canonical) return canonical;
  // Get authenticated user once
  const { user, redirectToInit } = await getAuthenticatedUser(request);

  // If redirectToInit is true (no users exist) and user is on storefront, redirect to dashboard init
  if (redirectToInit && !isDashboardRoute(request.nextUrl.pathname, "init")) {
    return NextResponse.redirect(new URL(`${dashboardPath}/init`, request.url));
  }

  // Let each handler manage its own routes and logic
  const response = await handleDashboardRoutes(request, user, redirectToInit);
  
  // If dashboard handler didn't handle the route, pass to storefront
  if (!response) {
    return handleStorefrontRoutes(request, user);
  }
  
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.svg|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
};