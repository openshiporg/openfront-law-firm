import { OperatingDesk } from '@/features/platform/desks/OperatingDesk'
import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'

export async function MattersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {}
  return <OperatingDesk desk="matters" register={parseRegisterParams(params)} />
}
