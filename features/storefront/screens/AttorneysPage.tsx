import Link from 'next/link'
import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { attorneys, initialsOf } from '@/features/storefront/content'

export async function generateMetadata() {
  return firmMetadata('Attorneys')
}

export default function AttorneysPage() {
  return <PublicPage>
    <div className="sf-shell sf-page">
      <header className="sf-page__head"><p className="sf-label">Directory</p><h1 className="sf-title">Attorneys</h1></header>
      {attorneys.length ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {attorneys.map((person) => <li key={person.slug}><Link href={`/attorneys/${person.slug}`} className="sf-card grid h-full gap-4 p-5 no-underline transition-colors hover:border-[var(--color-ink)]">
          <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[var(--sf-tint)] font-[family-name:var(--font-display)] text-xl">{initialsOf(person.name)}</span>
          <span className="grid gap-1"><span className="sf-h3">{person.name}</span><span className="sf-muted text-sm">{person.role} · {person.focus}</span></span>
        </Link></li>)}
      </ul> : <div className="sf-empty">
        <p role="status" className="sf-h3">Attorney profiles are not published.</p>
        <p className="sf-muted text-sm">Do not rely on this site to identify counsel or confirm representation.</p>
      </div>}
    </div>
  </PublicPage>
}
