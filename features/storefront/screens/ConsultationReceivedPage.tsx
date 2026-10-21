import Link from 'next/link'
import { PublicPage } from '../PublicSiteChrome'
import { firmMetadata } from '../lib/metadata'
export async function generateMetadata() { return firmMetadata('Submission status') }
export default function ConsultationReceivedPage() {
  return <PublicPage><article className="sf-doc"><header className="sf-doc__head"><h1 className="sf-doc__title">Submission status unavailable</h1></header><p>This page does not confirm receipt or create an attorney-client relationship.</p><Link href="/account" className="sf-link">Your appointments ↗</Link></article></PublicPage>
}
