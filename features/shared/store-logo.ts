import { LOGO_ICONS } from '../platform/store-settings/lib/untitled-logo-registry'
import { sanitizeStoreLogoSvg } from './sanitize-store-logo'

export const DEFAULT_STORE_LOGO_ICON = LOGO_ICONS[0].lightSvg
export function normalizeStoreLogoColor(value: unknown): string {
  const numeric = Number(String(value ?? '0'))
  if (!Number.isFinite(numeric)) return '0'
  return String(((numeric % 360) + 360) % 360)
}
export function safeStoreLogo(value: unknown) {
  return typeof value === 'string' && sanitizeStoreLogoSvg(value) || DEFAULT_STORE_LOGO_ICON
}
