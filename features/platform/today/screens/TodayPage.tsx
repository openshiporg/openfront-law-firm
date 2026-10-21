import { PracticeLoadError, PracticePage, QueuePanel } from '@/features/platform/components/PracticeSurface'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { getPracticeOverview } from '@/features/platform/operations/actions'

const queues = [
  ['Intake requiring attention', 'Prospects moving through screening, conflicts, consultation, and decisions.', 'intakeQueue', '/dashboard/platform/intake'],
  ['Matter activity', 'Authorized open, held, and closing matters.', 'matterQueue', '/dashboard/platform/matters'],
  ['Deadlines and assigned work', 'Upcoming verified and unverified obligations plus active tasks.', 'workQueue', '/dashboard/platform/work'],
  ['Billing and collections', 'Draft, issued, partially paid, and overdue bills.', 'billingQueue', '/dashboard/platform/billing'],
  ['Retention and holds', 'Active holds that constrain disposition workflows.', 'governanceQueue', '/dashboard/platform/governance'],
] as const

export async function TodayPage() {
  const [response, timeZone] = await Promise.all([getPracticeOverview(), getFirmTimeZone()])

  return (
    <PracticePage
      title="Today"
      description="A current, access-scoped view of prospective clients, matters, work, receivables, and record holds."
    >
      {!response.success ? (
        <PracticeLoadError message={response.error} />
      ) : (
        <div className="space-y-10">
          <div className="space-y-10">
            {queues.map(([title, description, key, href]) => (
              <QueuePanel
                key={key}
                title={title}
                description={description}
                items={response.data[key]}
                empty={`No ${title.toLowerCase()} records currently require attention.`}
                viewAllHref={href}
                timeZone={timeZone}
              />
            ))}
          </div>
        </div>
      )}
    </PracticePage>
  )
}
