'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { Notice, Panel, Track, fieldClass, labelClass, pillClass, pillPrimaryClass, textareaClass } from '@/features/platform/components/ui'
import { currencyFractionDigits } from '@/features/platform/lib/money'

import {
  getRetainerMatterContext,
  prepareRetainer,
  type RetainerActionState,
  type RetainerFormSetup,
  type RetainerMatterContext,
} from '../actions/retainers'
import { CONTINGENCY_FEES, FEE_STRUCTURES } from '../lib/retainerOptions'

const initial: RetainerActionState = { ok: false, message: '' }

export function RetainerCreateForm({ setup, preselectedMatterId, cancelHref }: { setup: RetainerFormSetup; preselectedMatterId?: string; cancelHref: string }) {
  const router = useRouter()
  const startMatter = setup.matters.some((matter) => matter.id === preselectedMatterId) ? preselectedMatterId ?? '' : ''
  const [matterId, setMatterId] = useState(startMatter)
  const [context, setContext] = useState<RetainerMatterContext | null>(null)
  const [contextError, setContextError] = useState('')
  const [loadingContext, startContext] = useTransition()
  const [clientId, setClientId] = useState('')
  const [feeStructure, setFeeStructure] = useState('hourly')
  const [currencyCode, setCurrencyCode] = useState(setup.defaultCurrency)
  const [rateCardId, setRateCardId] = useState('')
  const [ledgerId, setLedgerId] = useState('')

  useEffect(() => {
    setContext(null)
    setContextError('')
    setRateCardId('')
    setLedgerId('')
    if (!matterId) { setClientId(''); return }
    startContext(async () => {
      const result = await getRetainerMatterContext(matterId)
      if (!result.success) { setContextError(result.error); setClientId(''); return }
      setContext(result.data)
      setClientId(result.data.defaultClientId ?? result.data.clients[0]?.id ?? '')
    })
  }, [matterId])

  const [state, run, pending] = useActionState(async (previous: RetainerActionState, formData: FormData) => {
    const result = await prepareRetainer(previous, formData)
    if (result.ok && result.retainerId) router.push(`/dashboard/platform/retainers/${result.retainerId}`)
    else if (result.ok) router.refresh()
    return result
  }, initial)

  const currency = currencyCode.trim().toUpperCase()
  const digits = currencyFractionDigits(currency) ?? 2
  const amountPattern = digits ? `\\d+(\\.\\d{1,${digits}})?` : '\\d+'
  const contingent = CONTINGENCY_FEES.has(feeStructure)
  const rateCards = (context?.rateCards ?? []).filter((card) => card.currencyCode.toUpperCase() === currency)
  const ledgers = (context?.trustLedgers ?? []).filter((ledger) => ledger.clientId === clientId && ledger.currencyCode.toUpperCase() === currency)

  return (
    <Panel id="new-retainer" title="New retainer agreement" bodyClassName="p-0">
      <form action={run} className="min-w-0">
        <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3" disabled={pending}>
          <div className={cn(labelClass, 'sm:col-span-2')}>
            <label htmlFor="retainer-matter">Matter</label>
            <FormSelect id="retainer-matter" name="matterId" required value={matterId} onValueChange={setMatterId} className={cn(fieldClass, 'text-foreground')}>
              <option value="" disabled>{setup.matters.length ? 'Select matter' : 'No open matter'}</option>
              {setup.matters.map((matter) => <option key={matter.id} value={matter.id}>{`${matter.matterNumber}${matter.title ? ` · ${matter.title}` : ''}`}</option>)}
            </FormSelect>
          </div>
          <div className={labelClass}>
            <label htmlFor="retainer-client">Client</label>
            <FormSelect id="retainer-client" name="clientId" required value={clientId} onValueChange={setClientId} disabled={!context} className={cn(fieldClass, 'text-foreground')}>
              <option value="" disabled>{loadingContext ? 'Loading…' : matterId ? 'Select client' : 'Choose a matter first'}</option>
              {(context?.clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}
            </FormSelect>
          </div>
          <label className={labelClass}>
            Agreement number
            <input name="agreementNumber" required maxLength={100} defaultValue={setup.suggestedNumber} autoComplete="off" className={cn(fieldClass, 'font-mono')} />
          </label>
          <div className={labelClass}>
            <label htmlFor="retainer-fee">Fee structure</label>
            <FormSelect id="retainer-fee" name="feeStructure" required value={feeStructure} onValueChange={setFeeStructure} className={cn(fieldClass, 'text-foreground')}>
              {FEE_STRUCTURES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </FormSelect>
          </div>
          <label className={labelClass}>
            Currency
            <input name="currencyCode" required maxLength={3} minLength={3} pattern="[A-Za-z]{3}" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} autoComplete="off" className={cn(fieldClass, 'font-mono uppercase')} />
          </label>
          <div className={labelClass}>
            <label htmlFor="retainer-rate-card">Rate card</label>
            <FormSelect id="retainer-rate-card" name="rateCardId" value={rateCardId} onValueChange={setRateCardId} disabled={!context} aria-label="rate card" className={cn(fieldClass, 'text-foreground')}>
              <option value="">{rateCards.length ? 'No rate card' : `No active ${currency} rate card`}</option>
              {rateCards.map((card) => <option key={card.id} value={card.id}>{`${card.name}${card.matterScoped ? ' · this matter' : ''}`}</option>)}
            </FormSelect>
          </div>
          <div className={labelClass}>
            <label htmlFor="retainer-ledger">Trust ledger</label>
            <FormSelect id="retainer-ledger" name="trustLedgerAccountId" value={ledgerId} onValueChange={setLedgerId} disabled={!context} aria-label="trust ledger" className={cn(fieldClass, 'text-foreground')}>
              <option value="">{ledgers.length ? 'No trust ledger' : `No active ${currency} ledger for this client`}</option>
              {ledgers.map((ledger) => <option key={ledger.id} value={ledger.id}>{ledger.ledgerNumber}</option>)}
            </FormSelect>
          </div>
          <label className={labelClass}>
            Initial retainer ({currency})
            <input name="initialRetainer" inputMode="decimal" pattern={amountPattern} autoComplete="off" className={cn(fieldClass, 'text-right font-mono tabular-nums')} />
          </label>
          <label className={labelClass}>
            Evergreen threshold ({currency})
            <input name="evergreenThreshold" inputMode="decimal" pattern={amountPattern} autoComplete="off" className={cn(fieldClass, 'text-right font-mono tabular-nums')} />
          </label>
          <label className={labelClass}>
            Replenishment amount ({currency})
            <input name="replenishmentAmount" inputMode="decimal" pattern={amountPattern} autoComplete="off" className={cn(fieldClass, 'text-right font-mono tabular-nums')} />
          </label>
          <label className={labelClass}>
            Contingency %
            <input key={contingent ? 'on' : 'off'} name="contingencyPercent" inputMode="decimal" pattern="\d{1,3}(\.\d{1,2})?" required={contingent} disabled={!contingent} placeholder={contingent ? '33.33' : 'Contingency and hybrid only'} autoComplete="off" className={cn(fieldClass, 'text-right font-mono tabular-nums')} />
          </label>
          <label className={cn(labelClass, 'sm:col-span-2 lg:col-span-3')}>
            Terms summary
            <textarea name="termsSummary" maxLength={4000} rows={4} className={textareaClass} />
          </label>
          {contextError ? <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-3">{contextError}</p> : null}
          <Notice className="sm:col-span-2 lg:col-span-3">Terms are fixed once prepared. A changed agreement is a new draft.</Notice>
        </fieldset>
        <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
          <Track>
            <button type="submit" className={pillPrimaryClass} disabled={pending || !context || !clientId}>{pending ? 'Preparing…' : 'Prepare draft'}</button>
            <Link href={cancelHref} className={pillClass}>Cancel</Link>
          </Track>
          {state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : null}
        </footer>
      </form>
    </Panel>
  )
}
