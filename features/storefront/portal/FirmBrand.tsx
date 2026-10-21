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
 * Portal lockup: the same sanitized StoreLogo renderer and persisted logo/hue as
 * the public storefront. Callers pass only a session-bound or published brand;
 * an unverified visitor gets the neutral fallback.
 */
export function FirmBrand({ brand }: { brand: PortalBrand }) {
  const name = brand.displayName || brand.name || NEUTRAL_FIRM_NAME
  return (
    <div className="flex min-w-0 items-center gap-3">
      <StoreLogo icon={brand.logoIcon ?? ''} hue={brand.logoColor ?? '0'} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{brand.brandTagline || 'Secure client portal'}</p>
      </div>
    </div>
  )
}
