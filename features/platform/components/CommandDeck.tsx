'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type CommandDeckPanel = { key: string; label: string; content: ReactNode }

/** The page's commands (record payment, draft an invoice, post to trust) behind flat underline
 * tabs, so the records stay first and each form is one click away. Inactive panels stay mounted,
 * which keeps half-filled forms intact. A link to `#<key>` opens that panel. */
export function CommandDeck({ title = 'Actions', panels, id = 'actions' }: { title?: string; panels: CommandDeckPanel[]; id?: string }) {
  const [current, setCurrent] = useState(panels[0]?.key)
  const base = useId()
  const keys = panels.map((panel) => panel.key).join('|')
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1)
      if (hash && keys.split('|').includes(hash)) {
        setCurrent(hash)
        document.getElementById(id)?.scrollIntoView({ block: 'start' })
      }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [keys, id])
  if (!panels.length) return null
  return (
    <section id={id} aria-labelledby={`${base}-title`} className="min-w-0 scroll-mt-28">
      <div className={cn('flex min-w-0 flex-wrap items-end justify-between gap-x-6 border-b border-border', panels.length === 1 && 'sr-only')}>
        <h2 id={`${base}-title`} className="pb-2.5 text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        {panels.length > 1 ? (
          <div role="tablist" aria-labelledby={`${base}-title`} className="-mb-px flex max-w-full gap-5 overflow-x-auto [scrollbar-width:none]">
            {panels.map((panel) => {
              const active = panel.key === current
              return (
                <button
                  key={panel.key}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${panel.key}`}
                  aria-selected={active}
                  aria-controls={`${base}-panel-${panel.key}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setCurrent(panel.key)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
                    const index = panels.findIndex((candidate) => candidate.key === panel.key)
                    const next = panels[(index + (event.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length]
                    setCurrent(next.key)
                    document.getElementById(`${base}-tab-${next.key}`)?.focus()
                  }}
                  className={cn(
                    'flex h-10 items-center whitespace-nowrap border-b-2 text-sm outline-none transition-colors focus-visible:text-foreground focus-visible:underline',
                    active ? 'border-[var(--lf-rust)] font-medium text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {panel.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      {panels.map((panel) => (
        <div
          key={panel.key}
          role={panels.length > 1 ? 'tabpanel' : undefined}
          id={`${base}-panel-${panel.key}`}
          aria-labelledby={panels.length > 1 ? `${base}-tab-${panel.key}` : undefined}
          hidden={panel.key !== current}
          className={panels.length > 1 ? 'pt-4' : undefined}
        >
          {panel.content}
        </div>
      ))}
    </section>
  )
}
