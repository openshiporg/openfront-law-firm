/**
 * Client-safe storefront accent constants and helpers (no server imports).
 * Shared by the public storefront, onboarding and the dashboard branding settings picker.
 */
import { normalizeStoreLogoColor } from '@/features/shared/store-logo'

/**
 * Constrained accent palette — the operator picks an explicit accent from this
 * fixed set (mirrors the Ecommerce/Store store-settings color picker, which
 * constrains the operator to a curated palette rather than a free wheel). The
 * unset option derives the public accent from the persisted logo hue.
 */
export const STOREFRONT_ACCENT_PRESETS = [
  { id: "walnut",  hex: "#8a5a33", label: "Walnut" },
  { id: "oxblood", hex: "#6e2b2f", label: "Oxblood" },
  { id: "forest",  hex: "#2f5d50", label: "Forest" },
  { id: "slate",   hex: "#35556b", label: "Slate" },
  { id: "muted",   hex: null,      label: "Match logo hue", unset: true },
] as const

/** Neutral fallback used when no firm identity is configured (truthful unset). */
export const NEUTRAL_FIRM_NAME = "Law Firm"

export type AccentPreset = (typeof STOREFRONT_ACCENT_PRESETS)[number]

/** Persisted brand color is constrained to a valid six-digit hex, else unset. */
export function normalizeAccentHex(value?: string | null): string | null {
  const v = value?.trim().toLowerCase() ?? ""
  return /^#[0-9a-f]{6}$/.test(v) ? v : null
}

function channel(value: number) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

// Relative luminance of the storefront paper token, oklch(0.955 0.010 78).
const PAPER_LUMINANCE = 0.87

/** WCAG contrast ratio of an accent against the storefront paper. */
export function accentContrastOnPaper(hex: string) {
  return (PAPER_LUMINANCE + 0.05) / (relativeLuminance(hex) + 0.05)
}

/**
 * Resolve a persisted accent. Any valid persisted color is kept (onboarding and
 * earlier settings may have stored a non-preset color); one too light to read
 * on paper (below 3:1) falls back to the logo-hue accent instead of rendering
 * an invisible highlight.
 */
export function resolveStorefrontAccent(value?: string | null): string | null {
  const hex = normalizeAccentHex(value)
  if (!hex) return null
  return accentContrastOnPaper(hex) >= 3 ? hex : null
}

/** Map a persisted hex back to a preset id; `current` keeps a valid non-preset color. */
export function accentIdFromHex(value?: string | null): string {
  const normalized = normalizeAccentHex(value)
  if (!normalized) return "muted"
  const preset = STOREFRONT_ACCENT_PRESETS.find((p) => p.hex === normalized)
  return preset ? preset.id : "current"
}

/** Untitled UI library marks are drawn around this hue; hue-rotate(logoColor) moves them. */
export const STORE_LOGO_BASE_HUE = 260

/** Hue the visitor actually sees in the logo after the persisted hue rotation. */
export function storefrontBrandHue(logoColor?: string | null) {
  return (STORE_LOGO_BASE_HUE + Number(normalizeStoreLogoColor(logoColor))) % 360
}

/**
 * One storefront-scoped theme contract: the logo hue drives the public accent,
 * focus ring and brand marks unless the operator chose an explicit accent.
 * Lightness is fixed so every hue keeps the same contrast on paper.
 */
export function storefrontThemeVariables({ accentHex, logoColor }: { accentHex: string | null; logoColor: string }) {
  const brandHue = storefrontBrandHue(logoColor)
  return {
    "--sf-logo-hue": normalizeStoreLogoColor(logoColor),
    "--sf-brand-hue": String(brandHue),
    "--sf-accent": accentHex ?? `oklch(0.460 0.100 ${brandHue})`,
    "--sf-focus": accentHex ?? `oklch(0.540 0.140 ${brandHue})`,
  }
}
