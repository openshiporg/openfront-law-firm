import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { getStorefrontSettings, NEUTRAL_FIRM_NAME } from '@/features/storefront/lib/storefront-settings'
import { LegalPage } from './LegalPage'

export async function generateMetadata() {
  return firmMetadata('Privacy notice')
}

/** Renders only the firm's own published notice; no notice text is invented here. */
export default async function PrivacyPage() {
  const settings = await getStorefrontSettings()
  const notice = settings.publication.privacyNotice
  const firm = settings.firmName || NEUTRAL_FIRM_NAME
  return <PublicPage>
    <LegalPage title="Privacy notice" meta={notice ? `Version ${settings.publication.privacyNoticeVersion}` : 'Not published'}>
      {notice ? notice.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <>
        <p>{firm} has not published a privacy notice on this site. Do not enter confidential, sensitive or time-critical information here.</p>
        {settings.isLocalFictional ? <p>This is a fictional local workspace: accounts and appointment requests here hold fictional test information only.</p> : null}
      </>}
      <h2>Existing clients</h2>
      <p>Use only secure channels identified in your engagement materials. For questions about information in a client portal or other firm system, contact the firm using independently verified details.</p>
    </LegalPage>
  </PublicPage>
}
