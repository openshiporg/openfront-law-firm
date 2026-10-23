'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { Panel, RowList, TitleLine, Track, fieldClass, labelClass, pillClass, pillPrimaryClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'

import {
  activateTrustAccount,
  openTrustAccount,
  openTrustLedger,
  type TrustSetupState,
} from '../actions/openTrustRecords'

const initial: TrustSetupState = { ok: false, message: '' }

export type TrustSetupAccount = { id: string; title: string; subtitle: string; status: string }

function Message({ state }: { state: TrustSetupState }) {
  if (!state.message) return null
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

export function TrustSetupForm({ accounts, suggestedLedgerNumber }: { accounts: TrustSetupAccount[]; suggestedLedgerNumber: string }) {
  const router = useRouter()
  const refreshing = (action: (previous: TrustSetupState, formData: FormData) => Promise<TrustSetupState>) =>
    async (previous: TrustSetupState, formData: FormData) => {
      const result = await action(previous, formData)
      if (result.ok) router.refresh()
      return result
    }
  const [accountState, accountAction, accountPending] = useActionState(refreshing(openTrustAccount), initial)
  const [ledgerState, ledgerAction, ledgerPending] = useActionState(refreshing(openTrustLedger), initial)
  const [rowState, setRowState] = useState<TrustSetupState>(initial)
  const [rowPending, startRow] = useTransition()
  const active = accounts.filter((account) => account.status === 'active')
  const pending = accounts.filter((account) => account.status === 'pending')

  function activate(id: string) {
    startRow(async () => {
      const result = await activateTrustAccount(id)
      setRowState(result)
      if (result.ok) router.refresh()
    })
  }

  return (
    <Panel id="trust-setup" title="Accounts and ledgers" bodyClassName="p-0">
      {pending.length ? (
        <div className="space-y-2 border-b border-border p-4">
          <RowList label="Pending trust accounts">
            {pending.map((account) => (
              <li key={account.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <TitleLine as="h3" status={account.status} headingClassName="text-sm">{account.title}</TitleLine>
                  <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{account.subtitle}</p>
                </div>
                <Track><button type="button" className={pillClass} disabled={rowPending} onClick={() => activate(account.id)}>{rowPending ? 'Activating…' : 'Activate'}</button></Track>
              </li>
            ))}
          </RowList>
          <Message state={rowState} />
        </div>
      ) : null}

      <div className="grid min-w-0 xl:grid-cols-2 xl:divide-x xl:divide-border">
        <form action={accountAction} className="min-w-0">
          <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">Open trust account</legend>
            <label className={cn(labelClass, 'sm:col-span-2')}>Account name<input name="name" required minLength={2} maxLength={200} autoComplete="off" className={fieldClass} /></label>
            <div className={labelClass}>
              <label htmlFor="trust-account-type">Type</label>
              <FormSelect id="trust-account-type" name="accountType" defaultValue="pooled_trust" className={cn(fieldClass, 'text-foreground')}>
                <option value="pooled_trust">IOLTA / pooled trust</option>
                <option value="trust">Trust</option>
                <option value="dedicated_client">Dedicated client trust</option>
                <option value="other">Other safeguarded funds</option>
              </FormSelect>
            </div>
            <label className={labelClass}>Currency<input name="currencyCode" defaultValue="USD" required pattern="[A-Za-z]{3}" maxLength={3} className={cn(fieldClass, 'font-mono uppercase')} /></label>
            <label className={labelClass}>Bank<input name="financialInstitutionName" required maxLength={300} autoComplete="off" className={fieldClass} /></label>
            <label className={labelClass}>Account last four<input name="bankAccountLastFour" required inputMode="numeric" pattern="\d{4}" minLength={4} maxLength={4} autoComplete="off" className={cn(fieldClass, 'font-mono tabular-nums')} /></label>
            <div className="min-w-0 sm:col-span-2">
              <SearchableOptionSelect id="trust-account-office" name="officeId" label="Office" kind="office" options={[]} emptyLabel="No office" />
            </div>
          </fieldset>
          <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
            <Track><button type="submit" className={pillPrimaryClass} disabled={accountPending}>{accountPending ? 'Opening…' : 'Open account'}</button></Track>
            <Message state={accountState} />
          </footer>
        </form>

        <form action={ledgerAction} className="min-w-0 border-t border-border xl:border-t-0">
          <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">Open client ledger</legend>
            <div className={cn(labelClass, 'sm:col-span-2')}>
              <label htmlFor="trust-ledger-account">Trust account</label>
              <FormSelect id="trust-ledger-account" name="trustAccountId" required defaultValue="" className={cn(fieldClass, 'text-foreground')}>
                <option value="" disabled>{active.length ? 'Select active account' : 'No active trust account'}</option>
                {active.map((account) => <option key={account.id} value={account.id}>{`${account.title} · ${account.subtitle}`}</option>)}
              </FormSelect>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <SearchableOptionSelect id="trust-ledger-matter" name="matterId" label="Matter" kind="matter" options={[]} emptyLabel="Client-level ledger" />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <SearchableOptionSelect id="trust-ledger-client" name="clientId" label="Client" kind="contact" options={[]} emptyLabel="Matter client" />
            </div>
            <label className={labelClass}>Ledger number<input key={suggestedLedgerNumber} name="ledgerNumber" required maxLength={60} defaultValue={suggestedLedgerNumber} autoComplete="off" className={cn(fieldClass, 'font-mono')} /></label>
          </fieldset>
          <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
            <Track><button type="submit" className={pillPrimaryClass} disabled={ledgerPending || !active.length}>{ledgerPending ? 'Opening…' : 'Open ledger'}</button></Track>
            <Message state={ledgerState} />
          </footer>
        </form>
      </div>
    </Panel>
  )
}
