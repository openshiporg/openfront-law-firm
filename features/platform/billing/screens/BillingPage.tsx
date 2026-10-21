import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'
import { WorkspaceScreen } from '@/features/platform/workspaces/WorkspaceScreen'

type BillingSearchParams = Record<string, string | string[] | undefined> & {
  invoicePage?: string | string[]
  paymentPage?: string | string[]
}

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export async function BillingPage({ searchParams }: { searchParams: Promise<BillingSearchParams> }) {
  const params = await searchParams
  return <WorkspaceScreen category="billing" invoicePage={pageNumber(params.invoicePage)} paymentPage={pageNumber(params.paymentPage)} register={parseRegisterParams(params)} />
}
