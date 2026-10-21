/* Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 · audience: billing staff · use: assemble a draft from approved matter sources · tone: technical/austere · genre: modern-minimal · macrostructure: Source ledger · theme: Quiet */
'use client'

import { useActionState, useState, useTransition } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { FilePlus2, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [state, action, pending] = useActionState<InvoiceAssemblyState, FormData>(assembleInvoice, { ok: false, message: '' })
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

  return (
    <section className="border-y border-border py-5" aria-labelledby="invoice-assembly-heading">
      <div className="flex items-start gap-3 px-1">
        <FilePlus2 className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 id="invoice-assembly-heading" className="text-base font-bold text-foreground">Assemble a draft invoice</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Choose a matter, then select its approved, billable, unbilled time and expenses. Selections are checked again when the draft is created.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 px-1 sm:max-w-xl">
        <Label htmlFor="billing-matter-search">Find a matter by number or title</Label>
        <div className="flex gap-2">
          <Input id="billing-matter-search" value={matterQuery} onChange={(event) => setMatterQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findMatters() } }} maxLength={100} className="min-h-11" />
          <Button type="button" variant="outline" className="min-h-11" onClick={findMatters} disabled={loading || !matterQuery.trim()}><Search className="h-4 w-4" aria-hidden="true" />Find</Button>
        </div>
      </div>

      {!options.length ? (
        <p className="mt-4 border-y border-dashed border-border px-3 py-6 text-sm text-muted-foreground">No authorized matter with approved, billable, unbilled work was found. Search above for a specific matter.</p>
      ) : (
        <form action={action} className="mt-5 space-y-5">
          <div className="grid gap-4 px-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing-matter">Matter</Label>
              <FormSelect id="billing-matter" name="matterId" value={selectedMatterId} onValueChange={selectMatter} required className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50">
                <option value="">Select one matter</option>
                {options.map((matter) => <option key={matter.id} value={matter.id}>{matter.matterNumber} · {matter.title} · {matter.client?.displayName}</option>)}
              </FormSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice number</Label>
              <Input id="invoiceNumber" name="invoiceNumber" className="min-h-11" required maxLength={120} placeholder="INV-2026-0042" />
            </div>
          </div>

          {!selectedMatterId ? <p className="border-y border-dashed border-border px-4 py-5 text-sm text-muted-foreground">Select a matter to load its approved, billable, unbilled sources.</p> : null}
          {selectedMatterId && loading && !loaded ? <p role="status" className="border-y border-dashed border-border px-4 py-5 text-sm text-muted-foreground">Loading this matter’s approved sources…</p> : null}
          {loaded ? (
            <>
              <div className="grid border-y border-border lg:grid-cols-2">
                <SourceList
                  title={`Approved time · ${loaded.timeTotal.toLocaleString()}`}
                  empty="No approved, billable, unbilled time is visible."
                  sources={loaded.timeEntries.filter((entry) => entry.matter.id === selectedMatterId).map((entry) => ({
                    id: `time:${entry.id}`,
                    title: entry.description,
                    meta: `${entry.matter.matterNumber} · ${entry.durationMinutes} min · ${formatMoneyLabel(entry.amountMinor, entry.currencyCode, 'unpriced')}`,
                  }))}
                />
                <SourceList
                  title={`Approved expenses · ${loaded.expenseTotal.toLocaleString()}`}
                  empty="No approved, billable, unbilled expenses are visible."
                  sources={loaded.expenses.filter((expense) => expense.matter.id === selectedMatterId).map((expense) => ({
                    id: `expense:${expense.id}`,
                    title: expense.description,
                    meta: `${expense.matter.matterNumber} · ${formatMoneyLabel(expense.amountMinor, expense.currencyCode)}`,
                  }))}
                  bordered
                />
              </div>
              {loaded.timeTotal > loaded.timeEntries.length || loaded.expenseTotal > loaded.expenses.length ? (
                <p role="note" className="px-1 text-sm text-muted-foreground">The oldest {loaded.timeEntries.length.toLocaleString()} time entries and {loaded.expenses.length.toLocaleString()} expenses are listed. Once these are drafted, the remaining approved sources appear here for the next draft.</p>
              ) : null}
            </>
          ) : null}

          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center">
            <Button type="submit" className="min-h-11 whitespace-nowrap" disabled={pending || !loaded}>{pending ? 'Assembling…' : 'Assemble draft'}</Button>
            <div className="min-h-6 text-sm">
              {loadError ? <p role="alert" className="text-destructive">{loadError}</p> : null}
              {state.message ? <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'text-foreground' : 'text-destructive'}>{state.message}</p> : null}
            </div>
          </div>
        </form>
      )}
    </section>
  )
}

function SourceList({ title, empty, sources, bordered = false }: { title: string; empty: string; sources: Array<{ id: string; title: string; meta: string }>; bordered?: boolean }) {
  return (
    <fieldset className={`min-w-0 px-4 py-4 ${bordered ? 'border-t border-border lg:border-l lg:border-t-0' : ''}`}>
      <legend className="px-1 text-sm font-bold text-foreground">{title}</legend>
      {!sources.length ? <p className="py-4 text-sm text-muted-foreground">{empty}</p> : (
        <div className="mt-2 max-h-72 divide-y divide-border overflow-y-auto">
          {sources.map((source) => (
            <label key={source.id} className="flex min-w-0 cursor-pointer items-start gap-3 py-3 text-sm">
              <input type="checkbox" name="source" value={source.id} className="mt-1 h-4 w-4 shrink-0" />
              <span className="min-w-0"><span className="block truncate font-semibold text-foreground">{source.title}</span><span className="mt-1 block truncate text-muted-foreground">{source.meta}</span></span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
