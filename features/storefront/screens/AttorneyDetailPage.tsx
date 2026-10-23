import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { ServiceUnavailable } from '@/features/storefront/screens/ServicePages'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { initialsOf } from '@/features/storefront/content'
import { getPublishedAttorneys } from '@/features/storefront/lib/attorneys'
import { getStorefrontSettings } from '@/features/storefront/lib/storefront-settings'

async function load(slug: string) {
  const settings = await getStorefrontSettings()
  const rows = await getPublishedAttorneys(settings.publication.mode !== 'closed' || settings.isLocalFictional, slug)
  return { settings, person: rows === null ? undefined : rows[0] ?? null }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { person } = await load((await params).slug)
  return firmMetadata(person ? person.name : 'Attorney')
}

export default async function AttorneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const { settings, person } = await load(slug)
  if (person === undefined) return <ServiceUnavailable title="Attorney" retryHref={`/attorneys/${encodeURIComponent(slug)}`} />
  if (!person) notFound()
  return <PublicPage>
    <div className="sf-shell sf-page">
      <nav aria-label="Breadcrumb" className="mb-8"><Link href="/attorneys" className="sf-link text-sm">Attorneys</Link></nav>
      <div className="sf-split">
        <article className="grid gap-6">
          <div className="flex items-center gap-5">
            <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-full bg-[var(--sf-tint)] font-[family-name:var(--font-display)] text-3xl">{initialsOf(person.name)}</span>
            <div className="grid min-w-0 gap-1">{person.title || person.focus ? <p className="sf-label">{[person.title, person.focus].filter(Boolean).join(' · ')}</p> : null}<h1 className="sf-title">{person.name}</h1></div>
          </div>
          {person.biography ? <div className="sf-prose sf-prose--lead">{person.biography.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : null}
          {person.practiceAreas.length ? <section className="sf-section" aria-labelledby="attorney-areas">
            <div className="sf-section__head"><h2 id="attorney-areas" className="sf-h2">Practice areas</h2></div>
            <ul className="sf-rows">{person.practiceAreas.map((area) => <li key={area.name}>{area.slug ? <Link href={`/practice-areas/${encodeURIComponent(area.slug)}`} className="sf-row"><span className="sf-row__title"><span>{area.name}</span></span><ArrowUpRight className="sf-row__end size-4" aria-hidden="true" /></Link> : <span className="sf-row"><span className="sf-row__title"><span>{area.name}</span></span></span>}</li>)}</ul>
          </section> : null}
        </article>
        <aside className="sf-split__aside">
          <div className="sf-card"><div className="sf-card__body grid gap-4">
            {person.admissions.length ? <dl className="sf-facts"><div><dt>Admitted</dt><dd>{person.admissions.map((line) => <span key={line} className="block">{line}</span>)}</dd></div></dl> : null}
            {person.email ? <p className="text-sm"><a className="sf-link break-all" href={`mailto:${person.email}`}>{person.email}</a></p> : null}
            {settings.bookingEnabled ? <div className="sf-track sf-track--block"><Link href="/practice-areas" className="sf-pill sf-pill--primary">Request a consultation</Link></div> : <div className="sf-track sf-track--block"><Link href="/contact" className="sf-pill sf-pill--raised">Contact the firm</Link></div>}
            <p className="sf-fine">Contacting an attorney does not create an attorney-client relationship.</p>
          </div></div>
        </aside>
      </div>
    </div>
  </PublicPage>
}
