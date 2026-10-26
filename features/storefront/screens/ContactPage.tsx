import Link from 'next/link'
import { PublicPage } from '../PublicSiteChrome'
import { firmMetadata } from '../lib/metadata'
import { getStorefrontSettings } from '../lib/storefront-settings'

export async function generateMetadata() { return firmMetadata('Contact') }
export default async function ContactPage() {
  const settings = await getStorefrontSettings()
  return <PublicPage><div className="sf-shell sf-page">
    <header className="sf-page__head"><h1 className="sf-title">Contact</h1>{settings.firmName ? <p className="sf-label">{settings.firmName}</p> : null}</header>
    <div className="grid max-w-3xl gap-10">
      <dl className="sf-facts" aria-label="How to reach the firm">
        <div><dt>Consultations</dt><dd>{settings.bookingEnabled ? <Link href="/practice-areas" className="sf-link">Request a consultation</Link> : 'Not booked online'}</dd></div>
        <div><dt>Email</dt><dd>{settings.supportEmail ? <a className="sf-link break-all" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> : <span className="sf-muted">Not listed online</span>}</dd></div>
        <div><dt>Existing clients</dt><dd className="flex flex-wrap gap-x-5 gap-y-1"><Link href="/portal" className="sf-link">Open the client portal</Link><Link href="/portal/accept" className="sf-link">Use an invitation</Link></dd></div>
        <div id="existing-clients" className="scroll-mt-24"><dt>New portal invitation</dt><dd>{settings.supportEmail ? <><a className="sf-link break-all" href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent('Client portal invitation request')}`}>Ask by email</a><span className="sf-muted mt-1 block font-normal">Send your name only, not matter details. Invitations go only to the address the firm has on file.</span></> : <span className="sf-muted">Ask your attorney using the contact details in your engagement materials.</span>}</dd></div>
      </dl>
      <p role="note" className="sf-notice">No legal advice or representation. Do not send confidential, sensitive or time-critical information here. Not for emergencies or deadline protection.</p>
    </div>
  </div></PublicPage>
}
