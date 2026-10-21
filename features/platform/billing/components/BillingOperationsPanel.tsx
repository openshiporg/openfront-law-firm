import { getBillingAssemblySetup } from '../actions/assembleInvoice'
import { BillingAssemblyForm } from './BillingAssemblyForm'

export async function BillingOperationsPanel() {
  const response = await getBillingAssemblySetup()
  if (!response.success) {
    return <div role="alert" className="border-y border-destructive/30 px-4 py-6 text-sm text-destructive">Invoice assembly is unavailable: {response.error}</div>
  }
  return <BillingAssemblyForm setup={response.data} />
}
