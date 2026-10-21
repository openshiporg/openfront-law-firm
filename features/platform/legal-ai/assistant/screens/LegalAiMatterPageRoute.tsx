import { LegalAiMatterPage } from './LegalAiMatterPage'

const pageNumber = (value: string | string[] | undefined) => {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

// Route bridge: resolves the matter id and each evidence list's page before rendering.
export async function LegalAiMatterPageRoute({ params, searchParams }: { params: Promise<{ matterId: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ matterId }, query] = await Promise.all([params, searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>)])
  return <LegalAiMatterPage matterId={matterId} pages={{ documentPage: pageNumber(query.documentPage), taskPage: pageNumber(query.taskPage), deadlinePage: pageNumber(query.deadlinePage), auditPage: pageNumber(query.auditPage) }} />
}
