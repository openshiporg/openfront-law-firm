'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { publicNavigation } from './navigation'

export function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Desktop section navigation: letterspaced links; a brass underline marks the current section. */
export function StorefrontNav({ links = publicNavigation, className = 'sf-header__nav', label = 'Public navigation' }: { links?: ReadonlyArray<readonly [string, string]>; className?: string; label?: string }) {
  const pathname = usePathname() ?? '/'
  return <nav aria-label={label} className={className}>
    <div className="sf-track">
      {links.map(([text, href]) => <Link key={href} href={href} className="alt-navlink" aria-current={isCurrent(pathname, href) ? 'page' : undefined}>{text}</Link>)}
    </div>
  </nav>
}
