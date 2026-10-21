import { PlatformDrillInPage } from '@/features/platform/desks/PlatformDrillInPage'

export default async function DocumentDrillInPage({ params }: { params: Promise<{ kind: string; recordId: string }> }) {
  const { kind, recordId } = await params
  return <PlatformDrillInPage desk="documents" kind={kind} recordId={recordId} />
}
