import Link from 'next/link'
import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { getStorefrontSettings } from '@/features/storefront/lib/storefront-settings'

export async function generateMetadata() {
  return firmMetadata('About')
}

/** Shows the firm's published About text; the request line always matches the live booking state. */
export default async function AboutPage() {
  const settings = await getStorefrontSettings()
  const who = settings.firmName || 'This site'
  const about = settings.publication.aboutStatement
  return <PublicPage>
    <article className="sf-doc">
      <header className="sf-doc__head">
        <p className="sf-doc__meta">About</p>
        <h1 className="sf-doc__title">{about && settings.firmName ? settings.firmName : 'Public information is not configured.'}</h1>
      </header>
      <div className="sf-prose">
        {about ? about.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>{who} has not published verified firm, attorney, or practice-area information through this site.</p>}
        {settings.bookingEnabled
          ? <p>Prospective clients can <Link href="/practice-areas" className="sf-link">request a consultation appointment</Link>. A request does not create an attorney-client relationship.</p>
          : <p>This site does not accept prospective-client requests. Existing clients should use the verified contact details and secure channels in their engagement materials.</p>}
      </div>
    </article>
  </PublicPage>
}
