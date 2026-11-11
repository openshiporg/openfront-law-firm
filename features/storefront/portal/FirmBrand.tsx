import { NEUTRAL_FIRM_NAME } from '../lib/accent'
import { StoreLogo } from '../StoreLogo'

export type PortalBrand = {
  name: string | null
  displayName?: string | null
  brandTagline?: string | null
  logoIcon?: string | null
  logoColor?: string | null
}

/**
 * Portal lockup (mark and name only): the same sanitized StoreLogo renderer and persisted logo/hue as
 * the public storefront. Callers pass only a session-bound or published brand;
 * an unverified visitor gets the neutral fallback.
 */
export function FirmBrand({ brand }: { brand: PortalBrand }) {
  const name = brand.name?.trim() || brand.displayName?.trim() || NEUTRAL_FIRM_NAME
  return (
    <div className="sf-firm sf-firm--portal">
      <span className="sf-firm__row"><StoreLogo icon={brand.logoIcon ?? ''} hue={brand.logoColor ?? '0'} /><span className="sf-firm__name">{name}</span></span>
    </div>
  )
}
