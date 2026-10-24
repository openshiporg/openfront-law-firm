import Link from 'next/link'

import { ErrorBanner, Panel, Track, pillClass } from '@/features/platform/components/ui'

import { getRefundSetup } from '../actions/refunds'
import { BillingRefundsClient } from './BillingRefundsClient'

const actions = (
  <Track>
    <Link href="/dashboard/platform/retainers" className={pillClass}>Retainers</Link>
  </Track>
)

export async function BillingRefundsPanel() {
  const response = await getRefundSetup()
  if (!response.success) {
    return <Panel id="refunds" title="Refunds" actions={actions}><ErrorBanner title="Refunds unavailable">{response.error}</ErrorBanner></Panel>
  }
  return <BillingRefundsClient setup={response.data} actions={actions} />
}
