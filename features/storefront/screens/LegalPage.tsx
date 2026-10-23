import type { ReactNode } from 'react'

/** Shared layout for privacy, disclaimer and accessibility pages. */
export function LegalPage({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return <div className="sf-shell sf-page">
    <article className="grid gap-8">
      <header className="grid gap-3 border-b border-[var(--color-ink)] pb-6"><p className="sf-label">{meta ?? 'Legal'}</p><h1 className="sf-title">{title}</h1></header>
      <div className="sf-prose">{children}</div>
    </article>
  </div>
}
