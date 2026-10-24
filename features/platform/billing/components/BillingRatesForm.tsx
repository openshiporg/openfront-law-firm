'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { Notice, Panel, RowList, TitleLine, Track, fieldClass, labelClass, pillClass, pillPrimaryClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { formatMoneyLabel } from '@/features/platform/lib/money'

import {
  addRateRule,
  createRateCard,
  priceUnapprovedTime,
  setRateCardStatus,
  type BillingRatesSetup,
  type RateActionState,
} from '../actions/rates'
import { useKeptForm } from '../../components/useKeptForm'

const initial: RateActionState = { ok: false, message: '' }

function Message({ state }: { state: RateActionState }) {
  if (!state.message) return null
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

export function BillingRatesForm({ setup }: { setup: BillingRatesSetup }) {
  const router = useRouter()
  const refreshing = (action: (previous: RateActionState, formData: FormData) => Promise<RateActionState>) =>
    async (previous: RateActionState, formData: FormData) => {
      const result = await action(previous, formData)
      if (result.ok) router.refresh()
      return result
    }
  const [cardState, cardAction, cardPending] = useActionState(refreshing(createRateCard), initial)
  const cardActionForm = useKeptForm(cardAction, cardState)
  const [ruleState, ruleAction, rulePending] = useActionState(refreshing(addRateRule), initial)
  const ruleActionForm = useKeptForm(ruleAction, ruleState)
  const [rowState, setRowState] = useState<RateActionState>(initial)
  const [rowPending, startRow] = useTransition()
  const usableCards = setup.cards.filter((card) => card.status !== 'retired')

  function runRow(work: () => Promise<RateActionState>) {
    startRow(async () => {
      const result = await work()
      setRowState(result)
      if (result.ok) router.refresh()
    })
  }

  return (
    <Panel id="billing-rates" title="Rates" bodyClassName="p-0">
      <div className="min-w-0">
        {setup.unpricedOpenTime || setup.unpricedApprovedTime ? (
          <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border p-4">
            {setup.unpricedApprovedTime ? <Notice className="min-w-0 flex-1">{setup.unpricedApprovedTime.toLocaleString()} approved time {setup.unpricedApprovedTime === 1 ? 'entry has' : 'entries have'} no amount</Notice> : null}
            {setup.unpricedOpenTime ? (
              <Track>
                <button type="button" className={pillClass} disabled={rowPending || !usableCards.length} onClick={() => runRow(priceUnapprovedTime)}>
                  {rowPending ? 'Pricing…' : `Price ${setup.unpricedOpenTime.toLocaleString()} draft or submitted ${setup.unpricedOpenTime === 1 ? 'entry' : 'entries'}`}
                </button>
              </Track>
            ) : null}
          </div>
        ) : null}

        {setup.cards.length ? (
          <div className="border-b border-border p-4">
            <RowList label="Rate cards">
              {setup.cards.map((card) => (
                <li key={card.id} className="grid min-w-0 gap-2 px-4 py-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <TitleLine as="h3" status={card.status} headingClassName="text-sm">{card.name}</TitleLine>
                    <Track>
                      {card.status === 'draft' ? <button type="button" className={pillClass} disabled={rowPending} onClick={() => runRow(() => setRateCardStatus(card.id, 'active'))}>Activate</button> : null}
                      <button type="button" className={pillClass} disabled={rowPending} onClick={() => runRow(() => setRateCardStatus(card.id, 'retired'))}>Retire</button>
                    </Track>
                  </div>
                  <p className="min-w-0 truncate pl-4 text-xs text-muted-foreground">{card.matter ? `Matter ${card.matter.matterNumber}` : 'Firm-wide'} · {card.currencyCode}</p>
                  {card.rules.length ? (
                    <ul className="grid min-w-0 gap-1 pl-4">
                      {card.rules.map((rule) => (
                        <li key={rule.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs">
                          <span className="font-mono text-sm tabular-nums text-foreground">{formatMoneyLabel(rule.amountMinor, rule.currencyCode)}/{rule.rateType === 'hourly' ? 'hour' : rule.rateType.replaceAll('_', ' ')}</span>
                          <span className="min-w-0 truncate text-muted-foreground">{[rule.user?.name ?? 'All timekeepers', rule.practiceArea?.name ?? 'any practice area', rule.matter ? rule.matter.matterNumber : null].filter(Boolean).join(' · ')}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="pl-4 text-xs text-muted-foreground">No rates</p>}
                </li>
              ))}
            </RowList>
          </div>
        ) : null}
        {rowState.message ? <div className="border-b border-border px-4 py-3"><Message state={rowState} /></div> : null}

        <div className="grid min-w-0 lg:grid-cols-2 lg:divide-x lg:divide-border">
          <form {...cardActionForm} className="min-w-0">
            <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">New rate card</legend>
              <label className={cn(labelClass, 'sm:col-span-2')}>Name<input name="name" required minLength={2} maxLength={200} className={fieldClass} autoComplete="off" /></label>
              <div className="min-w-0 sm:col-span-2">
                <SearchableOptionSelect id="rate-card-matter" name="matterId" label="Matter (blank for firm-wide)" kind="matter" options={[]} emptyLabel="Firm-wide" />
              </div>
              <label className={labelClass}>Currency<input name="currencyCode" defaultValue="USD" required pattern="[A-Za-z]{3}" maxLength={3} className={cn(fieldClass, 'font-mono uppercase')} /></label>
              <label className={labelClass}>Effective from<input name="effectiveFrom" type="date" className={fieldClass} /></label>
            </fieldset>
            <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
              <Track><button type="submit" className={pillPrimaryClass} disabled={cardPending}>{cardPending ? 'Creating…' : 'Create rate card'}</button></Track>
              <Message state={cardState} />
            </footer>
          </form>

          <form {...ruleActionForm} className="min-w-0 border-t border-border lg:border-t-0">
            <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">Hourly rate</legend>
              <div className={cn(labelClass, 'sm:col-span-2')}>
                <label htmlFor="rate-rule-card">Rate card</label>
                <FormSelect id="rate-rule-card" name="rateCardId" required defaultValue="" className={cn(fieldClass, 'text-foreground')}>
                  <option value="" disabled>{usableCards.length ? 'Select rate card' : 'No rate card'}</option>
                  {usableCards.map((card) => <option key={card.id} value={card.id}>{card.name} · {card.matter ? card.matter.matterNumber : 'Firm-wide'} · {card.currencyCode}</option>)}
                </FormSelect>
              </div>
              <label className={labelClass}>Rate per hour<input name="amount" inputMode="decimal" required autoComplete="off" pattern="\d+(\.\d{1,3})?" className={cn(fieldClass, 'text-right font-mono tabular-nums')} /></label>
              <div className="min-w-0">
                <SearchableOptionSelect id="rate-rule-member" name="userId" label="Timekeeper" kind="member" options={[]} emptyLabel="All timekeepers" />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <SearchableOptionSelect id="rate-rule-area" name="practiceAreaId" label="Practice area" kind="practiceArea" options={[]} emptyLabel="Any practice area" />
              </div>
            </fieldset>
            <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
              <Track><button type="submit" className={pillPrimaryClass} disabled={rulePending || !usableCards.length}>{rulePending ? 'Adding…' : 'Add rate'}</button></Track>
              <Message state={ruleState} />
            </footer>
          </form>
        </div>
      </div>
    </Panel>
  )
}
