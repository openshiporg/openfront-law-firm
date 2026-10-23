import { ErrorBanner } from '@/features/platform/components/ui'

import { getPaymentSetup } from '../actions/payments'
import { BillingPaymentForm } from './BillingPaymentForm'

export async function BillingPaymentPanel() {
  const response = await getPaymentSetup()
  if (!response.success) return <div id="record-payment" className="scroll-mt-20"><ErrorBanner title="Payments unavailable">{response.error}</ErrorBanner></div>
  return <BillingPaymentForm setup={response.data} />
}
