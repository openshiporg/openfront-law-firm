import Link from "next/link"
import type { CSSProperties } from "react"
import { ArrowUpRight } from "lucide-react"

import {
  getStorefrontSettings,
  NEUTRAL_FIRM_NAME,
  type StorefrontSettings,
} from "@/features/storefront/lib/storefront-settings"
import { storefrontThemeVariables } from "@/features/storefront/lib/accent"
import { StoreBrand as FirmLink } from './StoreBrand'
import { MobilePublicMenu } from './MobilePublicMenu'
import { publicNavigation as navigation } from './navigation'

export function PublicSiteHeader({ settings }: { settings: StorefrontSettings }) {
  return (
    <header className="sf-mast">
      <p className="sf-mast__issue">
        <span>{settings.tagline || "Public information"}</span>
        <span>{settings.isLocalFictional ? 'Fictional local workspace · no legal services' : settings.publication.mode === 'live' ? 'Public information · no legal advice' : 'Firm information pending'}</span>
      </p>
      <div className="sf-mast__row">
        <FirmLink settings={settings} />
        <MobilePublicMenu settings={settings} />
        <div className="sf-mast__actions">
          <Link href="/account" className="sf-nav-link">Your appointments</Link>
          <Link href="/portal" className="sf-nav-link sf-nav-link--muted">
            Client portal
          </Link>
          {settings.bookingEnabled ? <Link href="/practice-areas" className="sf-btn">
            Request a consultation <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link> : null}
        </div>
      </div>
      <nav className="sf-mast__nav" aria-label="Public navigation">
        {navigation.map(([label, href]) => (
          <Link key={href} href={href} className="sf-nav-link">
            {label}
          </Link>
        ))}
      </nav>
      <hr className="sf-rule-double" aria-hidden="true" />
    </header>
  )
}

export function PublicSiteFooter({ settings }: { settings: StorefrontSettings }) {
  const firmName = settings.firmName || NEUTRAL_FIRM_NAME
  return (
    <footer className="sf-foot">
      <FirmLink settings={settings} />
      <nav className="sf-foot__links" aria-label="Footer navigation">
        {settings.bookingEnabled ? <Link href="/practice-areas">Consultation appointments</Link> : null}
        <Link href="/account">Your appointments</Link>
        <Link href="/portal">Client portal</Link>
        <Link href="/practice-areas">Practice areas</Link>
        <Link href="/attorneys">Attorneys</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/disclaimer">Disclaimer</Link>
        <Link href="/accessibility">Accessibility</Link>
        <Link href="/dashboard" className="sf-nav-link--muted">
          Staff sign in
        </Link>
      </nav>
      <p className="sf-foot__notice">
        No legal advice or attorney-client relationship. Not for emergencies or deadline protection.
      </p>
      <p className="sf-foot__meta">{firmName} · Public information only</p>
    </footer>
  )
}

export async function PublicPage({ children }: { children: React.ReactNode }) {
  const settings = await getStorefrontSettings()
  const theme = storefrontThemeVariables(settings) as CSSProperties
  return (
    <div className="storefront min-h-svh overflow-x-clip" style={theme}>
      <a className="sf-skip-link" href="#public-main">Skip to main content</a>
      <PublicSiteHeader settings={settings} />
      <main id="public-main" tabIndex={-1}>{children}</main>
      <PublicSiteFooter settings={settings} />
    </div>
  )
}