/** Conflict-check states that block intake progression, conversion and direct matter
 * opening alike. A historical clearance does not outweigh any of these. */
export const blockingConflictCheckStatuses = ["requested", "running", "review_required", "conflict_found", "failed"] as const;
