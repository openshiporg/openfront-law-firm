import Link from 'next/link'

/** Neutral on failure: an unvalidated token never chooses a private firm brand. */
export function PortalReadProblem({ kind, retryHref }: { kind: 'unavailable' | 'invalid_cursor' | 'unavailable_resource'; retryHref: string }) {
  const title = kind === 'invalid_cursor' ? 'This page link is no longer usable' : kind === 'unavailable_resource' ? 'Shared item unavailable' : 'The portal is temporarily unavailable'
  return <main className="min-h-svh overflow-x-clip bg-background px-4 py-12 text-foreground"><section className="mx-auto max-w-xl space-y-5">
    <h1 className="text-2xl font-semibold">{title}</h1>
    <p role="alert">{kind === 'invalid_cursor' ? 'Start from the most recent shared items. Your access has not been changed.' : kind === 'unavailable_resource' ? 'This item is not available to this account. It may no longer be shared.' : 'We could not load this page. This does not mean your invitation or access has expired. Try again or contact your firm.'}</p>
    <nav aria-label="Portal recovery" className="flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center underline focus-visible:ring-2 focus-visible:ring-ring" href={kind === 'invalid_cursor' ? '/portal' : retryHref}>{kind === 'invalid_cursor' ? 'Most recent shared items' : 'Try again'}</Link><Link className="inline-flex min-h-11 items-center underline focus-visible:ring-2 focus-visible:ring-ring" href="/portal">Shared items</Link><Link className="inline-flex min-h-11 items-center underline focus-visible:ring-2 focus-visible:ring-ring" href="/contact#existing-clients">Contact your firm</Link></nav>
  </section></main>
}
