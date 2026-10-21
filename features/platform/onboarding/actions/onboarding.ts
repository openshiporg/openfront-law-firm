'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { sanitizeStoreLogoSvg } from '@/features/shared/sanitize-store-logo';
import { normalizeStoreLogoColor } from '@/features/shared/store-logo';
import { STOREFRONT_ACCENT_PRESETS } from '@/features/storefront/lib/accent';

export type OnboardingState = {
  message: string | null;
  redirectTo: string | null;
  values: {
    firmName: string;
    firmSlug: string;
    firmDisplayName: string;
    firmShortName: string;
    brandTagline: string;
    accentId: string;
    logoIcon: string;
    logoColor: string;
    supportEmail: string;
    officeName: string;
    officeCode: string;
    timezone: string;
    currencyCode: string;
    practiceAreaName: string;
    seedSyntheticDemo: boolean;
  };
};

export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const values = {
    firmName: String(formData.get('firmName') ?? ''),
    firmSlug: String(formData.get('firmSlug') ?? ''),
    firmDisplayName: String(formData.get('firmDisplayName') ?? ''),
    firmShortName: String(formData.get('firmShortName') ?? ''),
    brandTagline: String(formData.get('brandTagline') ?? ''),
    accentId: String(formData.get('accentId') ?? 'muted'),
    logoIcon: String(formData.get('logoIcon') ?? ''),
    logoColor: normalizeStoreLogoColor(formData.get('logoColor')),
    supportEmail: String(formData.get('supportEmail') ?? ''),
    officeName: String(formData.get('officeName') ?? ''),
    officeCode: String(formData.get('officeCode') ?? ''),
    timezone: String(formData.get('timezone') ?? 'UTC'),
    currencyCode: String(formData.get('currencyCode') ?? 'USD'),
    practiceAreaName: String(formData.get('practiceAreaName') ?? ''),
    seedSyntheticDemo: formData.get('seedSyntheticDemo') === 'yes',
  };
  // Onboarding and Store Settings share one accent vocabulary: a palette preset,
  // or "match logo hue" (no explicit brand color).
  const accent = STOREFRONT_ACCENT_PRESETS.find((preset) => preset.id === values.accentId);
  if (!accent) return { message: 'Choose an accent from the provided set.', values, redirectTo: null };
  const logoIcon = sanitizeStoreLogoSvg(values.logoIcon);
  if (!logoIcon) return { message: 'Logo must be a safe SVG document.', values, redirectTo: null };
  const response = await keystoneClient<{ completeFirmOnboarding: { firm: { id: string } } }>(`
    mutation CompleteFirmOnboarding(
      $firmName: String!
      $firmSlug: String!
      $firmDisplayName: String
      $firmShortName: String
      $brandTagline: String
      $brandColor: String
      $logoIcon: String
      $logoColor: String
      $supportEmail: String
      $officeName: String!
      $officeCode: String!
      $timezone: String!
      $currencyCode: String!
      $practiceAreaName: String
      $seedSyntheticDemo: Boolean
    ) {
      completeFirmOnboarding(
        firmName: $firmName
        firmSlug: $firmSlug
        firmDisplayName: $firmDisplayName
        firmShortName: $firmShortName
        brandTagline: $brandTagline
        brandColor: $brandColor
        logoIcon: $logoIcon
        logoColor: $logoColor
        supportEmail: $supportEmail
        officeName: $officeName
        officeCode: $officeCode
        timezone: $timezone
        currencyCode: $currencyCode
        practiceAreaName: $practiceAreaName
        seedSyntheticDemo: $seedSyntheticDemo
      ) { firm { id } }
    }
  `, {
    firmName: values.firmName,
    firmSlug: values.firmSlug,
    firmDisplayName: values.firmDisplayName,
    firmShortName: values.firmShortName,
    brandTagline: values.brandTagline,
    brandColor: accent.hex,
    logoIcon,
    logoColor: values.logoColor,
    supportEmail: values.supportEmail,
    officeName: values.officeName,
    officeCode: values.officeCode,
    timezone: values.timezone,
    currencyCode: values.currencyCode,
    practiceAreaName: values.practiceAreaName.trim() || null,
    seedSyntheticDemo: values.seedSyntheticDemo,
  });
  if (!response.success) return { message: response.error, values, redirectTo: null };
  return {
    message: null,
    values,
    redirectTo: '/api/auth/continue?from=%2Fdashboard',
  };
}

// The shared Sidebar's onboarding card calls this on "Skip for now". Law Firm has no updateActiveUser
// mutation, so the viewer updates their own onboarding status (User update access allows self-updates).
export async function dismissOnboarding() {
  const viewer = await keystoneClient<{ authenticatedItem: { id: string } | null }>(`
    query OnboardingViewer { authenticatedItem { ... on User { id } } }
  `);
  if (!viewer.success) return { success: false, error: viewer.error };
  if (!viewer.data.authenticatedItem) return { success: false, error: 'Sign in to update onboarding.' };

  const response = await keystoneClient<{ updateUser: { id: string; onboardingStatus: string } | null }>(`
    mutation DismissOnboarding($id: ID!) {
      updateUser(where: { id: $id }, data: { onboardingStatus: dismissed }) { id onboardingStatus }
    }
  `, { id: viewer.data.authenticatedItem.id });
  if (!response.success) return { success: false, error: response.error };

  revalidatePath('/dashboard');
  return { success: true, data: response.data.updateUser };
}

/**
 * Pre-submit availability of the fictional sample setup. The onboarding command
 * still enforces fixture admission and authority itself; this only lets the form
 * show the option as unavailable instead of letting the transaction fail.
 */
export async function getSyntheticSeedAvailability(): Promise<boolean> {
  const response = await keystoneClient<{ viewerCanSeedSyntheticDemo: boolean }>(`
    query SyntheticSeedAvailability { viewerCanSeedSyntheticDemo }
  `);
  return response.success && response.data.viewerCanSeedSyntheticDemo === true;
}
