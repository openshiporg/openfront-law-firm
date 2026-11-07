import Link from 'next/link'
import { NEUTRAL_FIRM_NAME } from './lib/accent'
import type { StorefrontSettings } from './lib/storefront-settings'
import { StoreLogo } from './StoreLogo'

/** Client-safe shared brand: header, native mobile menu and footer. Wordmark, brass rule, then the office's town. */
export function StoreBrand({ settings, place }: { settings: Pick<StorefrontSettings, 'firmName' | 'logoIcon' | 'logoColor'>; place?: string | null }) {
  const name = settings.firmName || NEUTRAL_FIRM_NAME
  return <Link href="/" className="sf-firm" aria-label={`${name} — home`}>
    <span className="sf-firm__row"><StoreLogo icon={settings.logoIcon} hue={settings.logoColor} /><span className="sf-firm__name">{name}</span></span>
    <span className="sf-firm__rule" aria-hidden="true" />
    {place ? <span className="sf-firm__place">{place}</span> : null}
  </Link>
}
