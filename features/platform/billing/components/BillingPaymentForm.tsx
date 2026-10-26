'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { Panel, Track, fieldClass, labelClass, pillClass, pillPrimaryClass } from '@/features/platform/components/ui'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { currencyFractionDigits, formatMoneyLabel, minorUnitsToDecimal } from '@/features/platform/lib/money'

import {
  allocateExistingPayment,
  recordPayment,
  type PaymentActionState,
  type PaymentSetup,
} from '../actions/payments'
import { useKeptForm } from '../../components/useKeptForm'

const initial: PaymentActionState = { ok: false, message: '' }

const methods: Array<[string, string]> = [
  ['check', 'Check'],
  ['ach', 'ACH'],
  ['wire', 'Wire'],
  ['cash', 'Cash'],
  ['card', 'Card'],
  ['other', 'Other'],
]

function Message({ state }: { state: PaymentActionState }) {
  if (!state.message) return null
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

// One operation key per attempt: a resubmit after an unanswered request repeats the same
// payment instead of recording it twice. A new key is issued after a confirmed result.
function useKeyedAction(action: (previous: PaymentActionState, formData: FormData) => Promise<PaymentActionState>, prefix: string) {
  const router = useRouter()
  const [key, setKey] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [state, run, pending] = useActionState(async (previous: PaymentActionState, formData: FormData) => {
    const operation = key ?? `${prefix}-${crypto.randomUUID()}`
    setKey(operation)
    formData.set('idempotencyKey', operation)
    const result = await action(previous, formData)
    if (result.ok) {
      setKey(null)
      setFormKey((value) => value + 1)
      router.refresh()
    }
    return result
  }, initial)
  const form = useKeptForm(run, state)
  return { state, run, form, pending, formKey, retrying: Boolean(key), reset: () => setKey(null) }
}

export function BillingPaymentForm({ setup }: { setup: PaymentSetup }) {
  const record = useKeyedAction(recordPayment, 'payment-ui')
  const apply = useKeyedAction(allocateExistingPayment, 'allocation-ui')
  const [invoiceId, setInvoiceId] = useState('')
  const invoice = setup.invoices.find((item) => item.id === invoiceId)
  const digits = invoice ? currencyFractionDigits(invoice.currencyCode) ?? 2 : 2
  const amountPattern = digits ? `\\d+(\\.\\d{1,${digits}})?` : '\\d+'
  const invoiceLabel = (item: PaymentSetup['invoices'][number]) =>
    `${item.invoiceNumber} · ${item.client?.displayName ?? 'Client'} · ${formatMoneyLabel(item.balanceDueMinor, item.currencyCode)} due`

  return (
    <Panel id="record-payment" title="Record payment" bodyClassName="p-0">
      <div className="grid min-w-0 lg:grid-cols-2 lg:divide-x lg:divide-border">
        <form key={record.formKey} {...record.form} className="min-w-0">
          <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground sm:col-span-2">Client payment</legend>
            <div className={cn(labelClass, 'sm:col-span-2')}>
              <label htmlFor="payment-invoice">Invoice</label>
              <FormSelect id="payment-invoice" name="invoiceId" required value={invoiceId} onValueChange={setInvoiceId} className={cn(fieldClass, 'text-foreground')}>
                <option value="" disabled>{setup.invoices.length ? 'Select issued invoice' : 'No issued invoice with a balance'}</option>
                {setup.invoices.map((item) => <option key={item.id} value={item.id}>{invoiceLabel(item)}</option>)}
              </FormSelect>
            </div>
            <div className={labelClass}>
              <label htmlFor="payment-method">Method</label>
              <FormSelect id="payment-method" name="method" required defaultValue="check" className={cn(fieldClass, 'text-foreground')}>
                {methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </FormSelect>
            </div>
            <label className={labelClass}>
              Amount{invoice ? ` (${invoice.currencyCode})` : ''}
              <input
                key={invoiceId}
                name="amount"
                inputMode="decimal"
                required
                autoComplete="off"
                pattern={amountPattern}
                defaultValue={invoice ? minorUnitsToDecimal(invoice.balanceDueMinor, invoice.currencyCode) : ''}
                className={cn(fieldClass, 'text-right font-mono tabular-nums')}
              />
            </label>
            <label className={labelClass}>Received<input name="receivedDate" type="date" required max={setup.today} defaultValue={setup.today} className={fieldClass} /></label>
            <label className={labelClass}>Reference<input name="reference" maxLength={200} autoComplete="off" className={fieldClass} /></label>
            <div className="min-w-0 sm:col-span-2">
              <SearchableOptionSelect id="payment-payer" name="payerId" label="Payer" kind="contact" options={[]} emptyLabel={invoice?.client ? `${invoice.client.displayName} (client)` : 'Invoice client'} />
            </div>
          </fieldset>
          <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
            <Track>
              <button type="submit" className={pillPrimaryClass} disabled={record.pending || !setup.invoices.length}>{record.pending ? 'Recording…' : 'Record payment'}</button>
              {record.retrying && !record.pending ? <button type="button" className={pillClass} onClick={record.reset}>New payment</button> : null}
            </Track>
            <Message state={record.state} />
          </footer>
        </form>

        <form key={apply.formKey} {...apply.form} className="min-w-0 border-t border-border lg:border-t-0">
          <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground sm:col-span-2">Apply unallocated payment</legend>
            <div className={cn(labelClass, 'sm:col-span-2')}>
              <label htmlFor="allocation-payment">Payment</label>
              <FormSelect id="allocation-payment" name="paymentId" required defaultValue="" className={cn(fieldClass, 'text-foreground')}>
                <option value="" disabled>{setup.payments.length ? 'Select payment' : 'No unallocated payment'}</option>
                {setup.payments.map((item) => <option key={item.id} value={item.id}>{item.paymentNumber} · {item.payerName ?? 'Payer'} · {formatMoneyLabel(item.remainingMinor, item.currencyCode)} unallocated</option>)}
              </FormSelect>
            </div>
            <div className={cn(labelClass, 'sm:col-span-2')}>
              <label htmlFor="allocation-invoice">Invoice</label>
              <FormSelect id="allocation-invoice" name="invoiceId" required defaultValue="" className={cn(fieldClass, 'text-foreground')}>
                <option value="" disabled>Select issued invoice</option>
                {setup.invoices.map((item) => <option key={item.id} value={item.id}>{invoiceLabel(item)}</option>)}
              </FormSelect>
            </div>
            <label className={labelClass}>Amount<input name="amount" inputMode="decimal" required autoComplete="off" pattern="\d+(\.\d{1,3})?" className={cn(fieldClass, 'text-right font-mono tabular-nums')} /></label>
          </fieldset>
          <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
            <Track><button type="submit" className={pillPrimaryClass} disabled={apply.pending || !setup.payments.length || !setup.invoices.length}>{apply.pending ? 'Applying…' : 'Apply payment'}</button></Track>
            <Message state={apply.state} />
          </footer>
        </form>
      </div>
    </Panel>
  )
}
