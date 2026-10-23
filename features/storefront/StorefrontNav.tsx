'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { publicNavigation } from './navigation'

export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Desktop section navigation: raised pill in a recessed track marks the current section. */
export function StorefrontNav() {
  const pathname = usePathname() ?? '/'
  return <nav aria-label="Public navigation" className="sf-header__nav">
    <div className="sf-track">
      {publicNavigation.map(([label, href]) => <Link key={href} href={href} className="sf-pill" aria-current={isCurrent(pathname, href) ? 'page' : undefined}>{label}</Link>)}
    </div>
  </nav>
}
