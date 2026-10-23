import { ErrorBanner } from '@/features/platform/components/ui'

import { getBillingRatesSetup } from '../actions/rates'
import { BillingRatesForm } from './BillingRatesForm'

export async function BillingRatesPanel() {
  const response = await getBillingRatesSetup()
  if (!response.success) return <div id="billing-rates" className="scroll-mt-20"><ErrorBanner title="Rates unavailable">{response.error}</ErrorBanner></div>
  return <BillingRatesForm setup={response.data} />
}
