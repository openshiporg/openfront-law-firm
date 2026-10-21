'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { decimalToMinorUnits } from '@/features/platform/lib/money'

export type ReconciliationPreparationState = { ok: boolean; message: string }

export async function prepareReconciliation(
  _previous: ReconciliationPreparationState,
  formData: FormData,
): Promise<ReconciliationPreparationState> {
  const trustAccountId = String(formData.get('trustAccountId') ?? '').trim()
  const periodStart = String(formData.get('periodStart') ?? '').trim()
  const periodEnd = String(formData.get('periodEnd') ?? '').trim()
  const currencyCode = String(formData.get('currencyCode') ?? '').trim().toUpperCase()
  const notes = String(formData.get('notes') ?? '').trim()
  if (!trustAccountId || !periodStart || !periodEnd) return { ok: false, message: 'Account and reconciliation period are required.' }
  // Balances are entered as currency amounts and converted exactly to integer minor units.
  let statementBalanceMinor: number
  let bookBalanceMinor: number
  try {
    statementBalanceMinor = decimalToMinorUnits(String(formData.get('statementBalance') ?? ''), currencyCode)
    bookBalanceMinor = decimalToMinorUnits(String(formData.get('bookBalance') ?? ''), currencyCode)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Check the balances.' }
  }
  const response = await keystoneClient<{ prepareTrustReconciliation: { id: string; status: string } }>(`
    mutation PrepareTrustReconciliation(
      $trustAccountId: ID!
      $periodStart: DateTime!
      $periodEnd: DateTime!
      $statementBalanceMinor: Int!
      $bookBalanceMinor: Int!
      $currencyCode: String!
      $notes: String
    ) {
      prepareTrustReconciliation(
        trustAccountId: $trustAccountId
        periodStart: $periodStart
        periodEnd: $periodEnd
        statementBalanceMinor: $statementBalanceMinor
        bookBalanceMinor: $bookBalanceMinor
        currencyCode: $currencyCode
        notes: $notes
      ) { id status }
    }
  `, {
    trustAccountId,
    periodStart: new Date(`${periodStart}T00:00:00.000Z`).toISOString(),
    periodEnd: new Date(`${periodEnd}T23:59:59.999Z`).toISOString(),
    statementBalanceMinor,
    bookBalanceMinor,
    currencyCode,
    notes,
  })
  if (!response.success) return { ok: false, message: response.error }
  revalidatePath('/dashboard/platform/accounting')
  return { ok: true, message: 'Draft three-way reconciliation prepared with immutable preparer and as-of balance evidence.' }
}
