// Public legal content must be owner-verified before publication. No practice
// areas, attorney profiles, credentials, or response promises are bundled as
// firm facts in this application. The anonymous (no-account) intake form stays
// closed; signed-in consultation booking opens only through the owned offline
// fixture or the firm's own published PublicSitePolicy.
export const PUBLIC_INTAKE_ENABLED = false

export type PublicPracticeArea = {
  slug: string
  name: string
  summary: string
  details: readonly string[]
}

export const practiceAreas: readonly PublicPracticeArea[] = []

export function practiceArea(slug: string) {
  return practiceAreas.find((item) => item.slug === slug)
}

export function initialsOf(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
