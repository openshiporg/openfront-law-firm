import { assertCurrentCommandActor } from "./command-authority";
import type { Context } from '.keystone/types'

import { sha256Digest } from '../lib/digests'
import { assertLifecycleTransition } from '../lib/lifecycles'
import { isGraphqlInt } from '../lib/int32'
import { runSerializableTransaction } from '../lib/transactions'
import { assertMatterAccess, boundedReason, recordAuditEvent, requirePermission } from './workflow-helpers'

type ThreeWayTrustBalances = {
  bankControlBalanceMinor: number
  clientLedgerBalanceMinor: number
}

export function assertThreeWayTrustBalance(
  submittedBookBalanceMinor: number,
  balances: ThreeWayTrustBalances,
) {
  if (![submittedBookBalanceMinor, balances.bankControlBalanceMinor, balances.clientLedgerBalanceMinor].every(isGraphqlInt)) {
    throw new Error('Trust reconciliation balances exceed the supported database integer range.')
  }
  if (submittedBookBalanceMinor !== balances.bankControlBalanceMinor) {
    throw new Error('Submitted cashbook/control balance does not match the posted trust ledger as of the period end.')
  }
  if (balances.clientLedgerBalanceMinor !== balances.bankControlBalanceMinor) {
    throw new Error('Trust reconciliation requires the cashbook/control balance to equal the total individual client/matter ledger liabilities.')
  }
}

async function trustBalancesAsOf(tx: any, trustAccountId: string, periodEnd: Date): Promise<ThreeWayTrustBalances> {
  const where = { trustAccountId, occurredAt: { lte: periodEnd } }
  const [bankDebits, bankCredits, liabilityCredits, liabilityDebits] = await Promise.all([
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: 'bank_control', direction: 'debit' },
      _sum: { amountMinor: true },
    }),
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: 'bank_control', direction: 'credit' },
      _sum: { amountMinor: true },
    }),
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: 'client_liability', direction: 'credit' },
      _sum: { amountMinor: true },
    }),
    tx.trustLedgerEntry.aggregate({
      where: { ...where, accountingBucket: 'client_liability', direction: 'debit' },
      _sum: { amountMinor: true },
    }),
  ])
  const bankControlBalanceMinor = (bankDebits._sum.amountMinor ?? 0) - (bankCredits._sum.amountMinor ?? 0)
  const clientLedgerBalanceMinor = (liabilityCredits._sum.amountMinor ?? 0) - (liabilityDebits._sum.amountMinor ?? 0)
  if (!isGraphqlInt(bankControlBalanceMinor) || !isGraphqlInt(clientLedgerBalanceMinor)) {
    throw new Error('Trust reconciliation balances exceed the supported database integer range.')
  }
  return { bankControlBalanceMinor, clientLedgerBalanceMinor }
}

