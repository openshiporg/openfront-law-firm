"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Phone-only "Request a consultation" dock. It duplicates an on-page booking control,
 * so it appears only while none of those controls ([data-dock-anchor], else the header)
 * is on screen.
 * The storefront root reserves the dock's measured height at the bottom of the page,
 * so the last content always scrolls clear of it. The anchored control itself is never
 * hidden; only this duplicate waits.
 */
export function StorefrontDock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const dock = ref.current
    if (!dock) return
    const root = dock.closest<HTMLElement>(".storefront")
    const measure = () => root?.style.setProperty("--sf-dock-h", `${Math.ceil(dock.getBoundingClientRect().height)}px`)
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(dock)

    // A page without its own booking control falls back to the site header.
    let anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-dock-anchor]"))
    if (!anchors.length) anchors = Array.from(document.querySelectorAll<HTMLElement>(".sf-header")).slice(0, 1)
    const visible = new Set<Element>()
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }
      setShown(visible.size === 0)
    })
    anchors.forEach((anchor) => watch.observe(anchor))
    return () => { watch.disconnect(); resize.disconnect() }
  }, [])

  return <div ref={ref} className="sf-dock" data-shown={shown ? "true" : "false"} inert={!shown}>{children}</div>
}
