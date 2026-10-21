'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { Landmark } from 'lucide-react'

import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { currencyFractionDigits } from '@/features/platform/lib/money'
import type { PracticeOption } from '@/features/platform/operations/lib/practiceOptions'
import {
  runTrustPosting,
  type TrustPostingState,
} from '@/features/platform/operations/actions/runTrustPosting'

const initialState: TrustPostingState = { ok: false, message: '' }

// The operation reference is created on the first submit and reused for every retry of
// that posting, so an unanswered request can be repeated without posting twice. It is
// replaced only after a confirmed posting or when staff explicitly start a new one.
export function TrustPostingPanel({ accounts, ledgers, accountTotal, ledgerTotal }: { accounts: PracticeOption[]; ledgers: PracticeOption[]; accountTotal?: number; ledgerTotal?: number }) {
  const [operationKey, setOperationKey] = useState<string | null>(null)
  const [state, action, pending] = useActionState(async (previous: TrustPostingState, formData: FormData) => {
    const key = operationKey ?? `trust-posting-${crypto.randomUUID()}`
    setOperationKey(key)
    formData.set('idempotencyKey', key)
    const result = await runTrustPosting(previous, formData)
    if (result.ok) setOperationKey(null)
    return result
  }, initialState)
  const [currencyCode, setCurrencyCode] = useState('USD')
  const digits = currencyFractionDigits(currencyCode) ?? 2

  return (
    <section aria-labelledby="trust-posting-title" className="border-y border-border py-5">
      <div className="mb-5 flex max-w-3xl items-start gap-3">
        <Landmark className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 id="trust-posting-title" className="text-lg font-bold tracking-tight">Guided trust posting</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Record a balanced deposit or disbursement between bank control and one exact client/matter subledger. Corrections use the separate exact-reversal workflow.
          </p>
        </div>
      </div>

      <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SearchableOptionSelect id="trust-posting-account" name="trustAccountId" label="Trust account" emptyLabel="Select an account" required kind="trustAccount" total={accountTotal} options={accounts} onOptionChange={(option) => setCurrencyCode(option?.currencyCode || 'USD')} />
        <SearchableOptionSelect id="trust-posting-ledger" name="ledgerAccountId" label="Client or matter ledger" emptyLabel="Select a ledger" required kind="trustLedger" total={ledgerTotal} options={ledgers} />
        <label className="space-y-1.5 text-sm font-medium">
          <span>Posting type</span>
          <FormSelect name="transactionType" className="min-h-10 w-full rounded-md border border-input bg-background px-3">
            <option value="deposit">Deposit</option>
            <option value="disbursement">Disbursement</option>
          </FormSelect>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Amount ({currencyCode})</span>
          <input name="amount" inputMode="decimal" required autoComplete="off" pattern={digits ? `\\d+(\\.\\d{1,${digits}})?` : '\\d+'} placeholder={digits ? `250.${'0'.repeat(digits)}` : '250'} className="min-h-10 w-full rounded-md border border-input bg-background px-3" />
          <span className="block text-xs font-normal text-muted-foreground">{digits ? `Up to ${digits} decimal place${digits === 1 ? '' : 's'}.` : 'Whole amounts only.'}</span>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Currency</span>
          <input name="currencyCode" value={currencyCode} readOnly className="min-h-10 w-full rounded-md border border-input bg-muted/30 px-3 uppercase" />
        </label>
        <label className="space-y-1.5 text-sm font-medium md:col-span-2 xl:col-span-3">
          <span>Description</span>
          <textarea name="description" minLength={5} maxLength={500} required rows={3} className="w-full rounded-md border border-input bg-background p-3" placeholder="Describe the source and purpose without including unnecessary confidential content." />
        </label>
        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <button disabled={pending || !accounts.length || !ledgers.length} className="min-h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
            {pending ? 'Posting…' : 'Post balanced transaction'}
          </button>
          {!accounts.length || !ledgers.length ? <p className="text-xs text-muted-foreground">An active trust account and active client ledger are required.</p> : null}
          {operationKey ? <p className="text-xs text-muted-foreground">Operation reference <span className="font-mono">{operationKey}</span> — submitting again repeats this same posting. <button type="button" className="underline" onClick={() => setOperationKey(null)}>Start a new posting</button></p> : null}
          {state.message ? <p role="status" className={state.ok ? 'text-sm text-foreground' : 'text-sm text-destructive'}>{state.message}</p> : null}
        </div>
      </form>
    </section>
  )
}
