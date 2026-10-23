import Link from "next/link"
import type { CSSProperties } from "react"

import {
  getStorefrontSettings,
  NEUTRAL_FIRM_NAME,
  type StorefrontSettings,
} from "@/features/storefront/lib/storefront-settings"
import { storefrontThemeVariables } from "@/features/storefront/lib/accent"
import { StoreBrand as FirmLink } from './StoreBrand'
import { MobilePublicMenu } from './MobilePublicMenu'
import { StorefrontNav } from './StorefrontNav'

export function PublicSiteHeader({ settings }: { settings: StorefrontSettings }) {
  return (
    <header className="sf-header">
      <div className="sf-shell sf-header__bar">
        <FirmLink settings={settings} />
        <StorefrontNav />
        <div className="sf-header__actions">
          <div className="sf-track">
            <Link href="/account" className="sf-pill">Appointments</Link>
            <Link href="/portal" className="sf-pill">Client portal</Link>
            {settings.bookingEnabled ? <Link href="/practice-areas" className="sf-pill sf-pill--primary">Request a consultation</Link> : null}
          </div>
        </div>
        <div className="sf-header__mobile">
          <MobilePublicMenu settings={settings} />
        </div>
      </div>
    </header>
  )
}

export function PublicSiteFooter({ settings }: { settings: StorefrontSettings }) {
  const firmName = settings.firmName || NEUTRAL_FIRM_NAME
  return (
    <footer className="sf-foot">
      <div className="sf-shell">
        <div className="sf-foot__grid">
          <div className="grid content-start gap-3">
            <FirmLink settings={settings} />
            {settings.tagline ? <p className="text-sm opacity-70">{settings.tagline}</p> : null}
            {settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`} className="text-sm underline underline-offset-4 opacity-90">{settings.supportEmail}</a> : null}
          </div>
          <nav className="sf-foot__col" aria-label="Firm">
            <p className="sf-label">Firm</p>
            <Link href="/practice-areas">Practice areas</Link>
            <Link href="/attorneys">Attorneys</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <nav className="sf-foot__col" aria-label="Clients">
            <p className="sf-label">Clients</p>
            {settings.bookingEnabled ? <Link href="/practice-areas">Consultation appointments</Link> : null}
            <Link href="/account">Your appointments</Link>
            <Link href="/portal">Client portal</Link>
            <Link href="/dashboard">Staff sign in</Link>
          </nav>
          <nav className="sf-foot__col" aria-label="Legal">
            <p className="sf-label">Legal</p>
            <Link href="/privacy">Privacy</Link>
            <Link href="/disclaimer">Disclaimer</Link>
            <Link href="/accessibility">Accessibility</Link>
          </nav>
        </div>
        <div className="sf-foot__base">
          <p>No legal advice or attorney-client relationship. Not for emergencies or deadline protection.</p>
          <p>{firmName}{settings.isLocalFictional ? ' · Fictional local workspace' : ''}</p>
        </div>
      </div>
    </footer>
  )
}

export async function PublicPage({ children, dock }: { children: React.ReactNode; dock?: React.ReactNode }) {
  const settings = await getStorefrontSettings()
  const theme = storefrontThemeVariables(settings) as CSSProperties
  return (
    <div className="storefront flex min-h-svh flex-col overflow-x-clip" style={theme}>
      <a className="sf-skip-link" href="#public-main">Skip to main content</a>
      <PublicSiteHeader settings={settings} />
      <main id="public-main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      {dock ? <div className="sf-dock">{dock}</div> : null}
      <PublicSiteFooter settings={settings} />
    </div>
  )
}
