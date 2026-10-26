'use client'

import { useActionState, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { EmptyState, Notice, Panel, RowList, TitleLine, Track, fieldClass, labelClass, pillClass, pillDangerClass, pillPrimaryClass, statusLabel, textareaClass } from '@/features/platform/components/ui'
import { formatInstant } from '@/features/platform/lib/datetime'
import { currencyFractionDigits, formatMoneyLabel, minorUnitsToDecimal } from '@/features/platform/lib/money'

import { requestPaymentRefund, reviewPaymentRefund, type RefundActionState, type RefundRow, type RefundSetup } from '../actions/refunds'
import { useKeptForm } from '../../components/useKeptForm'

const initial: RefundActionState = { ok: false, message: '' }

const reasons: Array<[string, string]> = [
  ['overpayment', 'Overpayment'],
  ['duplicate', 'Duplicate'],
  ['matter_closed', 'Matter closed'],
  ['client_request', 'Client request'],
  ['other', 'Other'],
]

function Message({ state }: { state: RefundActionState }) {
  if (!state.message) return null
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 break-words text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

function RequestRefundForm({ payments, onDone }: { payments: RefundSetup['payments']; onDone: () => void }) {
  const router = useRouter()
  // One key per attempt: a resubmit after an unanswered request replays instead of duplicating.
  const [key, setKey] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [paymentId, setPaymentId] = useState('')
  const [reason, setReason] = useState('overpayment')
  const payment = payments.find((item) => item.id === paymentId)
  const digits = payment ? currencyFractionDigits(payment.currencyCode) ?? 2 : 2
  const amountPattern = digits ? `\\d+(\\.\\d{1,${digits}})?` : '\\d+'
  const [state, run, pending] = useActionState(async (previous: RefundActionState, formData: FormData) => {
    const operation = key ?? `refund-ui-${crypto.randomUUID()}`
    setKey(operation)
    formData.set('idempotencyKey', operation)
    const result = await requestPaymentRefund(previous, formData)
    if (result.ok) {
      setKey(null)
      setFormKey((value) => value + 1)
      setPaymentId('')
      router.refresh()
      onDone()
    }
    return result
  }, initial)
  const runForm = useKeptForm(run, state)

  return (
    <form key={formKey} {...runForm} className="min-w-0 rounded-[6px] border border-border">
      <fieldset className="grid min-w-0 gap-4 p-4 sm:grid-cols-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">Request refund</legend>
        <div className={cn(labelClass, 'sm:col-span-2')}>
          <label htmlFor="refund-payment">Payment</label>
          <FormSelect id="refund-payment" name="paymentId" required value={paymentId} onValueChange={(value) => { setPaymentId(value); setKey(null) }} className={cn(fieldClass, 'text-foreground')}>
            <option value="" disabled>{payments.length ? 'Select captured or settled payment' : 'No payment with a refundable amount'}</option>
            {payments.map((item) => (
              <option key={item.id} value={item.id}>{`${item.paymentNumber} · ${item.payerName ?? 'Payer'} · ${formatMoneyLabel(item.refundableMinor, item.currencyCode)} refundable`}</option>
            ))}
          </FormSelect>
        </div>
        <label className={labelClass}>
          Amount{payment ? ` (${payment.currencyCode}, up to ${formatMoneyLabel(payment.refundableMinor, payment.currencyCode)})` : ''}
          <input
            key={paymentId}
            name="amount"
            inputMode="decimal"
            required
            autoComplete="off"
            pattern={amountPattern}
            defaultValue={payment ? minorUnitsToDecimal(payment.refundableMinor, payment.currencyCode) : ''}
            className={cn(fieldClass, 'text-right font-mono tabular-nums')}
          />
        </label>
        <div className={labelClass}>
          <label htmlFor="refund-reason">Reason</label>
          <FormSelect id="refund-reason" name="reason" required value={reason} onValueChange={setReason} className={cn(fieldClass, 'text-foreground')}>
            {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </FormSelect>
        </div>
        <label className={cn(labelClass, 'sm:col-span-2')}>
          Explanation
          <textarea name="explanation" required minLength={10} maxLength={4000} rows={3} className={textareaClass} />
        </label>
      </fieldset>
      <footer className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-4 py-3">
        <Track>
          <button type="submit" className={pillPrimaryClass} disabled={pending || !payments.length}>{pending ? 'Requesting…' : 'Request refund'}</button>
          {key && !pending ? <button type="button" className={pillClass} onClick={() => setKey(null)}>New request</button> : null}
        </Track>
        <Message state={state} />
      </footer>
    </form>
  )
}

function ReviewControls({ refund, viewerId }: { refund: RefundRow; viewerId: string | null }) {
  const router = useRouter()
  const [decision, setDecision] = useState<'approve' | 'cancel' | null>(null)
  const ownRequest = Boolean(viewerId && refund.requestedById === viewerId)
  const [state, run, pending] = useActionState(async (previous: RefundActionState, formData: FormData) => {
    const result = await reviewPaymentRefund(previous, formData)
    if (result.ok) { setDecision(null); router.refresh() }
    return result
  }, initial)
  const runForm = useKeptForm(run, state)

  return (
    <div className="grid min-w-0 gap-3">
      <Track label={`Review ${refund.refundNumber}`}>
        <button type="button" className={decision === 'approve' ? pillPrimaryClass : pillClass} disabled={ownRequest} title={ownRequest ? 'A different person must approve your request' : undefined} onClick={() => setDecision(decision === 'approve' ? null : 'approve')}>Approve</button>
        <button type="button" className={pillDangerClass} onClick={() => setDecision(decision === 'cancel' ? null : 'cancel')}>Reject</button>
      </Track>
      {ownRequest ? <p className="text-xs text-muted-foreground">You requested this refund; another reviewer must approve it.</p> : null}
      {decision ? (
        <form {...runForm} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="refundId" value={refund.id} />
          <input type="hidden" name="decision" value={decision} />
          <label className={cn(labelClass, 'flex-1')}>
            {decision === 'approve' ? 'Approval reason' : 'Rejection reason'}
            <input name="reason" required minLength={5} maxLength={2000} autoComplete="off" className={fieldClass} />
          </label>
          <Track>
            <button type="submit" className={decision === 'approve' ? pillPrimaryClass : pillDangerClass} disabled={pending}>{pending ? 'Saving…' : decision === 'approve' ? 'Confirm approval' : 'Confirm rejection'}</button>
          </Track>
        </form>
      ) : null}
      <Message state={state} />
    </div>
  )
}

export function BillingRefundsClient({ setup, actions }: { setup: RefundSetup; actions?: ReactNode }) {
  const [requesting, setRequesting] = useState(false)
  return (
    <Panel
      id="refunds"
      title="Refunds"
      actions={
        <>
          <Track>
            <button type="button" className={requesting ? pillClass : pillPrimaryClass} onClick={() => setRequesting((value) => !value)} aria-expanded={requesting}>
              {requesting ? 'Close' : 'Request refund'}
            </button>
          </Track>
          {actions}
        </>
      }
    >
      <div className="grid min-w-0 gap-4">
        {requesting ? <RequestRefundForm payments={setup.payments} onDone={() => setRequesting(false)} /> : null}
        {setup.refunds.length === 0 ? <EmptyState title="No refunds requested" /> : (
          <RowList label="Refunds">
            {setup.refunds.map((refund) => (
              <li key={refund.id} className="grid min-w-0 gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <TitleLine as="h3" status={refund.status} headingClassName="text-sm">{refund.refundNumber}</TitleLine>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">{formatMoneyLabel(refund.amountMinor, refund.currencyCode)}</span>
                </div>
                <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {statusLabel(refund.reason)} · {refund.paymentNumber ?? 'Payment'}{refund.invoiceNumber ? ` · ${refund.invoiceNumber}` : ''} · requested {formatInstant(refund.requestedAt, setup.timeZone, { includeTime: false })}{refund.requestedByName ? ` by ${refund.requestedByName}` : ''}
                  {refund.approvedByName ? ` · approved by ${refund.approvedByName}` : ''}
                </p>
                {refund.explanation ? <p className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">{refund.explanation}</p> : null}
                {refund.status === 'cancelled' && refund.failureReason ? <p className="text-xs text-muted-foreground">Rejected: {refund.failureReason}</p> : null}
                {refund.status === 'failed' && refund.failureReason ? <p className="text-xs text-destructive">Failed: {refund.failureReason}</p> : null}
                {refund.status === 'requested' ? <ReviewControls refund={refund} viewerId={setup.viewerId} /> : null}
              </li>
            ))}
          </RowList>
        )}
        {setup.refunds.some((refund) => refund.status === 'approved') ? (
          <Notice>Approved refunds wait for provider processing. Recording a processed, succeeded or failed outcome is disabled until authenticated provider ingress is configured.</Notice>
        ) : null}
      </div>
    </Panel>
  )
}
