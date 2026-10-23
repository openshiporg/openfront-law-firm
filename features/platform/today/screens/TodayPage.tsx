import Link from 'next/link'
import { PracticeLoadError, PracticePage, QueuePanel } from '@/features/platform/components/PracticeSurface'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { formatInstant } from '@/features/platform/lib/datetime'
import { getPracticeOverview } from '@/features/platform/operations/actions'

const queues = [
  ['Intake & conflicts', 'intakeQueue', '/dashboard/platform/intake'],
  ['Deadlines & tasks', 'workQueue', '/dashboard/platform/work'],
  ['Matters', 'matterQueue', '/dashboard/platform/matters'],
  ['Billing & collections', 'billingQueue', '/dashboard/platform/billing'],
  ['Legal holds', 'governanceQueue', '/dashboard/platform/governance'],
] as const

export async function TodayPage() {
  const [response, timeZone] = await Promise.all([getPracticeOverview(), getFirmTimeZone()])

  return (
    <PracticePage
      title="Today"
      description="Current intake, matter, work, billing and hold queues."
      meta={response.success ? <>{response.data.firmName} · {formatInstant(response.data.generatedAt, timeZone, { includeTime: false })}</> : undefined}
    >
      {!response.success ? (
        <PracticeLoadError message={response.error} />
      ) : (
        <div className="space-y-6">
          {response.data.metrics.length ? (
            <nav aria-label="Practice metrics" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
              {response.data.metrics.map((metric) => (
                <Link key={metric.key} href={metric.href} className="group min-w-0 bg-card px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="block truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">{metric.label}</span>
                  <span className="mt-1 block truncate text-2xl font-semibold tabular-nums tracking-tight text-foreground">{metric.value.toLocaleString()}</span>
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {queues.map(([title, key, href]) => (
              <QueuePanel
                key={key}
                title={title}
                description=""
                items={response.data[key]}
                count={response.data[key].length}
                empty="Nothing needs attention"
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
