import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import { WorkspaceScreen } from '@/features/platform/workspaces/WorkspaceScreen'

type ReportsSearchParams = Record<string, string | string[] | undefined> & {
  auditPage?: string | string[]
  reportDeadlinePage?: string | string[]
}

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export async function ReportsPage({ searchParams }: { searchParams: Promise<ReportsSearchParams> }) {
  const params = await searchParams
  return <WorkspaceScreen category="reports" auditPage={pageNumber(params.auditPage)} reportDeadlinePage={pageNumber(params.reportDeadlinePage)} register={parseRegisterParams(params)} />
}
