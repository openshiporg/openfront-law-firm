import Link from 'next/link'
import { PublicPage } from '@/features/storefront/PublicSiteChrome'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return <PublicPage><div className="sf-shell sf-page"><div className="sf-narrow grid gap-6">
    <h1 className="sf-title">Page not found</h1>
    <p className="sf-lede">That address doesn’t match a page on this site.</p>
    <div className="sf-track"><Link className="sf-pill sf-pill--primary" href="/">Home</Link><Link className="sf-pill" href="/practice-areas">Practice areas</Link><Link className="sf-pill" href="/contact">Contact</Link></div>
  </div></div></PublicPage>
}
