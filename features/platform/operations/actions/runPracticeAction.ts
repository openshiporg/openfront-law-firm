'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { zonedWallTimeToInstant } from '@/features/platform/lib/datetime'
import { getFirmTimeZone } from '@/features/platform/lib/firmTimeZone'

export type PracticeActionState = { ok: boolean; message: string }

const mutations = {
  intake: `mutation($id: ID!, $to: String!, $reason: String) { transitionIntake(intakeId: $id, toStatus: $to, reason: $reason) { intake { id status } replayed } }`,
  conflictTransition: `mutation($id: ID!, $to: ConflictCheckCommandTarget!, $reason: String) { transitionConflictCheck(checkId: $id, toStatus: $to, summary: $reason) { check { id status } replayed } }`,
  conflictFinalize: `mutation($id: ID!, $outcome: String!, $reason: String!) { finalizeConflictCheck(checkId: $id, outcome: $outcome, summary: $reason) { check { id status } replayed } }`,
  matter: `mutation($id: ID!, $to: String!, $reason: String) { transitionMatter(matterId: $id, toStatus: $to, reason: $reason) { matter { id status } replayed } }`,
  deadline: `mutation($id: ID!, $to: String!, $reason: String) { transitionDeadline(deadlineId: $id, toStatus: $to, reason: $reason) { item { id status } replayed } }`,
  task: `mutation($id: ID!, $to: String!, $reason: String) { transitionLegalTask(taskId: $id, toStatus: $to, reason: $reason) { item { id status } replayed } }`,
  timeEntry: `mutation($id: ID!, $to: String!, $reason: String) { transitionTimeEntry(timeEntryId: $id, toStatus: $to, reason: $reason) { item { id status } replayed } }`,
  expense: `mutation($id: ID!, $to: String!, $reason: String) { transitionExpense(expenseId: $id, toStatus: $to, reason: $reason) { item { id status } replayed } }`,
  invoice: `mutation($id: ID!, $to: InvoiceCommandTarget!, $reason: String, $dueAt: DateTime) { transitionInvoice(invoiceId: $id, toStatus: $to, reason: $reason, dueAt: $dueAt) { invoice { id status } replayed } }`,
  document: `mutation($id: ID!, $to: DocumentCommandTarget!, $reason: String!) { transitionDocument(documentId: $id, toStatus: $to, reason: $reason) { document { id status } replayed } }`,
  communication: `mutation($id: ID!, $reason: String!) { queueCommunicationMessage(messageId: $id, reason: $reason) { message { id status } replayed } }`,
  retention: `mutation($id: ID!, $reason: String!) { releaseRetentionHold(holdId: $id, reason: $reason) { hold { id status } replayed } }`,
  integration: `mutation($id: ID!, $to: String!, $reason: String!) { transitionIntegrationConnection(connectionId: $id, toStatus: $to, reason: $reason) { connection { id status } replayed } }`,
  trustAccount: `mutation($id: ID!, $to: String!, $reason: String!) { transitionTrustAccount(trustAccountId: $id, toStatus: $to, reason: $reason) { id status } }`,
  trustLedger: `mutation($id: ID!, $to: String!, $reason: String!) { transitionTrustLedgerAccount(ledgerAccountId: $id, toStatus: $to, reason: $reason) { id status } }`,
  trustReconciliation: `mutation($id: ID!, $to: String!, $reason: String!) { transitionTrustReconciliation(reconciliationId: $id, toStatus: $to, reason: $reason) { id status } }`,
} as const

// Enum-typed command targets mirror schema.graphql so a row action can never send a
// target the controlled mutation would reject at validation time.
type EnumTargets = {
  conflictTransition: 'running' | 'review_required' | 'failed' | 'cancelled'
  invoice: 'approved' | 'issued' | 'overdue' | 'void'
  document: 'active' | 'archived'
}
type Command =
  | { [M in keyof EnumTargets]: { mutation: M; toStatus: EnumTargets[M] } }[keyof EnumTargets]
  | { mutation: Exclude<keyof typeof mutations, keyof EnumTargets>; toStatus: string | null }

