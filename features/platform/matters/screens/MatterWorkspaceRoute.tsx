import { MatterWorkspacePage } from './MatterWorkspacePage'

type MatterWorkspaceSearchParams = { teamPage?: string | string[]; partyPage?: string | string[]; communicationPage?: string | string[]; deadlinePage?: string | string[]; taskPage?: string | string[]; documentPage?: string | string[]; invoicePage?: string | string[] }

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

// Route bridge for the thin matter page: validates every register page parameter before
// the workspace screen loads.
export async function MatterWorkspaceRoute({ params, searchParams }: {
  params: Promise<{ matterId: string }>
  searchParams: Promise<MatterWorkspaceSearchParams>
}) {
  const [{ matterId }, query] = await Promise.all([params, searchParams])
  return <MatterWorkspacePage matterId={matterId} teamPage={pageNumber(query.teamPage)} partyPage={pageNumber(query.partyPage)} communicationPage={pageNumber(query.communicationPage)} deadlinePage={pageNumber(query.deadlinePage)} taskPage={pageNumber(query.taskPage)} documentPage={pageNumber(query.documentPage)} invoicePage={pageNumber(query.invoicePage)} />
}
