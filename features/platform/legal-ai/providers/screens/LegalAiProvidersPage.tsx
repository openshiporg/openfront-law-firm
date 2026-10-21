import { Ban, KeyRound, ServerCog } from 'lucide-react'

import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { LegalAiBoundaryNotice, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

const boundaries = [
  { title: 'Model execution', status: 'unavailable', detail: 'No AI model is connected. Requests to run one are refused rather than answered.' },
  { title: 'Assistant tools', status: 'disabled', detail: 'External assistants cannot read or change legal records through this workspace.' },
  { title: 'Provider configuration', status: 'unavailable', detail: 'This evidence workspace does not run a model. Do not enter provider credentials to use it.' },
  { title: 'Changes to records', status: 'approval required', detail: 'Any AI-proposed change must be approved by an authorized person and is recorded in the audit trail.' },
] as const

export function LegalAiProvidersPage() {
  return (
    <LegalAiPage title="Provider boundary" description="AI providers are not connected. This page shows what is switched off and how access stays protected.">
      <LegalAiBoundaryNotice compact />
      <section className="divide-y divide-border border-y border-border" aria-label="Legal AI provider controls">
        {boundaries.map((boundary) => (
          <article key={boundary.title} className="grid min-w-0 gap-3 px-2 py-4 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)] sm:items-start">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">{boundary.title}</h2>
              <PracticeStatus status={boundary.status} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{boundary.detail}</p>
          </article>
        ))}
      </section>
      <div className="divide-y divide-border border-y border-border">
        {[
          { icon: Ban, title: 'Refuses instead of guessing', copy: 'When no provider is available you get a clear “unavailable” message, never a made-up answer.' },
          { icon: KeyRound, title: 'No key needed for evidence browsing', copy: 'Browse the records you are permitted to read without connecting an AI provider.' },
          { icon: ServerCog, title: 'One source of truth', copy: 'Matters, documents, access, retention, portal and audit records all stay in Openfront Law Firm.' },
        ].map((item) => (
          <section key={item.title} className="grid min-w-0 gap-3 px-2 py-4 sm:grid-cols-[2rem_minmax(0,0.45fr)_minmax(0,1fr)] sm:items-start">
            <item.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-bold text-foreground">{item.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{item.copy}</p>
          </section>
        ))}
      </div>
    </LegalAiPage>
  )
}