export async function setTrustAccountBankIdentity(
  _root: unknown,
  args: {
    trustAccountId: string
    financialInstitutionName: string
    bankAccountLastFour: string
    accountType: string
    officeId?: string | null
    externalAccountReference?: string | null
    reason: string
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, 'canManageTrust', { humanOnly: true })
  const institution = String(args.financialInstitutionName).trim()
  const lastFour = String(args.bankAccountLastFour).trim()
  const externalReference = String(args.externalAccountReference ?? '').trim()
  const accountTypes = new Set(['trust', 'pooled_trust', 'dedicated_client', 'other'])
  if (!accountTypes.has(args.accountType)) throw new Error('Unsupported trust account classification.')
  const reason = boundedReason(args.reason, 'Trust bank-identity reason', 5, 2000)
  if (!institution || institution.length > 300) throw new Error('Financial institution is required and must be 300 characters or fewer.')
  if (!/^\d{4}$/.test(lastFour)) throw new Error('Bank-account identity requires exactly the final four digits.')
  if (externalReference.length > 500) throw new Error('External account reference must be 500 characters or fewer.')
  const prisma = context.prisma as any
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${args.trustAccountId}`}))`
    const office = args.officeId
      ? await tx.office.findFirst({ where: { id: args.officeId, firmId }, select: { id: true } })
      : null
    if (args.officeId && !office) throw new Error('Trust account office was not found in the active firm.')
    const account = await tx.trustAccount.findFirst({
      where: { id: args.trustAccountId, firmId },
      select: {
        id: true,
        status: true,
        transactions: { select: { id: true }, take: 1 },
        reconciliations: { select: { id: true }, take: 1 },
      },
    })
    if (!account) throw new Error('Trust account is unavailable in the active firm.')
    if (account.status !== 'pending' || account.transactions.length || account.reconciliations.length) {
      throw new Error('Bank identity can be set only while the trust account is pending and has no posting or reconciliation evidence.')
    }
    const updated = await tx.trustAccount.update({
      where: { id: account.id },
      data: {
        financialInstitutionName: institution,
        bankAccountLastFour: lastFour,
        accountType: args.accountType,
        officeId: office?.id ?? null,
        externalAccountReference: externalReference,
      },
      select: { id: true, status: true },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'trust.bank_identity_set',
      category: 'financial',
      metadata: {
        trustAccountId: account.id,
        institutionDigest: sha256Digest(institution),
        bankAccountLastFour: lastFour,
        accountType: args.accountType,
        officeId: office?.id ?? null,
        externalReferenceDigest: externalReference ? sha256Digest(externalReference) : null,
        reasonDigest: sha256Digest(reason),
      },
    })
    return updated
  })
}

export async function transitionTrustAccount(
  _root: unknown,
  args: { trustAccountId: string; toStatus: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, 'canManageTrust', { humanOnly: true })
  const reason = boundedReason(args.reason, 'Trust account transition reason', 5, 2000)
  if (!['active', 'frozen', 'closed'].includes(args.toStatus)) throw new Error('Unsupported trust account status.')
  const prisma = context.prisma as any
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${args.trustAccountId}`}))`
    const account = await tx.trustAccount.findFirst({
      where: { id: args.trustAccountId, firmId },
      select: {
        id: true,
        status: true,
        financialInstitutionName: true,
        bankAccountLastFour: true,
        openedAt: true,
        ledgerAccounts: { where: { status: { not: 'closed' } }, select: { id: true }, take: 1 },
      },
    })
    if (!account) throw new Error('Trust account is unavailable in the active firm.')
    if (account.status === args.toStatus) throw new Error('Trust account is already in the requested status.')
    assertLifecycleTransition('trustAccount', account.status, args.toStatus)
    if (args.toStatus === 'active' && (!account.financialInstitutionName || !account.bankAccountLastFour)) {
      throw new Error('Activation requires the financial institution and bank-account last four digits.')
    }
    if (args.toStatus === 'closed' && account.ledgerAccounts.length) {
      throw new Error('Close every client trust ledger before closing the trust account.')
    }
    const now = new Date()
    const updated = await tx.trustAccount.update({
      where: { id: account.id },
      data: {
        status: args.toStatus,
        openedAt: args.toStatus === 'active' && !account.openedAt ? now : undefined,
        closedAt: args.toStatus === 'closed' ? now : null,
      },
      select: { id: true, status: true },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'trust.account_status_changed',
      category: 'financial',
      metadata: { trustAccountId: account.id, fromStatus: account.status, toStatus: updated.status, reasonDigest: sha256Digest(reason) },
    })
    return updated
  })
}

