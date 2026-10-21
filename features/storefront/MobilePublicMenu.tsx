'use client'
import { useRef } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import type { StorefrontSettings } from './lib/storefront-settings'
import { StoreBrand } from './StoreBrand'
import { publicNavigation } from './navigation'

export function MobilePublicMenu({ settings }: { settings: StorefrontSettings }) {
  const details = useRef<HTMLDetailsElement>(null)
  const close = () => { if (details.current) details.current.open = false }
  return <details ref={details} className="sf-mobile-menu">
    <summary aria-label="Public navigation" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md border"><Menu className="size-5" aria-hidden="true" /></summary>
    <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-md border bg-background p-4 shadow-lg">
      <div className="mb-3 flex items-start gap-2"><StoreBrand settings={settings} /><button type="button" aria-label="Close navigation" onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-md border"><X className="size-4" aria-hidden="true" /></button></div>
      <nav aria-label="Mobile public navigation" className="grid gap-1" onClick={close}>{publicNavigation.map(([label, href]) => <Link key={href} href={href} className="sf-nav-link">{label}</Link>)}<Link href="/account" className="sf-nav-link">Your appointments</Link><Link href="/portal" className="sf-nav-link">Client portal</Link>{settings.bookingEnabled && <Link href="/practice-areas" className="sf-btn">Consultation appointments ↗</Link>}</nav>
    </div>
  </details>
}
