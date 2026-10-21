import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { getBrandingSettings } from '../actions/branding'
import { BrandingSettingsClient } from './BrandingSettingsClient'

export async function BrandingPage() {
  const setup = await getBrandingSettings()
  return (
    <PracticePage
      title="Store Settings"
      description="Firm identity, logo and storefront accent"
    >
      <BrandingSettingsClient setup={setup} />
    </PracticePage>
  )
}