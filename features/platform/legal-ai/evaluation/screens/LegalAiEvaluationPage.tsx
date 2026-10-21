import { Check, FlaskConical, Minus } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { LegalAiBoundaryNotice, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

const gates = [
  { name: 'Access protection', state: 'in place', measure: 'Evidence from firms, matters, walls and document versions you cannot access is never included.' },
  { name: 'Citations for every statement', state: 'not available', measure: 'Each statement would point to a source you are allowed to see.' },
  { name: 'Valid legal authorities', state: 'not available', measure: 'Cited authorities would be checked for court, jurisdiction, date and quoted passage.' },
  { name: 'Clear refusals', state: 'in place', measure: 'Unsupported requests and missing evidence get an explicit “unavailable” answer.' },
  { name: 'Approved changes only', state: 'not available', measure: 'Suggested changes would need approval and would be recorded in the audit trail.' },
  { name: 'Retention and holds', state: 'not available', measure: 'AI inputs and outputs would follow the same holds and retention rules as other records.' },
  { name: 'Quality review', state: 'not available', measure: 'Results would be checked against reviewed examples before any workflow is switched on.' },
] as const

export function LegalAiEvaluationPage() {
  
  return (
    <LegalAiPage title="Legal AI evaluation gates" description="The safeguards an AI workflow must meet before it is switched on, and which are in place today.">
      <LegalAiBoundaryNotice compact />
      
      <section className="divide-y divide-border border-y border-border" aria-label="Evaluation gate definitions">
        {gates.map((gate) => (
          <article key={gate.name} className="grid min-w-0 gap-3 px-2 py-4 md:grid-cols-[1.25rem_minmax(0,0.45fr)_minmax(0,1fr)]">
            {gate.state === 'in place' ? <Check className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Minus className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            <div className="flex flex-wrap items-start gap-2">
              <h2 className="text-sm font-bold text-foreground">{gate.name}</h2>
              <PracticeStatus status={gate.state} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{gate.measure}</p>
          </article>
        ))}
      </section>
      <div className="flex items-start gap-3 border-y border-border bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        
      </div>
    </LegalAiPage>
  )
}
