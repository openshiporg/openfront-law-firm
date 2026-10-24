import { ErrorBanner } from '@/features/platform/components/ui'

import { getThreadRecipients } from '../actions/recipients'
import { ThreadRecipientsClient } from './ThreadRecipientsClient'

export async function ThreadRecipientsPanel({ threadId }: { threadId: string }) {
  const setup = await getThreadRecipients(threadId)
  if (!setup) return <ErrorBanner title="Recipients unavailable">Recipients could not be loaded for this thread.</ErrorBanner>
  return <ThreadRecipientsClient threadId={threadId} setup={setup} />
}
