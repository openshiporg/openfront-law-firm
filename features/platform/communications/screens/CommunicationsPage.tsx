import { OperatingDesk } from '@/features/platform/desks/OperatingDesk'
import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'

type CommunicationsSearchParams = Record<string, string | string[] | undefined> & {
  deliveryPage?: string | string[]
}

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export async function CommunicationsPage({ searchParams }: { searchParams: Promise<CommunicationsSearchParams> }) {
  const params = await searchParams
  return <OperatingDesk desk="communications" deliveryPage={pageNumber(params.deliveryPage)} register={parseRegisterParams(params)} />
}
