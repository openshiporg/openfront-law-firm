import { addStripeProviders, listPaymentProviders, togglePaymentProvider } from '../actions/paymentProviders'
import { isPaymentProviderConfigured } from '@/features/keystone/utils/paymentProviderConfig'

export async function PaymentProvidersPage() {
  const result = await listPaymentProviders()
  const providers = result.success ? result.data.paymentProviders : []
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Payment providers</h1>
        <p className="text-sm text-muted-foreground">
          Operating payments settle invoices. Trust deposits use a separate account, with card fees billed to operating (ABA Model Rule 1.15).
        </p>
      </div>
      {!result.success && <p className="text-sm text-destructive">{result.error}</p>}
      <ul className="divide-y rounded-lg border">
        {providers.map((provider) => {
          const configured = isPaymentProviderConfigured(provider.code, provider.credentials ?? undefined)
          return (
            <li key={provider.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="font-medium">{provider.name}</div>
                <div className="text-xs text-muted-foreground">
                  {provider.code} · {provider.account === 'trust' ? 'Trust / IOLTA' : 'Operating'} · {configured ? 'Keys configured' : 'Not configured'}
                </div>
              </div>
              <form action={togglePaymentProvider}>
                <input type="hidden" name="id" value={provider.id} />
                <input type="hidden" name="isInstalled" value={String(!provider.isInstalled)} />
                <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">
                  {provider.isInstalled ? 'Disable' : 'Enable'}
                </button>
              </form>
            </li>
          )
        })}
        {!providers.length && <li className="p-4 text-sm text-muted-foreground">No payment providers yet.</li>}
      </ul>
      {providers.length < 2 && (
        <form action={addStripeProviders}>
          <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Add Stripe operating and trust accounts</button>
        </form>
      )}
    </div>
  )
}
