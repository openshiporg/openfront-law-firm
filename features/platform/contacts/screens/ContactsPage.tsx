import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import { WorkspaceScreen } from '@/features/platform/workspaces/WorkspaceScreen'

type ContactsSearchParams = Record<string, string | string[] | undefined> & {
  relationshipPage?: string | string[]
}

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export async function ContactsPage({ searchParams }: { searchParams: Promise<ContactsSearchParams> }) {
  const params = await searchParams
  return <WorkspaceScreen category="contacts" relationshipPage={pageNumber(params.relationshipPage)} register={parseRegisterParams(params)} />
}
