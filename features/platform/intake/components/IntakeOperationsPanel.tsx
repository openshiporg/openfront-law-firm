import { ErrorBanner } from '@/features/platform/components/ui'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { getIntakeSetup } from '../actions/startIntake'
import { getConflictReviewSetup } from '../actions/manageConflictReview'
import { IntakeStartPanel } from './IntakeStartPanel'
import { IntakeConversionPanel } from './IntakeConversionPanel'
import { ConflictReviewPanel } from './ConflictReviewPanel'

export async function IntakeOperationsPanel({ reviewPage = 1, decisionPage = 1, pageHref, decisionPageHref }: { reviewPage?: number; decisionPage?: number; pageHref?: (page: number) => string; decisionPageHref?: (page: number) => string }) {
  const [response, conflicts, timeZone] = await Promise.all([getIntakeSetup(decisionPage), getConflictReviewSetup(reviewPage), getFirmTimeZone()])
  const reviewHrefs = conflicts.success && pageHref ? {
    previous: conflicts.data.page > 1 ? pageHref(conflicts.data.page - 1) : null,
    next: conflicts.data.page < conflicts.data.pageCount ? pageHref(conflicts.data.page + 1) : null,
  } : undefined
  const decisionHrefs = response.success && decisionPageHref ? {
    previous: response.data.decisionPage > 1 ? decisionPageHref(response.data.decisionPage - 1) : null,
    next: response.data.decisionPage < response.data.decisionPageCount ? decisionPageHref(response.data.decisionPage + 1) : null,
  } : undefined
  if (!response.success) return <ErrorBanner title="Intake unavailable">{response.error}</ErrorBanner>
  return (
    <div className="min-w-0 space-y-8">
      {/* Clearing conflicts and opening cleared matters is the daily work; a new intake is the less frequent entry. */}
      {conflicts.success ? <ConflictReviewPanel setup={conflicts.data} pageHrefs={reviewHrefs} timeZone={timeZone} /> : <ErrorBanner title="Conflict review unavailable">{conflicts.error}</ErrorBanner>}
      <IntakeConversionPanel setup={response.data} pageHrefs={decisionHrefs} />
      <details id="new-intake" className="group/new scroll-mt-28 rounded-[6px] border border-border bg-card open:border-0 open:bg-transparent">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold group-open:sr-only [&::-webkit-details-marker]:hidden">New intake<span className="text-xs font-normal text-muted-foreground">Open the form</span></summary>
        <IntakeStartPanel setup={response.data} />
      </details>
    </div>
  )
}
