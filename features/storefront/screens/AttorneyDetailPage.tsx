import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { PublicPage } from '@/features/storefront/PublicSiteChrome'
import { firmMetadata } from '@/features/storefront/lib/metadata'
import { PUBLIC_INTAKE_ENABLED, attorney, initialsOf, practiceAreas } from '@/features/storefront/content'

export async function generateMetadata() {
  return firmMetadata('Attorney')
}

export default async function AttorneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const person = attorney((await params).slug)
  if (!person) notFound()
  const areas = practiceAreas.filter((area) => person.practiceSlugs.some((slug) => slug === area.slug))
  return <PublicPage>
    <div className="sf-shell sf-page">
      <nav aria-label="Breadcrumb" className="mb-8"><Link href="/attorneys" className="sf-link text-sm">Attorneys</Link></nav>
      <div className="sf-split">
        <article className="grid gap-6">
          <div className="flex items-center gap-5">
            <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-full bg-[var(--sf-tint)] font-[family-name:var(--font-display)] text-3xl">{initialsOf(person.name)}</span>
            <div className="grid gap-1"><p className="sf-label">{person.role} · {person.focus}</p><h1 className="sf-title">{person.name}</h1></div>
          </div>
          <div className="sf-prose sf-prose--lead"><p>{person.summary}</p></div>
          {areas.length ? <section className="sf-section" aria-labelledby="attorney-areas">
            <div className="sf-section__head"><h2 id="attorney-areas" className="sf-h2">Practice areas</h2></div>
            <ul className="sf-rows">{areas.map((area) => <li key={area.slug}><Link href={`/practice-areas/${area.slug}`} className="sf-row"><span className="sf-row__title"><span>{area.name}</span></span><span className="sf-row__meta" style={{ paddingLeft: 0 }}>{area.summary}</span><ArrowUpRight className="sf-row__end size-4" aria-hidden="true" /></Link></li>)}</ul>
          </section> : null}
        </article>
        <aside className="sf-split__aside">
          <div className="sf-card"><div className="sf-card__body grid gap-4">
            {PUBLIC_INTAKE_ENABLED ? <>
              <p className="sf-muted text-sm">Contact begins with a conflict check.</p>
              <div className="sf-track sf-track--block"><Link href="/consultation" className="sf-pill sf-pill--primary">Request a consultation</Link></div>
            </> : <>
              <p className="sf-notice sf-notice--plain">Consultation requests are not enabled here. Do not send confidential or time-critical information.</p>
              <div className="sf-track sf-track--block"><Link href="/contact" className="sf-pill sf-pill--raised">Contact guidance</Link></div>
            </>}
          </div></div>
        </aside>
      </div>
    </div>
  </PublicPage>
}