export async function transitionTrustLedgerAccount(
  _root: unknown,
  args: { ledgerAccountId: string; toStatus: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, 'canManageTrust', { humanOnly: true })
  const reason = boundedReason(args.reason, 'Trust ledger transition reason', 5, 2000)
  if (!['active', 'frozen', 'closed'].includes(args.toStatus)) throw new Error('Unsupported trust ledger status.')
  const prisma = context.prisma as any
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    const ledger = await tx.trustLedgerAccount.findFirst({
      where: { id: args.ledgerAccountId, firmId },
      select: { id: true, status: true, trustAccountId: true, matterId: true },
    })
    if (!ledger) throw new Error('Trust ledger is unavailable in the active firm.')
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${ledger.trustAccountId}`}))`
    if (ledger.matterId) await assertMatterAccess(tx, firmId, ledger.matterId, userId)
    const current = await tx.trustLedgerAccount.findUnique({ where: { id: ledger.id }, select: { status: true } })
    if (!current || current.status !== ledger.status) throw new Error('Trust ledger changed concurrently; reload before retrying.')
    if (ledger.status === args.toStatus) throw new Error('Trust ledger is already in the requested status.')
    assertLifecycleTransition('trustLedgerAccount', ledger.status, args.toStatus)
    if (args.toStatus === 'closed') {
      const [credits, debits] = await Promise.all([
        tx.trustLedgerEntry.aggregate({
          where: { ledgerAccountId: ledger.id, accountingBucket: 'client_liability', direction: 'credit' },
          _sum: { amountMinor: true },
        }),
        tx.trustLedgerEntry.aggregate({
          where: { ledgerAccountId: ledger.id, accountingBucket: 'client_liability', direction: 'debit' },
          _sum: { amountMinor: true },
        }),
      ])
      if ((credits._sum.amountMinor ?? 0) !== (debits._sum.amountMinor ?? 0)) {
        throw new Error('A client trust ledger must have a zero balance before closing.')
      }
    }
    const now = new Date()
    const updated = await tx.trustLedgerAccount.update({
      where: { id: ledger.id },
      data: {
        status: args.toStatus,
        freezeReason: args.toStatus === 'frozen' ? reason : '',
        closedAt: args.toStatus === 'closed' ? now : null,
      },
      select: { id: true, status: true },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'trust.ledger_status_changed',
      category: 'financial',
      metadata: {
        ledgerAccountId: ledger.id,
        trustAccountId: ledger.trustAccountId,
        fromStatus: ledger.status,
        toStatus: updated.status,
        reasonDigest: sha256Digest(reason),
      },
    })
    return updated
  })
}

export async function prepareTrustReconciliation(
  _root: unknown,
  args: {
    trustAccountId: string
    periodStart: string
    periodEnd: string
    statementBalanceMinor: number
    bookBalanceMinor: number
    currencyCode: string
    notes?: string | null
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, 'canManageTrust', { humanOnly: true })
  const periodStart = new Date(args.periodStart)
  const periodEnd = new Date(args.periodEnd)
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart) {
    throw new Error('Reconciliation requires a valid period with an end after its start.')
  }
  if (!isGraphqlInt(args.statementBalanceMinor) || !isGraphqlInt(args.bookBalanceMinor)) {
    throw new Error('Reconciliation balances must be supported database integer minor-unit amounts.')
  }
  const currencyCode = String(args.currencyCode).trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Reconciliation currency must be a three-letter code.')
  const notes = String(args.notes ?? '').trim()
  if (notes.length > 4000) throw new Error('Reconciliation notes must be 4000 characters or fewer.')
  const differenceMinor = args.statementBalanceMinor - args.bookBalanceMinor
  if (!isGraphqlInt(differenceMinor)) throw new Error('Reconciliation difference exceeds the supported database integer range.')
  const prisma = context.prisma as any
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${args.trustAccountId}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-reconciliation:${firmId}:${args.trustAccountId}`}))`
    const account = await tx.trustAccount.findFirst({
      where: { id: args.trustAccountId, firmId, status: 'active' },
      select: { id: true, currencyCode: true },
    })
    if (!account) throw new Error('Only an active trust account can be reconciled.')
    if (account.currencyCode !== currencyCode) throw new Error('Reconciliation currency must match the trust account.')
    const balances = await trustBalancesAsOf(tx, account.id, periodEnd)
    assertThreeWayTrustBalance(args.bookBalanceMinor, balances)
    const reconciliation = await tx.trustReconciliation.create({
      data: {
        firmId,
        trustAccountId: account.id,
        status: 'draft',
        periodStart,
        periodEnd,
        statementBalanceMinor: args.statementBalanceMinor,
        bookBalanceMinor: args.bookBalanceMinor,
        differenceMinor,
        currencyCode,
        createdById: userId,
        notes,
      },
      select: { id: true, status: true },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'trust.reconciliation_created',
      category: 'financial',
      metadata: {
        reconciliationId: reconciliation.id,
        trustAccountId: account.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        statementBalanceMinor: args.statementBalanceMinor,
        bookBalanceMinor: args.bookBalanceMinor,
        clientLedgerBalanceMinor: balances.clientLedgerBalanceMinor,
        differenceMinor,
      },
    })
    return reconciliation
  })
}

