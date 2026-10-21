import Link from 'next/link'
import { PublicPage } from '../PublicSiteChrome'
import { firmMetadata } from '../lib/metadata'

export async function generateMetadata() { return firmMetadata('Accessibility') }
export default function AccessibilityPage() {
  return <PublicPage><article className="sf-legal"><h1>Accessibility</h1><dl><dt>Accessibility support</dt><dd><Link href="/contact" className="sf-link">Contact ↗</Link></dd><dt>Confidential or urgent information</dt><dd>Not accepted here. Not for emergencies or deadline protection.</dd></dl></article></PublicPage>
}
