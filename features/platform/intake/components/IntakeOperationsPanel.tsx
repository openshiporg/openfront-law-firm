import { getIntakeSetup } from '../actions/startIntake'
import { getConflictReviewSetup } from '../actions/manageConflictReview'
import { IntakeStartPanel } from './IntakeStartPanel'
import { IntakeConversionPanel } from './IntakeConversionPanel'
import { ConflictReviewPanel } from './ConflictReviewPanel'

export async function IntakeOperationsPanel({ reviewPage = 1, decisionPage = 1, pageHref, decisionPageHref }: { reviewPage?: number; decisionPage?: number; pageHref?: (page: number) => string; decisionPageHref?: (page: number) => string }) {
  const [response, conflicts] = await Promise.all([getIntakeSetup(decisionPage), getConflictReviewSetup(reviewPage)])
  const reviewHrefs = conflicts.success && pageHref ? {
    previous: conflicts.data.page > 1 ? pageHref(conflicts.data.page - 1) : null,
    next: conflicts.data.page < conflicts.data.pageCount ? pageHref(conflicts.data.page + 1) : null,
  } : undefined
  const decisionHrefs = response.success && decisionPageHref ? {
    previous: response.data.decisionPage > 1 ? decisionPageHref(response.data.decisionPage - 1) : null,
    next: response.data.decisionPage < response.data.decisionPageCount ? decisionPageHref(response.data.decisionPage + 1) : null,
  } : undefined
  if (!response.success) return <div role="alert" className="border-y border-destructive/30 px-4 py-6 text-sm text-destructive">Intake setup is unavailable: {response.error}</div>
  return (
    <div className="space-y-8">
      <IntakeStartPanel setup={response.data} />
      {conflicts.success ? <ConflictReviewPanel setup={conflicts.data} pageHrefs={reviewHrefs} /> : <div role="alert" className="border-y border-destructive/30 px-4 py-6 text-sm text-destructive">Conflict controls are unavailable: {conflicts.error}</div>}
      <IntakeConversionPanel setup={response.data} pageHrefs={decisionHrefs} />
    </div>
  )
}
