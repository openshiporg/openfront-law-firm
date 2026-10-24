import { ErrorBanner, Panel } from '@/features/platform/components/ui'

import { getGovernanceSetup } from '../actions/governance'
import { LegalHoldForm, RetentionPolicyManager } from './GovernanceClient'

export async function GovernanceManagementPanel() {
  const response = await getGovernanceSetup()
  if (!response.success) return <Panel id="retention-policies" title="Retention policies"><ErrorBanner title="Policies unavailable">{response.error}</ErrorBanner></Panel>
  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <RetentionPolicyManager setup={response.data} />
      <LegalHoldForm policies={response.data.policies.filter((policy) => policy.status !== 'retired').map((policy) => ({ id: policy.id, label: `${policy.name} · ${policy.code}` }))} />
    </div>
  )
}
