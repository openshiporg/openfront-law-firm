import { RowList, Stats, TitleLine } from '@/features/platform/components/ui'
import { LegalAiBoundaryNotice, LegalAiNav, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

const workflowDefinitions = [
  {
    name: 'Matter evidence preparation',
    status: 'source ready',
    purpose: 'Matter, document versions, tasks, deadlines and audit history in one evidence view.',
    boundary: 'Available. Read-only; nothing generated or concluded.',
  },
  {
    name: 'Document review table',
    status: 'execution unavailable',
    purpose: 'A document set reviewed against the same questions, every answer tied to a source.',
    boundary: 'Unavailable: no AI model connected.',
  },
  {
    name: 'Draft with tracked changes',
    status: 'execution unavailable',
    purpose: 'Suggested edits to one document version for a reviewer to accept or reject.',
    boundary: 'Unavailable: no AI model connected.',
  },
  {
    name: 'Legal research with authorities',
    status: 'execution unavailable',
    purpose: 'Primary sources with court, jurisdiction, date and quoted passage.',
    boundary: 'Unavailable: no research source connected; no authorities produced.',
  },
] as const

export function LegalAiWorkflowsPage() {
  const ready = workflowDefinitions.filter((workflow) => workflow.status === 'source ready').length
  return (
    <LegalAiPage title="Controlled workflows" description="Available workflows and those not yet enabled.">
      <LegalAiNav current="/dashboard/platform/ai/workflows" />
      <LegalAiBoundaryNotice compact />
      <Stats items={[['Available', String(ready)], ['Unavailable', String(workflowDefinitions.length - ready)], ['Approval', 'Required']]} />
      <RowList label="Legal AI workflow definitions">
        {workflowDefinitions.map((workflow, index) => (
          <li key={workflow.name} className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 px-4 py-4 md:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,0.9fr)] md:gap-x-4">
            <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <TitleLine as="h2" status={workflow.status} tone={workflow.status === 'source ready' ? 'emerald' : 'zinc'} headingClassName="text-sm">{workflow.name}</TitleLine>
              <p className="mt-1 pl-4 text-sm leading-6 text-muted-foreground">{workflow.purpose}</p>
            </div>
            <p className="col-start-2 mt-2 rounded-[4px] bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground md:col-start-3 md:mt-0 md:self-start">{workflow.boundary}</p>
          </li>
        ))}
      </RowList>
    </LegalAiPage>
  )
}
