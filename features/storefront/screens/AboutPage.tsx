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
    <div className="sf-shell sf-page">
      <div className="sf-split">
        <article className="grid gap-8">
          <header className="grid gap-3"><h1 className="sf-title">{settings.firmName ?? 'About'}</h1></header>
          <div className="sf-prose sf-prose--lead">
            {about ? about.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>{who} has not published verified firm, attorney or practice-area information.</p>}
          </div>
        </article>
        <aside className="sf-split__aside">
          <div className="sf-card"><div className="sf-card__body grid gap-4">
            {settings.bookingEnabled ? <>
              <p className="sf-h3">Consultations</p>
              <p className="sf-fine">A request does not create an attorney-client relationship.</p>
              <div className="sf-track sf-track--block"><Link href="/practice-areas" className="sf-pill sf-pill--primary">Request a consultation</Link></div>
            </> : <>
              <p className="sf-h3">Existing clients</p>
              <p className="sf-fine">This site does not accept prospective-client requests.</p>
              <div className="sf-track sf-track--block"><Link href="/portal" className="sf-pill sf-pill--raised">Client portal</Link></div>
            </>}
          </div></div>
        </aside>
      </div>
    </div>
  </PublicPage>
}
