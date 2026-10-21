export const PORTAL_ACCOUNT_PREVIEW_LIMIT = 12

export function describePortalAccountPreview(shownCount: number, authorizedMatchCount: number) {
  return {
    summary: `${shownCount.toLocaleString()} shown · ${authorizedMatchCount.toLocaleString()} authorized matches counted`,
    description: `Preview only: showing up to ${PORTAL_ACCOUNT_PREVIEW_LIMIT} Portal accounts from the current authorized query. Remaining matches are not paginated here; this is not a complete account register, and the separate count and row reads are not a snapshot. View all opens the searchable, paged account register.`,
  }
}
