'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** In-page section index as flat underline tabs; the section in view carries the rust rule. */
export function SectionTabs({ sections }: { sections: Array<{ key: string; title: string; total?: number }> }) {
  const [current, setCurrent] = useState(sections[0]?.key)
  const keys = sections.map((section) => section.key).join('|')
  useEffect(() => {
    const targets = keys.split('|').map((key) => document.getElementById(key)).filter((node): node is HTMLElement => Boolean(node))
    if (!targets.length) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setCurrent(visible.target.id)
    }, { rootMargin: '-96px 0px -60% 0px' })
    targets.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [keys])
  // Two sections read fine as headings; the index earns its row at three or more.
  if (sections.length < 3) return null
  return (
    <nav aria-label="Sections" className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-border bg-background/95 px-4 backdrop-blur-sm [scrollbar-width:none] md:-mx-6 md:px-6">
      <ul className="flex min-w-max items-end gap-5">
        {sections.map((section) => {
          const active = section.key === current
          return (
            <li key={section.key}>
              <a
                href={`#${section.key}`}
                aria-current={active ? 'location' : undefined}
                onClick={() => setCurrent(section.key)}
                className={cn(
                  '-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm outline-none transition-colors focus-visible:text-foreground focus-visible:underline',
                  active ? 'border-[var(--lf-rust)] font-medium text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {section.title}
                {typeof section.total === 'number' ? <span className="lf-figures text-xs text-muted-foreground">{section.total.toLocaleString()}</span> : null}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
