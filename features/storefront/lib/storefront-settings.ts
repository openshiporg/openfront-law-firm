import { keystoneContext } from "@/features/keystone/context"
import { connection } from 'next/server'
import { NEUTRAL_FIRM_NAME, resolveStorefrontAccent } from "./accent"
import { safeStoreLogo, normalizeStoreLogoColor } from '@/features/shared/store-logo'
import { isLocalFixtureFirm } from '@/features/keystone/lib/local-fixture'

/**
 * Public storefront projection of platform-owned firm settings.
 *
 * The public storefront reads only publishable firm identity/theme from the
 * persisted `Firm` record (the platform-owned, operator-configured settings),
 * never a baked-in demo identity. When no published firm is configured, the
 * projection returns a truthful "unset" state so the site degrades to a
 * neutral, honest storefront rather than pretending to be any specific firm.
 */

/** Firm-published customer capabilities and the firm's own public text. */
export type StorefrontPublication = {
  mode: 'fixture' | 'live' | 'closed'
  privacyNotice: string | null
  privacyNoticeVersion: number
  firstContactNotice: string | null
  firstContactNoticeVersion: number
  aboutStatement: string | null
}

export type StorefrontSettings = {
  firmName: string | null
  tagline: string | null
  accentHex: string | null
  supportEmail: string | null
  logoIcon: string
  logoColor: string
  isLocalFictional: boolean
  isConfigured: boolean
  /** Customer accounts are open (owned offline fixture, or the firm published them). */
  accountsEnabled: boolean
  /** Consultation booking is open; the booking command re-checks this itself. */
  bookingEnabled: boolean
  publication: StorefrontPublication
}

const CLOSED_PUBLICATION: StorefrontPublication = { mode: 'closed', privacyNotice: null, privacyNoticeVersion: 0, firstContactNotice: null, firstContactNoticeVersion: 0, aboutStatement: null }

type PolicyRow = {
  publicAccountsEnabled?: boolean | null
  publicBookingEnabled?: boolean | null
  privacyNotice?: string | null
  privacyNoticeVersion?: number | null
  firstContactNotice?: string | null
  firstContactNoticeVersion?: number | null
  aboutStatement?: string | null
}

/** Mirrors the server admission rules in customerConsultations.publicFirm (display only). */
async function publishedPolicy(firmId: string): Promise<{ publication: StorefrontPublication; accountsEnabled: boolean; bookingEnabled: boolean }> {
  let policy: PolicyRow | null = null
  try {
    const rows = (await keystoneContext.sudo().query.PublicSitePolicy.findMany({
      where: { firm: { id: { equals: firmId } }, status: { equals: "published" } },
      take: 1,
      query: "publicAccountsEnabled publicBookingEnabled privacyNotice privacyNoticeVersion firstContactNotice firstContactNoticeVersion aboutStatement",
    })) as unknown as PolicyRow[]
    policy = rows?.[0] ?? null
  } catch {
    policy = null
  }
  if (!policy) return { publication: CLOSED_PUBLICATION, accountsEnabled: false, bookingEnabled: false }
  const privacyNotice = policy.privacyNotice?.trim() || null
  const firstContactNotice = policy.firstContactNotice?.trim() || null
  const accountsEnabled = Boolean(policy.publicAccountsEnabled && privacyNotice)
  return {
    publication: {
      mode: 'live',
      privacyNotice,
      privacyNoticeVersion: Number(policy.privacyNoticeVersion ?? 0),
      firstContactNotice,
      firstContactNoticeVersion: Number(policy.firstContactNoticeVersion ?? 0),
      aboutStatement: policy.aboutStatement?.trim() || null,
    },
    accountsEnabled,
    bookingEnabled: Boolean(accountsEnabled && policy.publicBookingEnabled && firstContactNotice),
  }
}

/**
 * Read the persisted, published firm identity/theme and return only the
 * publishable fields. Server-side only; internal firm/control fields are never
 * exposed. Falls back to a truthful unset state on any failure.
 */
export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  // Mutable branding and fixture admission must not freeze at build time.
  await connection()
  interface FirmRow {
    id: string
    name?: string | null
    displayName?: string | null
    brandTagline?: string | null
    brandColor?: string | null
    supportEmail?: string | null
    status?: string | null
    isDemo?: boolean | null
    logoIcon?: string | null
    logoColor?: string | null
  }
  let firm: FirmRow | null = null

  try {
    const rows = (await keystoneContext.sudo().query.Firm.findMany({
      where: { status: { equals: "active" } },
      take: 2,
      query: "id name displayName brandTagline brandColor supportEmail status isDemo logoIcon logoColor",
    })) as unknown as FirmRow[]
    firm = rows?.length === 1 ? rows[0] : null
  } catch {
    firm = null
  }

  // Published identity requires active configuration, not legal authority.
  // Onboarding/suspended/closed, or no firm at all, is a truthful unset state.
  if (!firm || firm.status !== "active") {
    return { firmName: null, tagline: null, accentHex: null, supportEmail: null, logoIcon: safeStoreLogo(null), logoColor: '0', isLocalFictional: false, isConfigured: false, accountsEnabled: false, bookingEnabled: false, publication: CLOSED_PUBLICATION }
  }

  const firmName = (firm.displayName || firm.name || "").trim() || null
  const candidateEmail = firm.supportEmail?.trim() || ""
  const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail) ? candidateEmail : null
  const isLocalFictional = await isLocalFixtureFirm(keystoneContext.prisma, firm.id)
  // Synthetic firms outside the owned fixture are never published as a real firm.
  const published = isLocalFictional
    ? { publication: { ...CLOSED_PUBLICATION, mode: 'fixture' as const }, accountsEnabled: true, bookingEnabled: true }
    : firm.isDemo ? { publication: CLOSED_PUBLICATION, accountsEnabled: false, bookingEnabled: false } : await publishedPolicy(firm.id)
  return {
    firmName,
    isLocalFictional,
    ...published,
    logoIcon: safeStoreLogo(firm.logoIcon),
    logoColor: normalizeStoreLogoColor(firm.logoColor),
    tagline: firm.brandTagline?.trim() || null,
    accentHex: resolveStorefrontAccent(firm.brandColor),
    supportEmail,
    isConfigured: Boolean(firmName),
  }
}

export { NEUTRAL_FIRM_NAME }