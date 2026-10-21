import { OperatingDesk } from '@/features/platform/desks/OperatingDesk'
import { parseRegisterParams } from '@/features/platform/operations/lib/workspaceRegister'

type DocumentsSearchParams = Record<string, string | string[] | undefined> & {
  documentPage?: string | string[]
  signaturePage?: string | string[]
}

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export async function DocumentsPage({ searchParams }: { searchParams: Promise<DocumentsSearchParams> }) {
  const params = await searchParams
  return (
    <OperatingDesk
      desk="documents"
      documentPage={pageNumber(params.documentPage)}
      signaturePage={pageNumber(params.signaturePage)}
      register={parseRegisterParams(params)}
    />
  )
}
