import Link from 'next/link'
import { PracticeLoadError, PracticePage, QueuePanel } from '@/features/platform/components/PracticeSurface'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'
import { formatInstant } from '@/features/platform/lib/datetime'
import { getPracticeOverview } from '@/features/platform/operations/actions'
import { cn } from '@/lib/utils'

// Deadlines lead: a missed court or limitation date is the costliest thing a firm can miss.
const lead = ['Deadlines & tasks', 'workQueue', '/dashboard/platform/work'] as const
const queues = [
  ['Intake & conflicts', 'intakeQueue', '/dashboard/platform/intake'],
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
        <div className="space-y-8">
          {response.data.metrics.length ? (
            <nav aria-label="Open obligations" className="grid grid-cols-2 border-y border-border sm:grid-cols-4 xl:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]">
              {response.data.metrics.map((metric) => (
                <Link
                  key={metric.key}
                  href={metric.href}
                  className="group min-w-0 border-b border-border px-3 py-3 outline-none transition-colors hover:bg-[var(--lf-manila)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lf-rust)]/40 max-sm:odd:border-r sm:border-r sm:last:border-r-0 xl:border-b-0"
                >
                  <span className="block truncate text-xs text-muted-foreground group-hover:text-foreground">{metric.label}</span>
                  <span className={cn('lf-figures mt-1 block truncate text-2xl font-semibold tracking-tight', metric.value ? 'text-foreground' : 'text-muted-foreground/60')}>{metric.value.toLocaleString()}</span>
                </Link>
              ))}
            </nav>
          ) : null}
          <QueuePanel
            title={lead[0]}
            description=""
            items={response.data[lead[1]]}
            count={response.data[lead[1]].length}
            empty="No deadlines or tasks due"
            viewAllHref={lead[2]}
            timeZone={timeZone}
          />
          <div className="grid items-start gap-x-6 gap-y-8 xl:grid-cols-2">
            {queues.map(([title, key, href]) => (
              <QueuePanel
                key={key}
                title={title}
                description=""
                items={response.data[key]}
                count={response.data[key].length}
                empty="Nothing waiting"
                viewAllHref={href}
                timeZone={timeZone}
                showKind={false}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </PracticePage>
  )
}
