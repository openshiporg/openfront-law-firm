'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fieldClass, labelClass, pillPrimaryClass, textareaClass, trackClass, trackItemClass } from './ui'

import {
  runPracticeAction,
  type PracticeActionOperation,
  type PracticeActionState,
} from '@/features/platform/operations/actions/runPracticeAction'

type Action = {
  operation: PracticeActionOperation
  label: string
  alternates?: Array<{ operation: PracticeActionOperation; label: string }>
}

const transitions: Record<string, Record<string, Action>> = {
  Intake: {
    new: { operation: 'beginIntakeScreening', label: 'Begin screening' },
    screening: { operation: 'sendIntakeToConflicts', label: 'Send to conflicts' },
    conflict_review: { operation: 'moveIntakeToConsultation', label: 'Move to consultation' },
    consultation: { operation: 'moveIntakeToDecision', label: 'Record decision stage' },
  },
  'Conflict check': {
    requested: { operation: 'beginConflictSearch', label: 'Begin manual search' },
    running: { operation: 'submitConflictReview', label: 'Send to human review' },
    review_required: { operation: 'finalizeConflictReview', label: 'Finalize review' },
  },
  Matter: {
    open: { operation: 'holdMatter', label: 'Place on hold', alternates: [{ operation: 'beginClosingMatter', label: 'Begin closing' }] },
    on_hold: { operation: 'resumeMatter', label: 'Resume matter', alternates: [{ operation: 'beginClosingMatter', label: 'Begin closing' }] },
    closing: { operation: 'closeMatter', label: 'Close matter', alternates: [{ operation: 'resumeMatter', label: 'Return to open' }] },
  },
  Consultation: {
    requested: { operation: 'confirmConsultation', label: 'Confirm request', alternates: [{ operation: 'cancelConsultation', label: 'Cancel request' }] },
    scheduled: { operation: 'completeConsultation', label: 'Record outcome', alternates: [{ operation: 'markConsultationNoShow', label: 'Mark no-show' }, { operation: 'cancelConsultation', label: 'Cancel consultation' }] },
  },
  Deadline: {
    draft: { operation: 'markDeadlinePending', label: 'Mark pending' },
    pending: { operation: 'completeDeadline', label: 'Complete deadline' },
    missed: { operation: 'completeDeadline', label: 'Complete late' },
  },
  Task: {
    open: { operation: 'startTask', label: 'Start work' },
    in_progress: { operation: 'completeTask', label: 'Complete task' },
    blocked: { operation: 'startTask', label: 'Resume task' },
  },
  Message: {
    draft: { operation: 'queueMessage', label: 'Queue message' },
  },
  Document: {
    draft: { operation: 'publishDocument', label: 'Publish version' },
    active: { operation: 'archiveDocument', label: 'Archive document' },
    archived: { operation: 'publishDocument', label: 'Restore document' },
  },
  'Time entry': {
    draft: { operation: 'submitTimeEntry', label: 'Submit time' },
    submitted: { operation: 'approveTimeEntry', label: 'Approve time' },
  },
  Expense: {
    draft: { operation: 'submitExpense', label: 'Submit expense' },
    submitted: { operation: 'approveExpense', label: 'Approve expense' },
  },
  Invoice: {
    draft: {
      operation: 'approveInvoice',
      label: 'Manage draft invoice',
      alternates: [{ operation: 'discardDraftInvoice', label: 'Discard draft & release sources' }],
    },
    approved: { operation: 'issueInvoice', label: 'Issue invoice', alternates: [{ operation: 'voidInvoice', label: 'Void invoice' }] },
    issued: { operation: 'markInvoiceOverdue', label: 'Invoice actions', alternates: [{ operation: 'voidInvoice', label: 'Void invoice' }] },
    partially_paid: { operation: 'markInvoiceOverdue', label: 'Invoice actions', alternates: [{ operation: 'voidInvoice', label: 'Void invoice' }] },
    overdue: { operation: 'voidInvoice', label: 'Void invoice' },
  },
  'Legal hold': {
    active: { operation: 'releaseHold', label: 'Release hold' },
  },
  Connection: {
    pending: { operation: 'activateIntegration', label: 'Activate connection' },
    needs_reauth: { operation: 'activateIntegration', label: 'Mark reauthorized' },
    active: { operation: 'disableIntegration', label: 'Disable connection' },
  },
  'Trust account': {
    pending: { operation: 'activateTrustAccount', label: 'Activate account' },
    active: { operation: 'freezeTrustAccount', label: 'Freeze account' },
    frozen: { operation: 'activateTrustAccount', label: 'Reactivate account' },
  },
  'Client ledger': {
    active: { operation: 'freezeTrustLedger', label: 'Freeze ledger' },
    frozen: { operation: 'activateTrustLedger', label: 'Reactivate ledger' },
  },
  Reconciliation: {
    draft: { operation: 'reviewTrustReconciliation', label: 'Send to review' },
    reopened: { operation: 'reviewTrustReconciliation', label: 'Return to review' },
    in_review: { operation: 'completeTrustReconciliation', label: 'Complete review' },
  },
}

