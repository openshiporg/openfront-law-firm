import { PlatformDrillInPage } from '@/features/platform/desks/PlatformDrillInPage'

export default async function TimeExpenseDrillInPage({ params }: { params: Promise<{ kind: string; recordId: string }> }) {
  const { kind, recordId } = await params
  return <PlatformDrillInPage desk="time-expenses" kind={kind} recordId={recordId} />
}
