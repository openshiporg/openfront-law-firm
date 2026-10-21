import { PracticePage } from '@/features/platform/components/PracticeSurface'
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
    <PracticePage title="People & access" description="Invite staff into the active firm, assign a bounded role and office, and inspect membership state.">
      {!result.success ? (
        <div role="alert" className="border-y border-destructive/30 px-4 py-6 text-sm text-destructive">{result.error}</div>
      ) : (
        <StaffInvitationPanel setup={result.data} />
      )}
    </PracticePage>
  )
}
