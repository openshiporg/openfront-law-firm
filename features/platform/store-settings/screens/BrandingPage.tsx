import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { getBrandingSettings } from '../actions/branding'
import { BrandingSettingsClient } from './BrandingSettingsClient'
import { getPublicSiteSetup } from '@/features/platform/public-site/actions/publicSite'

export async function BrandingPage() {
  const [setup, site] = await Promise.all([getBrandingSettings(), getPublicSiteSetup()])
  const policy = site.status === 'loaded' ? site.policy : null
  const publication = policy?.status !== 'published' ? 'unpublished' : policy.publicBookingEnabled ? 'booking' : 'published'
  return (
    <PracticePage
      title="Store Settings"
      description="Firm identity, logo and storefront accent"
    >
      <BrandingSettingsClient setup={setup} publication={publication} />
    </PracticePage>
  )
}