export async function transitionTrustReconciliation(
  _root: unknown,
  args: { reconciliationId: string; toStatus: string; reason: string },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, 'canManageTrust', { humanOnly: true })
  const reason = boundedReason(args.reason, 'Reconciliation transition reason', 5, 2000)
  if (!['draft', 'in_review', 'completed', 'reopened'].includes(args.toStatus)) {
    throw new Error('Unsupported reconciliation status.')
  }
  const prisma = context.prisma as any
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    const reference = await tx.trustReconciliation.findFirst({
      where: { id: args.reconciliationId, firmId },
      select: { id: true, trustAccountId: true },
    })
    if (!reference) throw new Error('Trust reconciliation is unavailable in the active firm.')
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${reference.trustAccountId}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-reconciliation:${firmId}:${reference.trustAccountId}`}))`
    const reconciliation = await tx.trustReconciliation.findFirst({
      where: { id: reference.id, firmId },
      select: {
        id: true,
        status: true,
        trustAccountId: true,
        differenceMinor: true,
        bookBalanceMinor: true,
        periodStart: true,
        periodEnd: true,
        createdById: true,
        trustAccount: { select: { status: true } },
      },
    })
    if (!reconciliation) throw new Error('Trust reconciliation changed concurrently; reload before retrying.')
    if (reconciliation.status === args.toStatus) throw new Error('Reconciliation is already in the requested status.')
    assertLifecycleTransition('trustReconciliation', reconciliation.status, args.toStatus)
    if (args.toStatus === 'in_review' && reconciliation.trustAccount.status !== 'active') {
      throw new Error('Only an active trust account can enter reconciliation review.')
    }
    if (args.toStatus === 'completed') {
      if (reconciliation.differenceMinor !== 0) throw new Error('A reconciliation with a non-zero difference cannot be completed.')
      const balances = await trustBalancesAsOf(tx, reconciliation.trustAccountId, reconciliation.periodEnd)
      assertThreeWayTrustBalance(reconciliation.bookBalanceMinor, balances)
      if (!reconciliation.createdById || reconciliation.createdById === userId) {
        throw new Error('A reconciliation with identified preparation evidence requires an independent reviewer.')
      }
      if (reconciliation.periodEnd <= reconciliation.periodStart) throw new Error('Reconciliation period dates are invalid.')
    }
    const now = new Date()
    const updated = await tx.trustReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: args.toStatus,
        reviewedById: args.toStatus === 'completed' ? userId : undefined,
        reviewedAt: args.toStatus === 'completed' ? now : undefined,
        completedAt: args.toStatus === 'completed' ? now : args.toStatus === 'reopened' ? null : undefined,
      },
      select: { id: true, status: true },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'trust.reconciliation_status_changed',
      category: 'financial',
      metadata: {
        reconciliationId: reconciliation.id,
        trustAccountId: reconciliation.trustAccountId,
        fromStatus: reconciliation.status,
        toStatus: updated.status,
        differenceMinor: reconciliation.differenceMinor,
        clientLedgerBalanceMinor: args.toStatus === 'completed'
          ? reconciliation.bookBalanceMinor
          : null,
        reasonDigest: sha256Digest(reason),
      },
    })
    return updated
  })
}

/** Corrects a draft or reopened reconciliation's statement and book figures. The
 * figures are immutable through generated CRUD; this command recalculates the
 * three-way balances, requires the caller's last-seen version, records the previous
 * figures as audit evidence and makes the reviser the preparer, so completion still
 * needs a different, independent reviewer. Completed periods must be reopened first. */
