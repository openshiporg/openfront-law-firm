import Link from 'next/link'
import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { initialsOf } from '@/features/storefront/content'
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
      <header className="sf-page__head"><h1 className="sf-title">Attorneys</h1><p className="sf-label">{settings.firmName || 'Directory'}</p></header>
      {attorneys === null ? <p role="alert" className="sf-notice sf-notice--plain">Attorney profiles could not be loaded. <Link className="sf-link" href="/attorneys">Try again</Link></p>
        : attorneys.length ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {attorneys.map((person) => <li key={person.slug}><Link href={`/attorneys/${encodeURIComponent(person.slug)}`} className="sf-card grid h-full content-start gap-4 p-5 no-underline transition-colors hover:border-[var(--color-ink)]">
          <span aria-hidden="true" className="grid size-14 place-items-center rounded-[2px] bg-[var(--sf-tint)] font-[family-name:var(--font-display)] text-xl">{initialsOf(person.name)}</span>
          <span className="grid gap-1"><span className="sf-h3">{person.name}</span><span className="sf-muted text-sm">{[person.title, person.focus].filter(Boolean).join(' · ')}</span></span>
        </Link></li>)}
      </ul> : <div className="sf-empty">
        <p role="status" className="sf-h3">Attorney profiles are not published.</p>
        <p className="sf-muted text-sm">Do not rely on this site to identify counsel or confirm representation.</p>
      </div>}
    </div>
  </PublicPage>
}
