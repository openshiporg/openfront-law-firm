import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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
    <article className="sf-doc">
      <header className="sf-doc__head">
        <p className="sf-doc__meta">Profile · {person.role}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBlockEnd: 'var(--space-lg)' }}>
          <span className="sf-seal" style={{ width: '4.5rem', height: '4.5rem', fontSize: 'var(--text-2xl)' }} aria-hidden="true">{initialsOf(person.name)}</span>
          <div>
            <p className="sf-register__role" style={{ marginBlockEnd: 'var(--space-2xs)' }}>{person.role} · {person.focus}</p>
            <h1 className="sf-doc__title" style={{ margin: 0, maxWidth: 'none' }}>{person.name}</h1>
          </div>
        </div>
        <p className="sf-doc__lede">{person.summary}</p>
        <p style={{ margin: 'var(--space-md) 0 0' }}>
          <Link href="/attorneys" className="sf-link sf-link--muted">← Register of attorneys</Link>
        </p>
      </header>

      <h2 className="sf-doc__head-inline">Practice areas</h2>
      <div className="sf-register">
        {areas.map((area) => (
          <div key={area.slug} className="sf-register__row">
            <div>
              <h3 className="sf-register__name">{area.name}</h3>
              <p className="sf-register__sum">{area.summary}</p>
              <p className="sf-register__foot">
                <Link href={`/practice-areas/${area.slug}`} className="sf-link">Open this practice <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
              </p>
            </div>
          </div>
        ))}
      </div>

      <footer className="sf-doc__close">
        {PUBLIC_INTAKE_ENABLED ? (
          <>
            <p>Contact begins through the firm&rsquo;s limited intake process so conflicts and fit can be reviewed before substantive information is exchanged.</p>
            <p>
              <Link href="/consultation" className="sf-link">Request a consultation <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            </p>
          </>
        ) : (
          <p>
            Consultation requests are not enabled. Prospective clients should use contact information obtained independently from a trusted source. Existing clients should use the verified phone, email, and secure channels in their engagement materials. Do not send confidential, sensitive, or time-critical information here, and do not use this site for emergencies or to protect a deadline. <Link href="/contact" className="sf-link">Review contact guidance</Link>.
          </p>
        )}
      </footer>
    </article>
  </PublicPage>
}