import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { ErrorBanner } from '@/features/platform/components/ui'
import { getTeamSetup } from '../actions/inviteStaff'
import { StaffInvitationPanel } from '../components/StaffInvitationPanel'

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

export async function TeamPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {}
  const page = Number(first(params.memberPage))
  const result = await getTeamSetup(Number.isSafeInteger(page) && page > 0 ? page : 1, first(params.memberQ))
  return (
    <PracticePage
      title="People & access"
      description="Invite staff into the active firm, assign a bounded role and office, and inspect membership state."
      meta={result.success ? <span className="tabular-nums">{result.data.membershipsCount.toLocaleString()} {result.data.membershipsCount === 1 ? 'membership' : 'memberships'}{result.data.memberQuery ? ' matching' : ''}</span> : undefined}
    >
      {!result.success ? (
        <ErrorBanner title="Team unavailable">{result.error}</ErrorBanner>
      ) : (
        <StaffInvitationPanel setup={result.data} />
      )}
    </PracticePage>
  )
}