export async function reviseTrustReconciliation(
  _root: unknown,
  args: {
    reconciliationId: string
    expectedUpdatedAt: string
    statementBalanceMinor: number
    bookBalanceMinor: number
    notes?: string | null
    reason: string
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, 'canManageTrust', { humanOnly: true })
  const reason = boundedReason(args.reason, 'Reconciliation revision reason', 5, 2000)
  const expectedUpdatedAt = new Date(args.expectedUpdatedAt)
  if (Number.isNaN(expectedUpdatedAt.getTime())) throw new Error('The reconciliation version you reviewed is required.')
  if (!isGraphqlInt(args.statementBalanceMinor) || !isGraphqlInt(args.bookBalanceMinor)) {
    throw new Error('Reconciliation balances must be supported database integer minor-unit amounts.')
  }
  const differenceMinor = args.statementBalanceMinor - args.bookBalanceMinor
  if (!isGraphqlInt(differenceMinor)) throw new Error('Reconciliation difference exceeds the supported database integer range.')
  const notes = args.notes == null ? null : String(args.notes).trim()
  if (notes && notes.length > 4000) throw new Error('Reconciliation notes must be 4000 characters or fewer.')
  const prisma = context.prisma as any
  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, 'canManageTrust')
    const reference = await tx.trustReconciliation.findFirst({
      where: { id: args.reconciliationId, firmId },
      select: { id: true, trustAccountId: true },
    })
    if (!reference) throw new Error('Trust reconciliation is unavailable in the active firm.')
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${reference.trustAccountId}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-reconciliation:${firmId}:${reference.trustAccountId}`}))`
    const reconciliation = await tx.trustReconciliation.findFirst({
      where: { id: reference.id, firmId },
      select: {
        id: true,
        status: true,
        trustAccountId: true,
        periodEnd: true,
        statementBalanceMinor: true,
        bookBalanceMinor: true,
        differenceMinor: true,
        createdById: true,
        updatedAt: true,
        trustAccount: { select: { status: true } },
      },
    })
    if (!reconciliation) throw new Error('Trust reconciliation changed concurrently; reload before retrying.')
    if (!['draft', 'reopened'].includes(reconciliation.status)) {
      throw new Error('Only a draft or reopened reconciliation can be revised; reopen a completed period through review first.')
    }
    if (reconciliation.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new Error('This reconciliation changed after you reviewed it; reload before revising.')
    }
    if (reconciliation.trustAccount.status !== 'active') throw new Error('Only an active trust account can be reconciled.')
    const balances = await trustBalancesAsOf(tx, reconciliation.trustAccountId, reconciliation.periodEnd)
    assertThreeWayTrustBalance(args.bookBalanceMinor, balances)
    const updated = await tx.trustReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        statementBalanceMinor: args.statementBalanceMinor,
        bookBalanceMinor: args.bookBalanceMinor,
        differenceMinor,
        ...(notes == null ? {} : { notes }),
        createdById: userId,
        reviewedById: null,
        reviewedAt: null,
        completedAt: null,
      },
      select: { id: true, status: true },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'trust.reconciliation_revised',
      category: 'financial',
      metadata: {
        reconciliationId: reconciliation.id,
        trustAccountId: reconciliation.trustAccountId,
        status: reconciliation.status,
        previousPreparerId: reconciliation.createdById,
        previous: {
          statementBalanceMinor: reconciliation.statementBalanceMinor,
          bookBalanceMinor: reconciliation.bookBalanceMinor,
          differenceMinor: reconciliation.differenceMinor,
        },
        next: {
          statementBalanceMinor: args.statementBalanceMinor,
          bookBalanceMinor: args.bookBalanceMinor,
          differenceMinor,
        },
        clientLedgerBalanceMinor: balances.clientLedgerBalanceMinor,
        reasonDigest: sha256Digest(reason),
      },
    })
    return updated
  })
}
