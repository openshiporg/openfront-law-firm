'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { decimalToMinorUnits } from '@/features/platform/lib/money'

export type TrustPostingState = { ok: boolean; message: string }

const mutation = `
  mutation PostTrustTransaction($data: TrustTransactionPostingInput!) {
    postTrustTransaction(data: $data) {
      transaction { id transactionNumber status occurredAt }
      replayed
    }
  }
`

export async function runTrustPosting(
  _previous: TrustPostingState,
  formData: FormData,
): Promise<TrustPostingState> {
  try {
    const trustAccountId = String(formData.get('trustAccountId') ?? '').trim()
    const ledgerAccountId = String(formData.get('ledgerAccountId') ?? '').trim()
    const transactionType = String(formData.get('transactionType') ?? '').trim()
    const currencyCode = String(formData.get('currencyCode') ?? '').trim().toUpperCase()
    const description = String(formData.get('description') ?? '').trim()
    const idempotencyKey = String(formData.get('idempotencyKey') ?? '').trim()
    const amountText = String(formData.get('amount') ?? '').trim()
    if (!trustAccountId || !ledgerAccountId) throw new Error('A trust account and client ledger are required.')
    if (!['deposit', 'disbursement'].includes(transactionType)) throw new Error('Unsupported guided trust posting type.')
    if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Currency must be a three-letter code.')
    // Exact decimal -> minor units for the account currency; extra precision is rejected.
    const amountMinor = decimalToMinorUnits(amountText, currencyCode)
    if (amountMinor <= 0) throw new Error('Amount must be greater than zero.')
    if (description.length < 5 || description.length > 500) throw new Error('Description must be 5–500 characters.')
    if (idempotencyKey.length < 12 || idempotencyKey.length > 160) throw new Error('Idempotency key must be 12–160 characters.')

    const deposit = transactionType === 'deposit'
    const data = {
      idempotencyKey,
      trustAccountId,
      transactionType,
      currencyCode,
      occurredAt: new Date().toISOString(),
      description,
      entries: [
        {
          accountingBucket: 'bank_control',
          direction: deposit ? 'debit' : 'credit',
          amountMinor,
          currencyCode,
          memo: description,
        },
        {
          ledgerAccountId,
          accountingBucket: 'client_liability',
          direction: deposit ? 'credit' : 'debit',
          amountMinor,
          currencyCode,
          memo: description,
        },
      ],
    }
    const response = await keystoneClient<Record<string, unknown>>(mutation, { data })
    if (!response.success) return { ok: false, message: response.error.split('\n')[0].slice(0, 500) }
    revalidatePath('/dashboard/platform/accounting')
    revalidatePath('/dashboard')
    return { ok: true, message: 'Balanced trust posting recorded through the controlled ledger transaction.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Trust posting failed.' }
  }
}
