import { ErrorBanner } from '@/features/platform/components/ui'
import { getBillingAssemblySetup } from '../actions/assembleInvoice'
import { BillingAssemblyForm } from './BillingAssemblyForm'

export async function BillingOperationsPanel() {
  const response = await getBillingAssemblySetup()
  if (!response.success) {
    return <ErrorBanner title="Invoice assembly unavailable">{response.error}</ErrorBanner>
  }
  return <BillingAssemblyForm setup={response.data} />
}
