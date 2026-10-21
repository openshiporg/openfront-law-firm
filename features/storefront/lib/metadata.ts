import type { Metadata } from "next"

import { getStorefrontSettings, NEUTRAL_FIRM_NAME } from "./storefront-settings"

/**
 * Firm-branded page metadata for the public storefront. The page/site title
 * suffix comes from persisted settings, so the public site never hardcodes a
 * demo firm identity; when unset it degrades to a neutral name.
 */
export async function firmMetadata(pageTitle: string | null): Promise<Metadata> {
  const settings = await getStorefrontSettings()
  const name = settings.firmName || NEUTRAL_FIRM_NAME
  const title = pageTitle ? `${pageTitle} — ${name}` : name
  // Descriptions repeat only what the firm itself configured; no practice or
  // credential claims are synthesized for search or social previews.
  const description = settings.tagline || (settings.isConfigured ? `${name} — public information and client portal.` : 'Public information and client portal.')
  return { title: { absolute: title }, description, openGraph: { title, description } }
}