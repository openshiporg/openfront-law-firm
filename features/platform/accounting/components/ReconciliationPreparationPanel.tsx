'use client'

import { useActionState, useState } from 'react'

import { cn } from '@/lib/utils'
import { Notice, Panel, Track, fieldClass, labelClass, pillPrimaryClass, textareaClass } from '@/features/platform/components/ui'
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
  const amountClass = cn(fieldClass, 'text-right font-mono tabular-nums')
  return (
    <Panel title={<h2 id="reconciliation-preparation-title" className="min-w-0 truncate text-sm font-semibold text-foreground">Trust reconciliation</h2>} bodyClassName="p-0">
      <form action={action} aria-labelledby="reconciliation-preparation-title" className="min-w-0">
        <div className="space-y-5 p-4">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0 sm:col-span-2 xl:col-span-1">
              <SearchableOptionSelect id="reconciliation-account" name="trustAccountId" label="Trust account" emptyLabel="Select an active account" required kind="trustAccount" total={accountTotal} options={accounts} onOptionChange={(option) => setCurrencyCode(option?.currencyCode || 'USD')} />
            </div>
            <label className={labelClass}>Period start<input name="periodStart" type="date" required className={fieldClass} /></label>
            <label className={labelClass}>Period end<input name="periodEnd" type="date" required className={fieldClass} /></label>
          </div>

          <div className="grid min-w-0 gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-3">
            <label className={labelClass}>Adjusted bank statement ({currencyCode})<input name="statementBalance" inputMode="decimal" required autoComplete="off" pattern={amountPattern} className={amountClass} /></label>
            <label className={labelClass}>Cashbook / control ({currencyCode})<input name="bookBalance" inputMode="decimal" required autoComplete="off" pattern={amountPattern} className={amountClass} /></label>
            <label className={labelClass}>Currency<input name="currencyCode" value={currencyCode} readOnly className={cn(fieldClass, 'bg-muted/40 font-mono uppercase')} /></label>
            <label className={cn(labelClass, 'sm:col-span-2 xl:col-span-3')}>Preparation notes<textarea name="notes" maxLength={4000} rows={3} className={textareaClass} /></label>
          </div>

          <Notice>Cashbook is verified against posted entries and client ledgers at period end. Completion requires a different reviewer and zero difference.</Notice>
        </div>
        <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
          <Track><button disabled={pending || !accounts.length} className={pillPrimaryClass}>{pending ? 'Preparing…' : 'Prepare draft reconciliation'}</button></Track>
          {state.message ? <p role="status" className={state.ok ? 'min-w-0 break-words text-sm text-foreground' : 'min-w-0 break-words text-sm text-destructive'}>{state.message}</p> : null}
        </footer>
      </form>
    </Panel>
  )
}
