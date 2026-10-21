'use client'

import { useActionState, useState } from 'react'
import { FormSelect } from '@/components/ui/form-select'
import { Check, Loader2 } from 'lucide-react'

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
    open: { operation: 'holdMatter', label: 'Place on hold' },
    on_hold: { operation: 'resumeMatter', label: 'Resume matter' },
    closing: { operation: 'resumeMatter', label: 'Return to open' },
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
    approved: { operation: 'issueInvoice', label: 'Issue invoice' },
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

export function PracticeRowAction({
  id,
  kind,
  status,
  path,
  canAct,
}: {
  id: string
  kind: string
  status: string
  path: string
  canAct: boolean
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
    <details className="relative justify-self-end text-left">
      <summary className="cursor-pointer list-none whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        {action.label}
      </summary>
      <form action={formAction} className="absolute right-0 z-20 mt-2 box-border w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-md border border-border bg-background p-3 shadow-lg">
        {action.alternates?.length ? (
          <label className="block text-xs font-semibold text-foreground" htmlFor={`operation-${id}`}>
            Action
            <FormSelect id={`operation-${id}`} name="operation" value={selectedOperation} onValueChange={(value) => setChoice({ identity: actionIdentity, operation: value as PracticeActionOperation })} className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value={action.operation}>{action.operation === 'approveInvoice' ? 'Approve invoice' : action.label}</option>
              {action.alternates.map((alternate) => <option key={alternate.operation} value={alternate.operation}>{alternate.label}</option>)}
            </FormSelect>
          </label>
        ) : <input type="hidden" name="operation" value={action.operation} />}
        <input type="hidden" name="recordId" value={id} />
        <input type="hidden" name="path" value={path} />
        <label className="block text-xs font-semibold text-foreground" htmlFor={`reason-${id}`}>
          Reason
        </label>
        {selectedOperation === 'finalizeConflictReview' ? (
          <label className="block text-xs font-semibold text-foreground" htmlFor={`outcome-${id}`}>
            Human review outcome
            <FormSelect id={`outcome-${id}`} name="outcome" required className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="cleared">Cleared</option>
              <option value="conflict_found">Conflict found</option>
            </FormSelect>
          </label>
        ) : null}
        {selectedOperation === 'issueInvoice' ? (
          <label className="block text-xs font-semibold text-foreground" htmlFor={`due-${id}`}>
            Due date (end of day UTC)
            <input id={`due-${id}`} name="dueAt" type="date" required className="mt-2 min-h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        ) : null}
        <textarea
          id={`reason-${id}`}
          name="reason"
          required
          minLength={5}
          maxLength={2000}
          rows={3}
          className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Record the operational reason for this transition."
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          Confirm update
        </button>
        {state.message ? (
          <p role="status" className={state.ok ? 'text-xs text-foreground' : 'text-xs text-destructive'}>
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
  )
}
