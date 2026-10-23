export const PORTAL_ACCOUNT_PREVIEW_LIMIT = 12

export function describePortalAccountPreview(shownCount: number, authorizedMatchCount: number) {
  const more = authorizedMatchCount > shownCount
  return {
    summary: more ? `${shownCount.toLocaleString()} of ${authorizedMatchCount.toLocaleString()}` : `${authorizedMatchCount.toLocaleString()}`,
    description: more ? 'View all to search every client account.' : '',
  }
}
