import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import { WorkspaceScreen } from '@/features/platform/workspaces/WorkspaceScreen'

export async function DataPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <WorkspaceScreen category="data" register={parseRegisterParams((await searchParams) ?? {})} />
}
