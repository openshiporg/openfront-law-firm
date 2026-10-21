export const PORTAL_CONTACT_PREVIEW_LIMIT = 12

export function describePortalContactPreview(shownCount: number, authorizedMatchCount: number) {
  return {
    summary: `${shownCount.toLocaleString()} candidate rows shown · ${authorizedMatchCount.toLocaleString()} authorized matches counted`,
    description: `Candidate preview only: up to ${PORTAL_CONTACT_PREVIEW_LIMIT} authorized contacts are shown, and remaining matches are not paginated in this section. View all opens the searchable, paged candidate register. This is not a legal-clearance determination.`,
    selectorNote: `The invitation selector lists ${shownCount.toLocaleString()} returned candidate rows (up to ${PORTAL_CONTACT_PREVIEW_LIMIT}); ${authorizedMatchCount.toLocaleString()} authorized matches were counted separately, and search finds any other authorized contact. The list itself is not a complete selectable directory and is not a legal-clearance determination.`,
  }
}
