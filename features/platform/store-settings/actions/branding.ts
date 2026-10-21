'use server'

import { revalidatePath } from 'next/cache'
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo'
import { normalizeStoreLogoColor } from '@/features/shared/store-logo'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { STOREFRONT_ACCENT_PRESETS, normalizeAccentHex } from '@/features/storefront/lib/accent'

export type BrandingState = {
  message: string | null
  saved: boolean
  values: {
    name: string
    displayName: string
    shortName: string
    tagline: string
    accentId: string
    logoIcon: string
    logoColor: string
    supportEmail: string
  }
}

type BrandFirm = {
  id: string
  name: string
  displayName: string | null
  shortName: string | null
  brandTagline: string | null
  brandColor: string | null
  logoIcon: string | null
  logoColor: string | null
  supportEmail: string | null
}

/** Load failures, a genuinely firm-less workspace and a loaded firm are distinct states. */
export type BrandingSetup =
  | { status: 'loaded'; firm: BrandFirm }
  | { status: 'empty'; firm: null }
  | { status: 'error'; firm: null }

/** Read the current active firm's brand (auth-session scoped). */
export async function getBrandingSettings(): Promise<BrandingSetup> {
  const response = await keystoneClient<{ firms: BrandFirm[] }>(`
    query Branding {
      firms(take: 1) {
        id
        name
        displayName
        shortName
        brandTagline
        brandColor
        logoIcon
        logoColor
        supportEmail
      }
    }
  `)
  if (!response.success) return { status: 'error', firm: null }
  const firm = response.data?.firms?.[0] ?? null
  return firm ? { status: 'loaded', firm } : { status: 'empty', firm: null }
}

export async function saveBranding(
  _previous: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  const firmId = String(formData.get('firmId') ?? '').trim()
  const values = {
    name: String(formData.get('name') ?? '').trim(),
    displayName: String(formData.get('displayName') ?? '').trim(),
    shortName: String(formData.get('shortName') ?? '').trim(),
    tagline: String(formData.get('tagline') ?? '').trim(),
    accentId: String(formData.get('accentId') ?? '').trim(),
    logoIcon: sanitizeStoreLogoSvg(String(formData.get('logoIcon') ?? '')),
    logoColor: normalizeStoreLogoColor(formData.get('logoColor')),
    supportEmail: String(formData.get('supportEmail') ?? '').trim(),
  }

  if (!firmId) return { message: 'No active firm found to update.', saved: false, values }
  if (!values.name) return { message: 'Firm name is required.', saved: false, values }
  if (!values.logoIcon) return { message: 'Logo must be a safe SVG document.', saved: false, values }

  // Constrained accent: a known preset, logo-hue matching, or `current` to keep a
  // valid persisted non-preset color untouched (never silently neutralized).
  const preset = STOREFRONT_ACCENT_PRESETS.find((p) => p.id === values.accentId)
  if (!preset && values.accentId !== 'current') return { message: 'Choose an accent from the provided set.', saved: false, values }
  // Keystone's non-null text field represents "match logo hue" with an empty string,
  // not GraphQL null. Public normalization projects this from the logo hue.
  const brandColor = preset ? normalizeAccentHex(preset.hex) ?? '' : undefined

  const response = await keystoneClient<{ updateFirm: { id: string } }>(
    `mutation UpdateBranding($id: ID!, $data: FirmUpdateInput!) {
       updateFirm(where: { id: $id }, data: $data) { id }
     }`,
    {
      id: firmId,
      data: {
        name: values.name,
        displayName: values.displayName,
        shortName: values.shortName,
        brandTagline: values.tagline,
        ...(brandColor === undefined ? {} : { brandColor }),
        logoIcon: values.logoIcon,
        logoColor: values.logoColor,
        supportEmail: values.supportEmail,
      },
    },
  )

  if (!response.success) return { message: 'Branding could not be saved. Check the values and try again.', saved: false, values }

  // Reflect the change on the dashboard and the public storefront.
  revalidatePath('/dashboard/platform/branding')
  revalidatePath('/', 'layout')
  return { message: null, saved: true, values }
}