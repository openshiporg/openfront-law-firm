import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import { WorkspaceScreen } from '@/features/platform/workspaces/WorkspaceScreen'

type IntakeSearchParams = Record<string, string | string[] | undefined> & {
  intakePage?: string | string[]
  conflictPage?: string | string[]
  reviewPage?: string | string[]
  decisionPage?: string | string[]
}

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export async function IntakePage({ searchParams }: { searchParams: Promise<IntakeSearchParams> }) {
  const params = await searchParams
  return <WorkspaceScreen category="intake" intakePage={pageNumber(params.intakePage)} conflictPage={pageNumber(params.conflictPage)} conflictReviewPage={pageNumber(params.reviewPage)} decisionPage={pageNumber(params.decisionPage)} register={parseRegisterParams(params)} />
}
