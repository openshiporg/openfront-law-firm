import Link from 'next/link'
import { PublicPage } from '../PublicSiteChrome'
import { firmMetadata } from '../lib/metadata'
import { getStorefrontSettings } from '../lib/storefront-settings'

export async function generateMetadata() { return firmMetadata('Contact') }
export default async function ContactPage() {
  const settings = await getStorefrontSettings()
  return <PublicPage><div className="sf-shell sf-page">
    <header className="sf-page__head"><p className="sf-label">{settings.firmName || 'Contact'}</p><h1 className="sf-title">Contact</h1></header>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="sf-card" aria-labelledby="contact-new"><div className="sf-card__body grid h-full content-start gap-4">
        <p className="sf-label">Prospective clients</p>
        <h2 id="contact-new" className="sf-h3">Consultation appointments</h2>
        {settings.bookingEnabled ? <div className="sf-track"><Link href="/practice-areas" className="sf-pill sf-pill--primary">Request a consultation</Link></div> : <p className="sf-muted text-sm">Public consultation services are not configured.</p>}
      </div></section>
      <section id="existing-clients" className="sf-card scroll-mt-24" aria-labelledby="contact-existing"><div className="sf-card__body grid h-full content-start gap-4">
        <p className="sf-label">Existing clients</p>
        <h2 id="contact-existing" className="sf-h3">Client portal</h2>
        <div className="sf-track"><Link href="/portal" className="sf-pill sf-pill--raised">Open portal</Link><Link href="/portal/accept" className="sf-pill">Use invitation</Link></div>
        <p className="sf-muted text-sm leading-6">New invitation: {settings.supportEmail ? <>email <a className="sf-link" href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent('Client portal invitation request')}`}>{settings.supportEmail}</a> with your name only, not matter details.</> : 'ask your attorney using the contact details in your engagement materials.'} Invitations go only to the address the firm has on file.</p>
      </div></section>
      <section className="sf-card" aria-labelledby="contact-public"><div className="sf-card__body grid h-full content-start gap-4">
        <p className="sf-label">General</p>
        <h2 id="contact-public" className="sf-h3">Public contact</h2>
        {settings.supportEmail ? <a className="sf-link break-all text-base" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> : <p className="sf-muted text-sm">No public phone or email is configured.</p>}
      </div></section>
    </div>
    <p role="note" className="sf-notice mt-8 max-w-3xl">No legal advice or representation. Do not send confidential, sensitive or time-critical information here. Not for emergencies or deadline protection.</p>
  </div></PublicPage>
}
