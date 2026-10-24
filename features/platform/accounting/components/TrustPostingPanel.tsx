'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'

import { cn } from '@/lib/utils'
import { Notice, Panel, Track, fieldClass, labelClass, pillClass, pillPrimaryClass, textareaClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { currencyFractionDigits } from '@/features/platform/lib/money'
import type { PracticeOption } from '@/features/platform/operations/lib/practiceOptions'
import {
  runTrustPosting,
  type TrustPostingState,
} from '@/features/platform/operations/actions/runTrustPosting'
import { useKeptForm } from '../../components/useKeptForm'

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
  const actionForm = useKeptForm(action, state)
  const [currencyCode, setCurrencyCode] = useState('USD')
  const digits = currencyFractionDigits(currencyCode) ?? 2
  const unavailable = !accounts.length || !ledgers.length

  return (
    <Panel title={<h2 id="trust-posting-title" className="min-w-0 truncate text-sm font-semibold text-foreground">Trust posting</h2>} bodyClassName="p-0">
      <form {...actionForm} aria-labelledby="trust-posting-title" className="min-w-0">
        <div className="space-y-5 p-4">
          {unavailable ? <Notice>Requires an active trust account and client ledger.</Notice> : null}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <SearchableOptionSelect id="trust-posting-account" name="trustAccountId" label="Trust account" emptyLabel="Select an account" required kind="trustAccount" total={accountTotal} options={accounts} onOptionChange={(option) => setCurrencyCode(option?.currencyCode || 'USD')} />
            <SearchableOptionSelect id="trust-posting-ledger" name="ledgerAccountId" label="Client or matter ledger" emptyLabel="Select a ledger" required kind="trustLedger" total={ledgerTotal} options={ledgers} />
          </div>

          <div className="grid min-w-0 gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-3">
            <div className={labelClass}>
              <label htmlFor="trust-posting-type">Posting type</label>
              <FormSelect id="trust-posting-type" name="transactionType" className={cn(fieldClass, 'text-foreground')}>
                <option value="deposit">Deposit</option>
                <option value="disbursement">Disbursement</option>
              </FormSelect>
            </div>
            <label className={labelClass}>
              <span className="flex items-baseline justify-between gap-2">
                <span>Amount ({currencyCode})</span>
                <span className="font-normal">{digits ? `${digits} decimal${digits === 1 ? '' : 's'} max` : 'Whole amounts'}</span>
              </span>
              <input name="amount" inputMode="decimal" required autoComplete="off" pattern={digits ? `\\d+(\\.\\d{1,${digits}})?` : '\\d+'} placeholder={digits ? `250.${'0'.repeat(digits)}` : '250'} className={cn(fieldClass, 'text-right font-mono tabular-nums')} />
            </label>
            <label className={labelClass}>
              Currency
              <input name="currencyCode" value={currencyCode} readOnly className={cn(fieldClass, 'bg-muted/40 font-mono uppercase')} />
            </label>
            <label className={cn(labelClass, 'sm:col-span-2 xl:col-span-3')}>
              Description
              <textarea name="description" minLength={5} maxLength={500} required rows={3} className={textareaClass} placeholder="Source and purpose" />
            </label>
          </div>

          <Notice>Balanced entry between bank control and one client/matter ledger. Corrections use exact reversal.</Notice>
        </div>

        <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
          <Track>
            <button disabled={pending || unavailable} className={pillPrimaryClass}>{pending ? 'Posting…' : 'Post balanced transaction'}</button>
            {operationKey ? <button type="button" className={pillClass} onClick={() => setOperationKey(null)}>Start a new posting</button> : null}
          </Track>
          {state.message ? <p role="status" className={state.ok ? 'min-w-0 break-words text-sm text-foreground' : 'min-w-0 break-words text-sm text-destructive'}>{state.message}</p> : null}
          {operationKey ? (
            <p className="w-full min-w-0 break-all text-xs text-muted-foreground">
              Reference <span className="font-mono text-foreground">{operationKey}</span> · resubmitting repeats this same posting
            </p>
          ) : null}
        </footer>
      </form>
    </Panel>
  )
}