const commands = {
  beginIntakeScreening: { mutation: 'intake', toStatus: 'screening' },
  sendIntakeToConflicts: { mutation: 'intake', toStatus: 'conflict_review' },
  moveIntakeToConsultation: { mutation: 'intake', toStatus: 'consultation' },
  moveIntakeToDecision: { mutation: 'intake', toStatus: 'decision' },
  beginConflictSearch: { mutation: 'conflictTransition', toStatus: 'running' },
  submitConflictReview: { mutation: 'conflictTransition', toStatus: 'review_required' },
  finalizeConflictReview: { mutation: 'conflictFinalize', toStatus: null },
  holdMatter: { mutation: 'matter', toStatus: 'on_hold' },
  resumeMatter: { mutation: 'matter', toStatus: 'open' },
  markDeadlinePending: { mutation: 'deadline', toStatus: 'pending' },
  completeDeadline: { mutation: 'deadline', toStatus: 'completed' },
  startTask: { mutation: 'task', toStatus: 'in_progress' },
  completeTask: { mutation: 'task', toStatus: 'completed' },
  submitTimeEntry: { mutation: 'timeEntry', toStatus: 'submitted' },
  approveTimeEntry: { mutation: 'timeEntry', toStatus: 'approved' },
  submitExpense: { mutation: 'expense', toStatus: 'submitted' },
  approveExpense: { mutation: 'expense', toStatus: 'approved' },
  approveInvoice: { mutation: 'invoice', toStatus: 'approved' },
  discardDraftInvoice: { mutation: 'invoice', toStatus: 'void' },
  issueInvoice: { mutation: 'invoice', toStatus: 'issued' },
  publishDocument: { mutation: 'document', toStatus: 'active' },
  archiveDocument: { mutation: 'document', toStatus: 'archived' },
  queueMessage: { mutation: 'communication', toStatus: null },
  releaseHold: { mutation: 'retention', toStatus: null },
  activateIntegration: { mutation: 'integration', toStatus: 'active' },
  disableIntegration: { mutation: 'integration', toStatus: 'disabled' },
  activateTrustAccount: { mutation: 'trustAccount', toStatus: 'active' },
  freezeTrustAccount: { mutation: 'trustAccount', toStatus: 'frozen' },
  activateTrustLedger: { mutation: 'trustLedger', toStatus: 'active' },
  freezeTrustLedger: { mutation: 'trustLedger', toStatus: 'frozen' },
  reviewTrustReconciliation: { mutation: 'trustReconciliation', toStatus: 'in_review' },
  completeTrustReconciliation: { mutation: 'trustReconciliation', toStatus: 'completed' },
} as const satisfies Record<string, Command>

export type PracticeActionOperation = keyof typeof commands

function field(formData: FormData, key: string, maximum: number) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value || value.length > maximum) throw new Error(`${key} is required and must be ${maximum} characters or fewer.`)
  return value
}

export async function runPracticeAction(
  _previousState: PracticeActionState,
  formData: FormData,
): Promise<PracticeActionState> {
  try {
    const operation = field(formData, 'operation', 80) as PracticeActionOperation
    if (!Object.hasOwn(commands, operation)) throw new Error('Unsupported practice action.')
    const command = commands[operation]
    const mutation = mutations[command.mutation]
    const id = field(formData, 'recordId', 200)
    const reason = String(formData.get('reason') ?? '').trim()
    if (reason.length < 5 || reason.length > 2000) throw new Error('Reason must be 5–2,000 characters.')
    const outcome = String(formData.get('outcome') ?? '').trim() || null
    if (operation === 'finalizeConflictReview' && !['cleared', 'conflict_found'].includes(outcome ?? '')) {
      throw new Error('Select a conflict-review outcome.')
    }
    const dueAt = String(formData.get('dueAt') ?? '').trim() || null
    if (operation === 'issueInvoice' && !dueAt) throw new Error('A due date is required to issue an invoice.')
    const path = field(formData, 'path', 300)
    if (!path.startsWith('/dashboard/platform/')) throw new Error('Invalid workspace path.')
    // The due date is the end of that calendar day in the firm's time zone.
    const dueInstant = dueAt ? zonedWallTimeToInstant(`${dueAt}T23:59`, await getFirmTimeZone()) : null
    if (dueAt && !dueInstant) throw new Error('Enter a valid due date.')

    const response = await keystoneClient<Record<string, unknown>>(mutation, {
      id,
      ...(command.toStatus ? { to: command.toStatus } : {}),
      reason,
      ...(outcome ? { outcome } : {}),
      ...(dueInstant ? { dueAt: new Date(dueInstant.getTime() + 59_999).toISOString() } : {}),
    })
    if (!response.success) return { ok: false, message: response.error }

    revalidatePath(path)
    revalidatePath('/dashboard')
    return { ok: true, message: 'Updated through the controlled workflow.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The workflow could not be updated.' }
  }
}
