import Link from 'next/link'
import { NEUTRAL_FIRM_NAME } from './lib/accent'
import type { StorefrontSettings } from './lib/storefront-settings'
import { StoreLogo } from './StoreLogo'

/** Client-safe shared brand: header, native mobile menu and footer. */
export function StoreBrand({ settings }: { settings: Pick<StorefrontSettings, 'firmName' | 'logoIcon' | 'logoColor'> }) {
  const name = settings.firmName || NEUTRAL_FIRM_NAME
  return <Link href="/" className="sf-firm" aria-label={`${name} — home`}><StoreLogo icon={settings.logoIcon} hue={settings.logoColor} /><span className="sf-firm__name">{name}</span></Link>
}
