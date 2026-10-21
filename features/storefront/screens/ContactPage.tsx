import Link from 'next/link'
import { PublicPage } from '../PublicSiteChrome'
import { firmMetadata } from '../lib/metadata'
import { getStorefrontSettings } from '../lib/storefront-settings'

export async function generateMetadata() { return firmMetadata('Contact') }
export default async function ContactPage() {
  const settings = await getStorefrontSettings()
  return <PublicPage><article className="sf-doc">
    <header className="sf-doc__head"><h1 className="sf-doc__title">Contact</h1></header>
    <div className="sf-bound">
      <div className="sf-bound__row"><span className="sf-bound__mark" aria-hidden="true" /><dl className="sf-bound__body"><dt>Appointments</dt><dd>{settings.bookingEnabled ? <Link href="/practice-areas" className="sf-link">Consultation appointments ↗</Link> : 'Public consultation services are not configured.'}</dd></dl></div>
      <div id="existing-clients" className="sf-bound__row"><span className="sf-bound__mark" aria-hidden="true" /><dl className="sf-bound__body"><dt>Existing clients</dt><dd><Link href="/portal" className="sf-link">Client portal ↗</Link><p className="mt-2">Lost portal access or need a new invitation? {settings.supportEmail ? <>Email <a className="sf-link" href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent('Client portal invitation request')}`}>{settings.supportEmail}</a> and ask for a new invitation. Include your name only — not matter details.</> : 'Ask your attorney for a new invitation using the contact details in your engagement materials.'} Invitations are sent only to the address the firm already has for you.</p></dd></dl></div>
      <div className="sf-bound__row"><span className="sf-bound__mark" aria-hidden="true" /><dl className="sf-bound__body"><dt>Public contact</dt><dd>{settings.supportEmail ? <a className="sf-link" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> : 'No public phone or email has been configured.'}</dd></dl></div>
    </div>
    <footer className="sf-doc__close"><p>No legal advice or representation. Do not send confidential, sensitive, or time-critical information here. Not for emergencies or deadline protection.</p></footer>
  </article></PublicPage>
}
