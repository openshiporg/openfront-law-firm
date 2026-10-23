import { RowList, Stats, TitleLine } from '@/features/platform/components/ui'
import { LegalAiBoundaryNotice, LegalAiNav, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

const gates = [
  { name: 'Access protection', state: 'in place', measure: 'Evidence from firms, matters, walls and document versions you cannot access is excluded.' },
  { name: 'Citations for every statement', state: 'not available', measure: 'Each statement points to a source you are allowed to see.' },
  { name: 'Valid legal authorities', state: 'not available', measure: 'Court, jurisdiction, date and quoted passage checked for each cited authority.' },
  { name: 'Clear refusals', state: 'in place', measure: 'Unsupported requests and missing evidence return an explicit “unavailable”.' },
  { name: 'Approved changes only', state: 'not available', measure: 'Suggested changes require approval and are recorded in the audit trail.' },
  { name: 'Retention and holds', state: 'not available', measure: 'AI inputs and outputs follow the same holds and retention rules as other records.' },
  { name: 'Quality review', state: 'not available', measure: 'Results checked against reviewed examples before any workflow is switched on.' },
] as const

export function LegalAiEvaluationPage() {
  const passing = gates.filter((gate) => gate.state === 'in place').length
  return (
    <LegalAiPage title="Evaluation gates" description="Safeguards an AI workflow must meet before it is switched on.">
      <LegalAiNav current="/dashboard/platform/ai/evaluation" />
      <LegalAiBoundaryNotice compact />
      <Stats items={[['Gates in place', `${passing} of ${gates.length}`], ['Not available', String(gates.length - passing)], ['Workflows enabled', '0']]} />
      <RowList label="Evaluation gate definitions">
        {gates.map((gate, index) => (
          <li key={gate.name} className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 px-4 py-3">
            <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <TitleLine as="h2" status={gate.state} tone={gate.state === 'in place' ? 'emerald' : 'zinc'} headingClassName="text-sm">{gate.name}</TitleLine>
              <p className="mt-1 pl-4 text-sm leading-6 text-muted-foreground">{gate.measure}</p>
            </div>
          </li>
        ))}
      </RowList>
    </LegalAiPage>
  )
}