const initialState: PracticeActionState = { ok: false, message: '' }

// Wording for the primary choice when it sits in a select next to alternates.
const primaryLabels: Partial<Record<PracticeActionOperation, string>> = {
  approveInvoice: 'Approve invoice',
  markInvoiceOverdue: 'Mark overdue',
  completeConsultation: 'Mark completed',
  confirmConsultation: 'Confirm at requested time',
  holdMatter: 'Place on hold',
}

export function PracticeRowAction({
  id,
  kind,
  status,
  path,
  canAct,
  timeZone,
}: {
  id: string
  kind: string
  status: string
  path: string
  canAct: boolean
  timeZone?: string
}) {
  const action = canAct ? transitions[kind]?.[status] : undefined
  const [state, formAction, pending] = useActionState(runPracticeAction, initialState)
  // An alternate choice is remembered only for the record state it was made against.
  // After revalidation changes kind/status the primary operation applies again, so
  // operation-dependent fields (outcome, due date) always match what is submitted.
  const actionIdentity = action ? `${kind}:${status}:${action.operation}` : ''
  const [choice, setChoice] = useState<{ identity: string; operation: PracticeActionOperation } | null>(null)
  if (!action) return null
  const allowedOperations = [action.operation, ...(action.alternates ?? []).map((alternate) => alternate.operation)]
  const selectedOperation = choice && choice.identity === actionIdentity && allowedOperations.includes(choice.operation)
    ? choice.operation
    : action.operation

  return (
    <details className="group/action relative justify-self-end text-left">
      <summary className={cn(trackClass, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
        <span className={cn(trackItemClass(true), 'h-7 px-3 text-xs')}>{action.label}</span>
      </summary>
      <form action={formAction} className="absolute right-0 z-20 mt-2 box-border grid w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
        {action.alternates?.length ? (
          <label className={labelClass} htmlFor={`operation-${id}`}>
            Action
            <FormSelect id={`operation-${id}`} name="operation" value={selectedOperation} onValueChange={(value) => setChoice({ identity: actionIdentity, operation: value as PracticeActionOperation })} className={fieldClass}>
              <option value={action.operation}>{primaryLabels[action.operation] ?? action.label}</option>
              {action.alternates.map((alternate) => <option key={alternate.operation} value={alternate.operation}>{alternate.label}</option>)}
            </FormSelect>
          </label>
        ) : <input type="hidden" name="operation" value={action.operation} />}
        <input type="hidden" name="recordId" value={id} />
        <input type="hidden" name="path" value={path} />
        {selectedOperation === 'finalizeConflictReview' ? (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Review outcome</legend>
            <div className={trackClass}>
              {([["cleared", "Cleared"], ["conflict_found", "Conflict found"]] as const).map(([value, label]) => (
                <label key={value} className="relative">
                  <input type="radio" name="outcome" value={value} required className="peer sr-only" />
                  <span className={cn(trackItemClass(false), 'cursor-pointer peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-black/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 dark:peer-checked:bg-zinc-800')}>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {selectedOperation === 'completeConsultation' ? (
          <label className={labelClass} htmlFor={`consult-outcome-${id}`}>
            Outcome
            <FormSelect id={`consult-outcome-${id}`} name="outcome" defaultValue="pending" className={fieldClass}>
              <option value="pending">Outcome pending</option>
              <option value="recommend_engagement">Recommend engagement</option>
              <option value="follow_up">Follow up</option>
              <option value="decline">Decline</option>
            </FormSelect>
          </label>
        ) : null}
        {selectedOperation === 'issueInvoice' ? (
          <label className={labelClass} htmlFor={`due-${id}`}>
            Due date (end of day, {timeZone ?? 'firm time'})
            <input id={`due-${id}`} name="dueAt" type="date" required className={fieldClass} />
          </label>
        ) : null}
        <label className={labelClass} htmlFor={`reason-${id}`}>
          Reason
          <textarea
            id={`reason-${id}`}
            name="reason"
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            className={textareaClass}
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          {state.message ? (
            <p role="status" className={cn('min-w-0 text-xs [overflow-wrap:anywhere]', state.ok ? 'text-foreground' : 'text-destructive')}>
              {state.message}
            </p>
          ) : <span />}
          <div className={trackClass}>
            <button type="submit" disabled={pending} className={pillPrimaryClass}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
              Confirm
            </button>
          </div>
        </div>
      </form>
    </details>
  )
}
