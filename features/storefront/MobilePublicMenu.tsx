'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import type { StorefrontSettings } from './lib/storefront-settings'
import { publicNavigation } from './navigation'
import { isCurrent } from './StorefrontNav'
import { customerSignOut } from './actions/customer-account'

export function MobilePublicMenu({ settings, signedIn = false }: { settings: StorefrontSettings; signedIn?: boolean }) {
  const details = useRef<HTMLDetailsElement>(null)
  const pathname = usePathname() ?? '/'
  const close = () => { if (details.current) details.current.open = false }
  useEffect(() => { close() }, [pathname])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.current?.open) return
      close()
      details.current.querySelector('summary')?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  // The sheet runs from the header's bottom edge to the bottom of the screen, wherever the page is scrolled.
  const place = () => {
    const node = details.current
    if (!node?.open) return
    const header = node.closest('header')
    if (header) node.style.setProperty('--sf-menu-top', `${Math.max(0, Math.round(header.getBoundingClientRect().bottom))}px`)
  }
  const links: Array<readonly [string, string]> = [['Home', '/'], ...publicNavigation, ['Your appointments', '/account'], ...(signedIn ? [['Your details', '/account/profile'] as const] : []), ['Client portal', '/portal'], ...(signedIn ? [] : [['Attorney & staff sign in', '/account/signin?as=staff'] as const])]
  return <details ref={details} className="sf-mobile-menu" onToggle={place}>
    <summary aria-label="Menu">
      <Menu className="size-7 [details[open]_&]:hidden" strokeWidth={1.25} aria-hidden="true" /><X className="hidden size-7 [details[open]_&]:block" strokeWidth={1.25} aria-hidden="true" />
    </summary>
    <div className="sf-mobile-menu__sheet">
      <nav aria-label="Mobile public navigation" onClick={close}>
        <ul className="sf-mobile-menu__list">
          {links.map(([label, href]) => <li key={href}><Link href={href} aria-current={isCurrent(pathname, href) ? 'page' : undefined}>{label}</Link></li>)}
        </ul>
        {settings.bookingEnabled ? <div className="sf-track sf-track--block mt-6"><Link href="/practice-areas" className="sf-pill sf-pill--solid sf-pill--lg">Request a consultation</Link></div> : null}
      </nav>
      {signedIn ? <form action={customerSignOut} className="sf-track sf-track--block mt-3"><button className="sf-pill sf-pill--lg">Sign out</button></form> : null}
    </div>
  </details>
}
