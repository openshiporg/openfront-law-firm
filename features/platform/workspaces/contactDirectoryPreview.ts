export const CONTACT_DIRECTORY_PREVIEW_LIMIT = 12

export function describeContactDirectoryPreview(shownCount: number, authorizedMatchCount: number) {
  return {
    summary: `${shownCount.toLocaleString()} shown · ${authorizedMatchCount.toLocaleString()} authorized matches counted`,
    description: `Preview only: showing up to the first ${CONTACT_DIRECTORY_PREVIEW_LIMIT} authorized contacts returned by the directory query. This section does not page through remaining contacts; View all opens the searchable, paged directory.`,
  }
}
