'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import type { StorefrontSettings } from './lib/storefront-settings'
import { publicNavigation } from './navigation'
import { isCurrent } from './StorefrontNav'

export function MobilePublicMenu({ settings }: { settings: StorefrontSettings }) {
  const details = useRef<HTMLDetailsElement>(null)
  const pathname = usePathname() ?? '/'
  const close = () => { if (details.current) details.current.open = false }
  useEffect(() => { close() }, [pathname])
  const links: Array<readonly [string, string]> = [...publicNavigation, ['Your appointments', '/account'], ['Client portal', '/portal']]
  return <details ref={details} className="sf-mobile-menu">
    <summary aria-label="Menu" className="sf-track cursor-pointer">
      <span className="sf-pill sf-pill--raised" style={{ paddingInline: '0.75rem' }}><Menu className="size-4 [details[open]_&]:hidden" aria-hidden="true" /><X className="hidden size-4 [details[open]_&]:block" aria-hidden="true" />Menu</span>
    </summary>
    <div className="sf-mobile-menu__sheet">
      <nav aria-label="Mobile public navigation" onClick={close}>
        <ul className="sf-mobile-menu__list">
          {links.map(([label, href]) => <li key={href}><Link href={href} aria-current={isCurrent(pathname, href) ? 'page' : undefined}>{label}<ArrowUpRight className="size-4 opacity-50" aria-hidden="true" /></Link></li>)}
        </ul>
        {settings.bookingEnabled ? <div className="sf-track sf-track--block mt-5"><Link href="/practice-areas" className="sf-pill sf-pill--primary sf-pill--lg">Request a consultation</Link></div> : null}
      </nav>
    </div>
  </details>
}
