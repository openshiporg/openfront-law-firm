'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type PaymentProviderRow = {
  id: string
  name: string
  code: string
  account: 'operating' | 'trust'
  isInstalled: boolean
  credentials: { secretKeyEnv?: string } | null
}

export async function listPaymentProviders() {
  return keystoneClient<{ paymentProviders: PaymentProviderRow[] }>(`
    query PaymentProviders {
      paymentProviders(orderBy: [{ account: asc }, { code: asc }], take: 50) { id name code account isInstalled credentials }
    }
  `)
}

export async function togglePaymentProvider(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const isInstalled = String(formData.get('isInstalled') ?? '') === 'true'
  if (!id) return
  await keystoneClient(`
    mutation TogglePaymentProvider($id: ID!, $isInstalled: Boolean) {
      updatePaymentProvider(where: { id: $id }, data: { isInstalled: $isInstalled }) { id }
    }
  `, { id, isInstalled })
  revalidatePath('/dashboard/platform/payment-providers')
}

const FUNCTIONS = {
  createPaymentFunction: 'stripe', capturePaymentFunction: 'stripe', refundPaymentFunction: 'stripe',
  getPaymentStatusFunction: 'stripe', generatePaymentLinkFunction: 'stripe', handleWebhookFunction: 'stripe',
}

// Adds the standard operating and trust Stripe provider records when the firm does not have them yet.
export async function addStripeProviders() {
  const existing = await listPaymentProviders()
  const have = new Set(existing.success ? existing.data.paymentProviders.map((row) => row.code) : [])
  const wanted = [
    { name: 'Stripe (operating account)', code: 'pp_stripe_operating', account: 'operating', credentials: { secretKeyEnv: 'STRIPE_SECRET_KEY' } },
    { name: 'Stripe (trust / IOLTA account)', code: 'pp_stripe_trust', account: 'trust', credentials: { secretKeyEnv: 'STRIPE_TRUST_SECRET_KEY' } },
  ]
  for (const data of wanted.filter((row) => !have.has(row.code))) {
    await keystoneClient(`
      mutation CreatePaymentProvider($data: PaymentProviderCreateInput!) { createPaymentProvider(data: $data) { id } }
    `, { data: { ...data, ...FUNCTIONS, isInstalled: true } })
  }
  revalidatePath('/dashboard/platform/payment-providers')
}
