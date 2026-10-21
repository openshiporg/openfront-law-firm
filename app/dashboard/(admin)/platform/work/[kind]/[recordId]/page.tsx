import { PlatformDrillInPage } from '@/features/platform/desks/PlatformDrillInPage'

export default async function WorkDrillInPage({ params }: { params: Promise<{ kind: string; recordId: string }> }) {
  const { kind, recordId } = await params
  return <PlatformDrillInPage desk="work" kind={kind} recordId={recordId} />
}
