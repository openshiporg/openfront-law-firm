import Link from 'next/link'
import { PublicPage } from '../PublicSiteChrome'
import { firmMetadata } from '../lib/metadata'
export async function generateMetadata() { return firmMetadata('Submission status') }
export default function ConsultationReceivedPage() {
  return <PublicPage><div className="sf-shell sf-page"><div className="sf-narrow grid gap-6"><p className="sf-status"><span className="sf-dot sf-dot--slate" aria-hidden="true" />Status unavailable</p><h1 className="sf-title">Submission status unavailable</h1><p className="sf-notice sf-notice--plain">This page does not confirm receipt or create an attorney-client relationship.</p><div className="sf-track"><Link href="/account" className="sf-pill sf-pill--raised">Your appointments</Link></div></div></div></PublicPage>
}
