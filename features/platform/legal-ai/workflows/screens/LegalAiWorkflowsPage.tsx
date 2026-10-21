import { CheckCircle2, CircleDashed } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { LegalAiBoundaryNotice, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

const workflowDefinitions = [
  {
    name: 'Matter evidence preparation',
    status: 'source ready',
    purpose: 'Gather the matter, document versions, tasks, deadlines and audit history you can see into one evidence view.',
    boundary: 'Available now. Read-only; nothing is generated or concluded.',
  },
  {
    name: 'Document review table',
    status: 'execution unavailable',
    purpose: 'Review a set of documents against the same questions, with every answer tied to a source.',
    boundary: 'Not available: no AI model is connected.',
  },
  {
    name: 'Draft with tracked changes',
    status: 'execution unavailable',
    purpose: 'Suggest edits to one document version for a reviewer to accept or reject.',
    boundary: 'Not available: no AI model is connected.',
  },
  {
    name: 'Legal research with authorities',
    status: 'execution unavailable',
    purpose: 'Find primary sources with court, jurisdiction, date and a quoted passage.',
    boundary: 'Not available: no research source is connected, so no authorities are produced.',
  },
] as const

export function LegalAiWorkflowsPage() {
  return (
    <LegalAiPage title="Controlled AI workflows" description="What you can do here today, and which AI workflows are not available yet.">
      <LegalAiBoundaryNotice compact />
      <section className="divide-y divide-border border-y border-border" aria-label="Legal AI workflow definitions">
        {workflowDefinitions.map((workflow, index) => (
          <article key={workflow.name} className="grid min-w-0 gap-4 px-2 py-5 md:grid-cols-[2rem_minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">{workflow.name}</h2>
                <PracticeStatus status={workflow.status} />
              </div>
              
            </div>
            <div className="flex items-start gap-3 border-l border-border pl-4 text-sm leading-6 text-muted-foreground">
              {workflow.status === 'source ready' ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /> : <CircleDashed className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />}
              <p>{workflow.boundary}</p>
            </div>
          </article>
        ))}
      </section>
    </LegalAiPage>
  )
}
