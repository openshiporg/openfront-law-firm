import { normalizeStoreLogoColor, safeStoreLogo } from '@/features/shared/store-logo'

/** Same sanitized renderer for masthead, mobile navigation and footer. */
export function StoreLogo({ icon, hue }: { icon: string; hue: string }) {
  return <span data-store-logo="public" className="inline-block size-9 shrink-0 [&>svg]:size-full" aria-hidden="true" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(hue)}deg)` }} dangerouslySetInnerHTML={{ __html: safeStoreLogo(icon) }} />
}
