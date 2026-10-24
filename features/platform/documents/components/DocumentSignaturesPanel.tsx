import { ErrorBanner } from '@/features/platform/components/ui'

import { getDocumentSignatures } from '../actions/signatureRequests'
import { SignatureRequestsPanel } from './SignatureRequestsPanel'

export async function DocumentSignaturesPanel({ documentId }: { documentId: string }) {
  const setup = await getDocumentSignatures(documentId)
  if (!setup) return <ErrorBanner title="Signatures unavailable">Signature requests could not be loaded for this document.</ErrorBanner>
  return <SignatureRequestsPanel documentId={documentId} setup={setup} />
}
