import Link from 'next/link'

/** Neutral on failure: an unvalidated token never chooses a private firm brand. */
export function PortalReadProblem({ kind, retryHref }: { kind: 'unavailable' | 'invalid_cursor' | 'unavailable_resource'; retryHref: string }) {
  const title = kind === 'invalid_cursor' ? 'This page link is no longer usable' : kind === 'unavailable_resource' ? 'Shared item unavailable' : 'The portal is temporarily unavailable'
  return <main className="storefront min-h-svh overflow-x-clip px-4 py-16"><section className="mx-auto grid max-w-xl gap-6">
    <h1 className="sf-title">{title}</h1>
    <p role="alert" className="sf-notice sf-notice--plain">{kind === 'invalid_cursor' ? 'Start from the most recent shared items. Your access has not been changed.' : kind === 'unavailable_resource' ? 'This item is not available to this account. It may no longer be shared.' : 'We could not load this page. This does not mean your invitation or access has expired. Try again or contact your firm.'}</p>
    <nav aria-label="Portal recovery" className="sf-track"><Link className="sf-pill sf-pill--raised" href={kind === 'invalid_cursor' ? '/portal' : retryHref}>{kind === 'invalid_cursor' ? 'Most recent shared items' : 'Try again'}</Link><Link className="sf-pill" href="/portal">Shared items</Link><Link className="sf-pill" href="/contact#existing-clients">Contact your firm</Link></nav>
  </section></main>
}
