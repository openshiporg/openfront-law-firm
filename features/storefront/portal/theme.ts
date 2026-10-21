import type { CSSProperties } from 'react'
import { accentContrastOnPaper, resolveStorefrontAccent, storefrontThemeVariables } from '../lib/accent'
import { normalizeStoreLogoColor } from '@/features/shared/store-logo'

/** Only an authenticated firm DTO or already-public identity may enter here.
 * Unvalidated invitation/sign-in tokens never select theme or reveal a tenant. */
export function portalThemeStyle(brand: { logoColor?: string | null; brandColor?: string | null; accentHex?: string | null; isConfigured?: boolean }): CSSProperties & Record<`--${string}`, string> {
  if (brand.isConfigured === false) return { '--portal-accent': 'var(--foreground)' }
  const accent = resolveStorefrontAccent(brand.accentHex ?? brand.brandColor)
  // Submit text is white, so use the stricter text contrast, not only focus3:1.
  const variables = storefrontThemeVariables({ accentHex: accent && accentContrastOnPaper(accent) >= 4.5 ? accent : null, logoColor: normalizeStoreLogoColor(brand.logoColor) })
  return { ...variables, '--ring': variables['--sf-focus'], '--portal-accent': variables['--sf-accent'] }
}
