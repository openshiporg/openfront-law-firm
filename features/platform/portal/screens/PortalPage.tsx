import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import { WorkspaceScreen } from '@/features/platform/workspaces/WorkspaceScreen'

export async function PortalPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams ?? {}
  const value = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : undefined
  const page = value('page')
  return <WorkspaceScreen category="portal" portalParams={{ search: value('search'), status: value('status'), page: page ? Number(page) : 1, matterId: value('matterId'), portalAccountId: value('portalAccountId') }} register={parseRegisterParams(raw)} />
}
