import Link from "next/link"
import { EmailText } from './EmailText'

import {
  getStorefrontSettings,
  NEUTRAL_FIRM_NAME,
  type StorefrontSettings,
} from "@/features/storefront/lib/storefront-settings"
import { StoreBrand as FirmLink } from './StoreBrand'
import { MobilePublicMenu } from './MobilePublicMenu'
import { StorefrontNav } from './StorefrontNav'
import { officeLocality } from './lib/locality'

const LEFT_NAV = [['Practice areas', '/practice-areas'], ['Attorneys', '/attorneys'], ['About', '/about']] as const
const RIGHT_NAV = [['Contact', '/contact'], ['Client portal', '/portal']] as const

/** The office's town for the masthead ("Portland, Maine"), read from Store Settings' active office. */
export function firmPlace(settings: StorefrontSettings) {
  const place = officeLocality(settings.officeAddress)
  return place ? `${place.city}, ${place.state}` : null
}

export function PublicSiteHeader({ settings }: { settings: StorefrontSettings }) {
  return (
    <header className="sf-header">
      <div className="sf-header__bar">
        <StorefrontNav links={LEFT_NAV} />
        <FirmLink settings={settings} place={firmPlace(settings)} />
        <div className="sf-header__actions">
          <div className="sf-track">
            <StorefrontNav links={RIGHT_NAV} className="contents" label="Clients" />
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
            <FirmLink settings={settings} place={firmPlace(settings)} />
            {settings.tagline ? <p className="sf-fine max-w-[32ch]">{settings.tagline}</p> : null}
            {settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`} className="sf-link text-base"><EmailText value={settings.supportEmail} /></a> : null}
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

export async function PublicPage({ children, dock, masthead }: { children: React.ReactNode; dock?: React.ReactNode; masthead?: React.ReactNode }) {
  const settings = await getStorefrontSettings()
  return (
    <div className="storefront flex min-h-svh flex-col overflow-x-clip">
      <a className="sf-skip-link" href="#public-main">Skip to main content</a>
      <PublicSiteHeader settings={settings} />
      {masthead}
      <main id="public-main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      {dock ? <div className="sf-dock">{dock}</div> : null}
      <PublicSiteFooter settings={settings} />
    </div>
  )
}
