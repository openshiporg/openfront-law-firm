import { LegalAiReviewPage } from '@/features/platform/legal-ai/reviews/screens/LegalAiReviewPage'

export default async function Page({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params
  return <LegalAiReviewPage reviewId={reviewId} />
}
