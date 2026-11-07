import type { CSSProperties } from 'react'

/** Only an authenticated firm DTO or already-public identity may enter here.
 * Unvalidated invitation/sign-in tokens never select theme or reveal a tenant.
 * Altair keeps one brass accent on its dark ground; the stored logo hue only turns the logo. */
export function portalThemeStyle(brand: { logoColor?: string | null; brandColor?: string | null; accentHex?: string | null; isConfigured?: boolean }): CSSProperties & Record<`--${string}`, string> {
  if (brand.isConfigured === false) return { '--portal-accent': 'var(--foreground)' }
  return { '--ring': '#cdae78', '--portal-accent': '#b9965b' }
}
