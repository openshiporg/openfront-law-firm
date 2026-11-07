import Link from 'next/link'
import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { AttorneyPortrait } from '@/features/storefront/AttorneyPortrait'
import { getPublishedAttorneys } from '@/features/storefront/lib/attorneys'
import { getStorefrontSettings } from '@/features/storefront/lib/storefront-settings'

export async function generateMetadata() {
  return firmMetadata('Attorneys')
}

export default async function AttorneysPage() {
  const settings = await getStorefrontSettings()
  const attorneys = await getPublishedAttorneys(settings.publication.mode !== 'closed' || settings.isLocalFictional)
  return <PublicPage>
    <div className="sf-shell sf-page">
      <header className="sf-page__head"><h1 className="sf-title">Attorneys</h1>{attorneys?.length ? <p className="sf-lede">Each matter has one attorney who answers your calls, start to finish.</p> : null}</header>
      {attorneys === null ? <p role="alert" className="sf-notice sf-notice--plain">Attorney profiles could not be loaded. <Link className="sf-link" href="/attorneys">Try again</Link></p>
        : attorneys.length ? <ul className="alt-attorneys">
        {attorneys.map((person) => <li key={person.slug}><Link className="alt-attorney" href={`/attorneys/${encodeURIComponent(person.slug)}`}>
          <AttorneyPortrait name={person.name} photoUrl={person.photoUrl} size="fill" className="alt-attorney__photo" />
          <span className="alt-attorney__name">{person.name}</span>
          {person.title ? <span className="alt-attorney__role">{person.title}</span> : null}
          {person.focus ? <span className="alt-attorney__focus">{person.focus}</span> : null}
        </Link></li>)}
      </ul> : <div className="sf-empty">
        <p className="sf-h3">Contact the firm to arrange a consultation.</p>
        <p className="sf-track"><Link href="/consultation" className="sf-pill sf-pill--primary">Request a consultation</Link></p>
      </div>}
    </div>
  </PublicPage>
}
