import Link from 'next/link'
import { PublicPage } from '../PublicSiteChrome'
import { firmMetadata } from '../lib/metadata'
import { LegalPage } from './LegalPage'

export async function generateMetadata() { return firmMetadata('Accessibility') }
export default function AccessibilityPage() {
  return <PublicPage><LegalPage title="Accessibility"><dl className="sf-facts"><div><dt>Accessibility support</dt><dd><Link href="/contact" className="sf-link">Contact</Link></dd></div><div><dt>Confidential or urgent information</dt><dd>Not accepted here. Not for emergencies or deadline protection.</dd></div></dl></LegalPage></PublicPage>
}
