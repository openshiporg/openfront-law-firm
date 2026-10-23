import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { LegalPage } from './LegalPage'

export async function generateMetadata() {
  return firmMetadata('Legal disclaimer')
}
export default function DisclaimerPage() {
  return <PublicPage><LegalPage title="Legal disclaimer"><p>Public content is general information, not legal advice. Viewing this site or submitting a consultation request does not create an attorney-client relationship. The firm represents a person only after conflicts and other review are complete and the firm expressly agrees to an engagement.</p><p>Do not rely on this site to protect a deadline or respond to an emergency. Past experience, where described, does not guarantee a future result.</p></LegalPage></PublicPage>
}
