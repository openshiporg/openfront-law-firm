export const PORTAL_CONTACT_PREVIEW_LIMIT = 12

export function describePortalContactPreview(shownCount: number, authorizedMatchCount: number) {
  const more = authorizedMatchCount > shownCount
  return {
    summary: more ? `${shownCount.toLocaleString()} of ${authorizedMatchCount.toLocaleString()}` : `${authorizedMatchCount.toLocaleString()}`,
    description: more ? 'View all to search every contact.' : '',
    selectorNote: more ? `Showing ${shownCount.toLocaleString()} of ${authorizedMatchCount.toLocaleString()} contacts. Search to find others.` : '',
  }
}
