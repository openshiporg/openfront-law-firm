import { ErrorBanner } from '@/features/platform/components/ui'

import { getMessageDeliveries } from '../actions/recipients'
import { MessageDeliveriesClient } from './MessageDeliveriesClient'

export async function MessageDeliveriesPanel({ messageId }: { messageId: string }) {
  const setup = await getMessageDeliveries(messageId)
  if (!setup) return <ErrorBanner title="Deliveries unavailable">Deliveries could not be loaded for this message.</ErrorBanner>
  return <MessageDeliveriesClient messageId={messageId} setup={setup} />
}
