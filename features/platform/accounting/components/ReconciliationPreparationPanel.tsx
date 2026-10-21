'use client'

import { useActionState, useState } from 'react'
import { Scale } from 'lucide-react'

import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { currencyFractionDigits } from '@/features/platform/lib/money'
import type { PracticeOption } from '@/features/platform/operations/lib/practiceOptions'
import {
  prepareReconciliation,
  type ReconciliationPreparationState,
} from '../actions/prepareReconciliation'

const initialState: ReconciliationPreparationState = { ok: false, message: '' }

export function ReconciliationPreparationPanel({ accounts, accountTotal }: { accounts: PracticeOption[]; accountTotal?: number }) {
  const [state, action, pending] = useActionState(prepareReconciliation, initialState)
  const [currencyCode, setCurrencyCode] = useState('USD')
  const digits = currencyFractionDigits(currencyCode) ?? 2
  const amountPattern = digits ? `-?\\d+(\\.\\d{1,${digits}})?` : '-?\\d+'
  return (
    <section aria-labelledby="reconciliation-preparation-title" className="border-y border-border py-5">
      <div className="mb-5 flex max-w-3xl items-start gap-3">
        <Scale className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 id="reconciliation-preparation-title" className="text-lg font-bold tracking-tight">Prepare trust reconciliation</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Capture one period, its adjusted bank-statement balance, and the cashbook/control balance. The server verifies the submitted cashbook against posted bank-control entries and the total individual client/matter ledgers as of period end. A different authorized reviewer must complete a zero-difference reconciliation.</p>
        </div>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SearchableOptionSelect id="reconciliation-account" name="trustAccountId" label="Trust account" emptyLabel="Select an active account" required kind="trustAccount" total={accountTotal} options={accounts} onOptionChange={(option) => setCurrencyCode(option?.currencyCode || 'USD')} />
        <label className="space-y-1.5 text-sm font-medium"><span>Period start</span><input name="periodStart" type="date" required className="min-h-10 w-full rounded-md border border-input bg-background px-3" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>Period end</span><input name="periodEnd" type="date" required className="min-h-10 w-full rounded-md border border-input bg-background px-3" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>Adjusted bank-statement balance ({currencyCode})</span><input name="statementBalance" inputMode="decimal" required autoComplete="off" pattern={amountPattern} className="min-h-10 w-full rounded-md border border-input bg-background px-3" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>Cashbook/control balance ({currencyCode})</span><input name="bookBalance" inputMode="decimal" required autoComplete="off" pattern={amountPattern} className="min-h-10 w-full rounded-md border border-input bg-background px-3" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>Currency</span><input name="currencyCode" value={currencyCode} readOnly className="min-h-10 w-full rounded-md border border-input bg-muted/30 px-3 uppercase" /></label>
        <label className="space-y-1.5 text-sm font-medium md:col-span-2 xl:col-span-3"><span>Preparation notes</span><textarea name="notes" maxLength={4000} rows={3} className="w-full rounded-md border border-input bg-background p-3" /></label>
        <div className="space-y-2 md:col-span-2 xl:col-span-3"><button disabled={pending || !accounts.length} className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">{pending ? 'Preparing…' : 'Prepare draft reconciliation'}</button>{state.message ? <p role="status" className={state.ok ? 'text-sm text-foreground' : 'text-sm text-destructive'}>{state.message}</p> : null}</div>
      </form>
    </section>
  )
}
