import Link from "next/link"
import { cookies } from "next/headers"
import { EmailText } from './EmailText'

import {
  getStorefrontSettings,
  NEUTRAL_FIRM_NAME,
  type StorefrontSettings,
} from "@/features/storefront/lib/storefront-settings"
import { StoreBrand as FirmLink } from './StoreBrand'
import { MobilePublicMenu } from './MobilePublicMenu'
import { StorefrontDock } from './StorefrontDock'
import { StorefrontNav } from './StorefrontNav'

const LEFT_NAV = [['Practice areas', '/practice-areas'], ['Attorneys', '/attorneys'], ['About', '/about']] as const
const RIGHT_NAV = [['Contact', '/contact'], ['Client portal', '/portal']] as const

export function PublicSiteHeader({ settings, signedIn = false }: { settings: StorefrontSettings; signedIn?: boolean }) {
  return (
    <header className="sf-header">
      <div className="sf-header__bar">
        <StorefrontNav links={LEFT_NAV} />
        <FirmLink settings={settings} />
        <div className="sf-header__actions">
          <div className="sf-track">
            <StorefrontNav links={RIGHT_NAV} className="contents" label="Clients" />
            {settings.bookingEnabled ? <Link href="/practice-areas" className="sf-pill sf-pill--primary">Request a consultation</Link> : null}
          </div>
        </div>
        <div className="sf-header__mobile">
          <MobilePublicMenu settings={settings} signedIn={signedIn} />
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
            {settings.tagline ? <p className="sf-fine max-w-[32ch]">{settings.tagline}</p> : null}
            {settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`} className="sf-link inline-flex min-h-11 items-center text-base"><EmailText value={settings.supportEmail} /></a> : null}
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
            <Link href="/account/signin?as=staff">Attorney &amp; staff sign in</Link>
          </nav>
          <nav className="sf-foot__col" aria-label="Legal">
            <p className="sf-label">Legal</p>
            <Link href="/privacy">Privacy</Link>
            <Link href="/disclaimer">Disclaimer</Link>
            <Link href="/accessibility">Accessibility</Link>
          </nav>
        </div>
        <div className="sf-foot__base">
          <p>This site is general information, not legal advice. Contacting us doesn’t make us your lawyers.</p>
          <p>{firmName}</p>
        </div>
      </div>
    </footer>
  )
}

export async function PublicPage({ children, dock, masthead }: { children: React.ReactNode; dock?: React.ReactNode; masthead?: React.ReactNode }) {
  const [settings, jar] = await Promise.all([getStorefrontSettings(), cookies()])
  // Only decides which account links the phone menu offers; every account page checks the session itself.
  const signedIn = jar.has('keystonejs-session')
  return (
    <div className="storefront flex min-h-svh flex-col overflow-x-clip">
      <a className="sf-skip-link" href="#public-main">Skip to main content</a>
      <PublicSiteHeader settings={settings} signedIn={signedIn} />
      {masthead}
      <main id="public-main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      {dock ? <StorefrontDock>{dock}</StorefrontDock> : null}
      <PublicSiteFooter settings={settings} />
    </div>
  )
}
