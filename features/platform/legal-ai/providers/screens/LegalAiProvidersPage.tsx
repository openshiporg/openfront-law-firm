import { Meta, MetaGrid, Panel, RowList, TitleLine, type Tone } from '@/features/platform/components/ui'
import { LegalAiBoundaryNotice, LegalAiNav, LegalAiPage } from '@/features/platform/legal-ai/assistant/components/LegalAiSurface'

const boundaries = [
  { title: 'Model execution', status: 'unavailable', detail: 'No AI model connected. Run requests are refused.' },
  { title: 'Assistant tools', status: 'disabled', detail: 'External assistants cannot read or change legal records here.' },
  { title: 'Provider configuration', status: 'unavailable', detail: 'Provider not configured. Do not enter provider credentials.' },
  { title: 'Changes to records', status: 'approval required', detail: 'AI-proposed changes require approval by an authorized person and are audited.' },
] as const

const tone = (status: string): Tone => (status === 'approval required' ? 'amber' : 'zinc')

export function LegalAiProvidersPage() {
  return (
    <LegalAiPage title="Provider boundary" description="AI providers are not connected.">
      <LegalAiNav current="/dashboard/platform/ai/providers" />
      <LegalAiBoundaryNotice compact />
      <RowList label="Legal AI provider controls">
        {boundaries.map((boundary) => (
          <li key={boundary.title} className="min-w-0 px-4 py-3">
            <TitleLine as="h2" status={boundary.status} tone={tone(boundary.status)} headingClassName="text-sm">{boundary.title}</TitleLine>
            <p className="mt-1 pl-4 text-sm leading-6 text-muted-foreground">{boundary.detail}</p>
          </li>
        ))}
      </RowList>
      <Panel title="Without a provider" bodyClassName="py-3">
        <MetaGrid className="sm:grid-cols-3 lg:grid-cols-3">
          <Meta label="Unsupported requests">Refused, never guessed</Meta>
          <Meta label="Evidence browsing">No key required</Meta>
          <Meta label="System of record">Openfront Law Firm</Meta>
        </MetaGrid>
      </Panel>
    </LegalAiPage>
  )
}
