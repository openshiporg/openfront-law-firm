import { Quote } from 'lucide-react'

import { Notice, Panel, StatusDot } from '@/features/platform/components/ui'

const rules = [
  'Each factual statement cites an authorized source record and an immutable document version.',
  'Each citation keeps the source checksum and an excerpt or location when extraction exists.',
  'Missing, inaccessible, superseded or disposed evidence returns a refusal, not a guess.',
  'A citation points to evidence; it does not establish current law or legal correctness.',
]

export function CitationPolicy() {
  return (
    <Panel
      title={
        <div className="flex min-w-0 items-center gap-2">
          <Quote className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold text-foreground">Citation gate</h2>
        </div>
      }
      actions={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><StatusDot tone="amber" />Unverified</span>}
      bodyClassName="space-y-3"
    >
      <Notice>Model execution stays off until these requirements are enforced and evaluated.</Notice>
      <ol className="space-y-2.5">
        {rules.map((rule, index) => (
          <li key={rule} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-foreground">
            <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
