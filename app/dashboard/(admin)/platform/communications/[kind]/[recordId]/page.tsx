import { PlatformDrillInPage } from '@/features/platform/desks/PlatformDrillInPage'

export default async function CommunicationDrillInPage({ params }: { params: Promise<{ kind: string; recordId: string }> }) {
  const { kind, recordId } = await params
  return <PlatformDrillInPage desk="communications" kind={kind} recordId={recordId} />
}
