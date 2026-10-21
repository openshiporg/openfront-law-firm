import { OperatingDesk } from '@/features/platform/desks/OperatingDesk'
import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'

type WorkSearchParams = Record<string, string | string[] | undefined> & {
  deadlinePage?: string | string[]
  taskPage?: string | string[]
}

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export async function WorkPage({ searchParams }: { searchParams: Promise<WorkSearchParams> }) {
  const params = await searchParams
  return (
    <OperatingDesk
      desk="work"
      workPages={{ deadlines: pageNumber(params.deadlinePage), tasks: pageNumber(params.taskPage) }}
      register={parseRegisterParams(params)}
    />
  )
}
