export type ConflictDispositionSummary = {
  outcome: string
  decidedAt: string
}

export type ConflictCandidateReviewState = {
  status: string
  dispositionsCount: number
  latestDisposition?: ConflictDispositionSummary[] | null
}

/**
 * Reopen the controlled disposition form only for a candidate with no prior
 * decision or whose latest authorized decision explicitly needs follow-up.
 * Missing/filtered history and final outcomes fail closed.
 */
export function shouldShowDispositionForm(
  checkStatus: string,
  match: ConflictCandidateReviewState,
) {
  if (checkStatus !== 'review_required') return false

  const latest = match.latestDisposition?.[0]
  if (match.dispositionsCount > 0) return latest?.outcome === 'needs_more_information'
  if (latest) return false

  return match.status === 'potential' || match.status === 'reviewing'
}
