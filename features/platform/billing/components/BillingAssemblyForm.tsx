'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FormSelect } from '@/components/ui/form-select'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Notice, Panel, Track, fieldClass, labelClass, pillClass, pillPrimaryClass } from '@/features/platform/components/ui'
import {
  assembleInvoice,
  loadMatterBillingSources,
  searchBillingMatters,
  type BillingAssemblySetup,
  type BillingMatterOption,
  type InvoiceAssemblyState,
  type MatterBillingSources,
} from '../actions/assembleInvoice'
import { formatMoneyLabel } from '@/features/platform/lib/money'

export function BillingAssemblyForm({ setup }: { setup: BillingAssemblySetup }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<InvoiceAssemblyState, FormData>(async (previous, formData) => {
    const result = await assembleInvoice(previous, formData)
    if (result.ok) {
      setSources(null)
      const matterId = String(formData.get('matterId') ?? '')
      if (matterId) selectMatter(matterId)
      router.refresh()
    }
    return result
  }, { ok: false, message: '' })
  const unpricedIds = new Set(state.unpricedIds ?? [])
  const [selectedMatterId, setSelectedMatterId] = useState('')
  const [matterQuery, setMatterQuery] = useState('')
  const [found, setFound] = useState<BillingMatterOption[]>([])
  const [sources, setSources] = useState<{ matterId: string; data: MatterBillingSources } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, startLoading] = useTransition()
  const options = [...new Map([...setup.matters, ...found].map((matter) => [matter.id, matter])).values()]
  const loaded = sources && sources.matterId === selectedMatterId ? sources.data : null

  function selectMatter(matterId: string) {
    setSelectedMatterId(matterId)
    setLoadError('')
    if (!matterId) return
    startLoading(async () => {
      const result = await loadMatterBillingSources(matterId)
      if (result.success) setSources({ matterId, data: result.data })
      else setLoadError(result.error)
    })
  }

  function findMatters() {
    setLoadError('')
    startLoading(async () => {
      const result = await searchBillingMatters(matterQuery)
      if (result.success) setFound(result.data)
      else setLoadError(result.error)
    })
  }

  const errors = (
    <>
      {loadError ? <p role="alert" className="min-w-0 break-words text-sm text-destructive">{loadError}</p> : null}
      {state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'min-w-0 break-words text-sm text-foreground' : 'min-w-0 break-words text-sm text-destructive'}>{state.message}</p> : null}
    </>
  )

  return (
    <Panel title={<h2 id="invoice-assembly-heading" className="min-w-0 truncate text-sm font-semibold text-foreground">Draft invoice</h2>} bodyClassName="p-0">
      <div aria-labelledby="invoice-assembly-heading" role="group" className="min-w-0">
        <div className="border-b border-border p-4">
          <div className={cn(labelClass, 'sm:max-w-xl')}>
            <label htmlFor="billing-matter-search">Find matter</label>
            <div className="flex min-w-0 items-center gap-2">
              <input id="billing-matter-search" value={matterQuery} onChange={(event) => setMatterQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findMatters() } }} maxLength={100} placeholder="Number or title" className={cn(fieldClass, 'text-foreground')} />
              <Track className="shrink-0 overflow-visible"><button type="button" className={pillClass} onClick={findMatters} disabled={loading || !matterQuery.trim()}><Search className="size-3.5" aria-hidden="true" />Find</button></Track>
            </div>
          </div>
        </div>

        {!options.length ? (
          <div className="space-y-2 p-4">
            <p role="status" className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No matter with approved, unbilled work</p>
            {errors}
          </div>
        ) : (
          <form action={action} className="min-w-0">
            <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
              <div className={labelClass}>
                <label htmlFor="billing-matter">Matter</label>
                <FormSelect id="billing-matter" name="matterId" value={selectedMatterId} onValueChange={selectMatter} required className={cn(fieldClass, 'text-foreground')}>
                  <option value="">Select matter</option>
                  {options.map((matter) => <option key={matter.id} value={matter.id}>{matter.matterNumber} · {matter.title} · {matter.client?.displayName}</option>)}
                </FormSelect>
              </div>
              <label htmlFor="invoiceNumber" className={labelClass}>
                Invoice number
                <input key={setup.suggestedInvoiceNumber} id="invoiceNumber" name="invoiceNumber" className={cn(fieldClass, 'font-mono')} required maxLength={120} defaultValue={setup.suggestedInvoiceNumber} autoComplete="off" />
              </label>
            </div>

            <div className="border-t border-border">
              {!selectedMatterId ? <p className="px-4 py-6 text-sm text-muted-foreground">No matter selected</p> : null}
              {selectedMatterId && loading && !loaded ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">Loading sources…</p> : null}
              {loaded ? (
                <>
                  <div className="grid min-w-0 lg:grid-cols-2 lg:divide-x lg:divide-border">
                    <SourceList
                      title="Approved time"
                      count={loaded.timeTotal}
                      empty="No approved, unbilled time"
                      sources={loaded.timeEntries.filter((entry) => entry.matter.id === selectedMatterId).map((entry) => ({
                        id: `time:${entry.id}`,
                        title: entry.description,
                        meta: `${entry.matter.matterNumber} · ${entry.durationMinutes} min`,
                        amount: formatMoneyLabel(entry.amountMinor, entry.currencyCode, 'Unpriced'),
                        unpriced: entry.amountMinor === null,
                        flagged: unpricedIds.has(entry.id),
                      }))}
                    />
                    <SourceList
                      title="Approved expenses"
                      count={loaded.expenseTotal}
                      empty="No approved, unbilled expenses"
                      sources={loaded.expenses.filter((expense) => expense.matter.id === selectedMatterId).map((expense) => ({
                        id: `expense:${expense.id}`,
                        title: expense.description,
                        meta: expense.matter.matterNumber,
                        amount: formatMoneyLabel(expense.amountMinor, expense.currencyCode),
                      }))}
                      bordered
                    />
                  </div>
                  {loaded.timeTotal > loaded.timeEntries.length || loaded.expenseTotal > loaded.expenses.length ? (
                    <div className="border-t border-border px-4 py-3">
                      <Notice>Oldest {loaded.timeEntries.length.toLocaleString()} time entries and {loaded.expenses.length.toLocaleString()} expenses shown; the rest appear after this draft.</Notice>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
              <Track><button type="submit" className={pillPrimaryClass} disabled={pending || !loaded}>{pending ? 'Assembling…' : 'Assemble draft'}</button></Track>
              {errors}
            </footer>
          </form>
        )}
      </div>
    </Panel>
  )
}

type Source = { id: string; title: string; meta: string; amount: string; unpriced?: boolean; flagged?: boolean }

function SourceList({ title, count, empty, sources, bordered = false }: { title: string; count: number; empty: string; sources: Source[]; bordered?: boolean }) {
  return (
    <fieldset className={cn('min-w-0 px-4 py-4', bordered && 'border-t border-border lg:border-t-0')}>
      <legend className="float-left flex w-full items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}<span className="font-mono font-normal tabular-nums">{count.toLocaleString()}</span>
      </legend>
      {!sources.length ? <p className="clear-both pt-3 text-sm text-muted-foreground">{empty}</p> : (
        <div className="clear-both mt-2 max-h-72 divide-y divide-border overflow-y-auto">
          {sources.map((source) => (
            <div key={source.id} className={cn('flex min-w-0 items-start gap-3 py-2.5 text-sm', source.flagged && '-mx-2 rounded-lg bg-destructive/5 px-2')}>
              <input id={`source-${source.id}`} type="checkbox" name="source" value={source.id} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground" />
              <label htmlFor={`source-${source.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block truncate font-medium text-foreground">{source.title}</span>
                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{source.meta}</span>
              </label>
              <span className="shrink-0 text-right">
                <span className={cn('block font-mono text-sm tabular-nums', source.unpriced ? 'text-amber-700 dark:text-amber-400' : 'text-foreground')}>{source.amount}</span>
                {source.unpriced ? <a href="#billing-rates" className="block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Set rate</a> : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  )
}
