import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'

export async function generateMetadata() {
  return firmMetadata('Attorneys')
}

export default function AttorneysPage() {
  return <PublicPage>
    <article className="sf-doc">
      <header className="sf-doc__head">
        <p className="sf-doc__meta">Public directory</p>
        <h1 className="sf-doc__title" style={{ maxWidth: '14ch' }}>Attorney profiles are not published.</h1>
        <p className="sf-doc__lede">No attorney biographies, bar admissions, or credentials have been verified and approved for this site.</p>
      </header>
      <footer className="sf-doc__close">
        <p>Do not rely on this site to identify counsel or confirm an attorney-client relationship.</p>
      </footer>
    </article>
  </PublicPage>
}
