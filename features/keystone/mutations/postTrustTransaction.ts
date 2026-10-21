import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { assertCurrentCommandActor } from "./command-authority";

import { activeFirmId, permissions } from "../access";
import { canonicalJson, sha256Digest } from "../lib/digests";
import { runSerializableTransaction } from "../lib/transactions";
import { assertMatterAccess, workflowActor } from "./workflow-helpers";
import {
  assertTrustLedgerHistoricalMinimumBalances,
  assertTrustPostingPeriodOpen,
  validateTrustPosting,
  type TrustAccountingBucket,
  type TrustEntryDirection,
  type TrustPostingInput,
} from "../lib/trust-ledger";

export type PostTrustTransactionArgs = {
  data: {
    idempotencyKey: string;
    trustAccountId: string;
    transactionType: string;
    currencyCode: string;
    occurredAt: string;
    description: string;
    reversesTransactionId?: string | null;
    sourcePaymentId?: string | null;
    sourceRefundId?: string | null;
    entries: Array<{
      ledgerAccountId?: string | null;
      accountingBucket: TrustAccountingBucket;
      direction: TrustEntryDirection;
      amountMinor: number;
      currencyCode?: string | null;
      memo?: string | null;
    }>;
  };
};

const transactionTypes = new Set([
  "deposit",
  "disbursement",
  "transfer",
  "reversal",
  "bank_fee",
  "adjustment",
]);

function requiredText(value: string | null | undefined, label: string, maxLength: number) {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(`${label} is required.`);
  if (cleaned.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return cleaned;
}

function normalizedMemo(value: string | null | undefined) {
  const memo = value?.trim() ?? "";
  if (memo.length > 1000) throw new Error("Trust entry memo must be 1000 characters or fewer.");
  return memo;
}

function matterAccessWhere(userId: string) {
  return {
    OR: [
      { matterId: null },
      {
        matter: {
          AND: [
            {
              OR: [
                { confidentiality: { not: "restricted" } },
                {
                  teamMembers: {
                    some: { userId, status: "active", canAccessRestricted: true },
                  },
                },
              ],
            },
            {
              NOT: {
                ethicalWalls: {
                  some: {
                    status: "active",
                    members: { some: { userId, status: "active", decision: "blocked" } },
                  },
                },
              },
            },
          ],
        },
      },
    ],
  };
}

async function assertTrustReplayMatterAccess(tx: any, firmId: string, userId: string, entries: any[]) {
  const ledgerIds = [...new Set(entries.flatMap((entry) => entry.ledgerAccountId ? [entry.ledgerAccountId] : []))];
  if (!ledgerIds.length) return;
  const ledgers = await tx.trustLedgerAccount.findMany({
    where: { firmId, id: { in: ledgerIds } },
    select: { id: true, matterId: true },
  });
  if (ledgers.length !== ledgerIds.length) throw new Error("Trust replay resources are no longer available in the active firm.");
  const matterIds = Array.from(new Set<string>(ledgers.flatMap((ledger: any) => ledger.matterId ? [String(ledger.matterId)] : [])));
  for (const matterId of matterIds) {
    await assertMatterAccess(tx, firmId, matterId, userId);
  }
}

function digestEntry(entry: PostTrustTransactionArgs["data"]["entries"][number], currencyCode: string) {
  return {
    ledgerAccountId: entry.ledgerAccountId ?? null,
    accountingBucket: entry.accountingBucket,
    direction: entry.direction,
    amountMinor: entry.amountMinor,
    currencyCode,
    memo: normalizedMemo(entry.memo),
  };
}

export function computeTrustPostingDigest(
  data: PostTrustTransactionArgs["data"],
  description = data.description.trim(),
  occurredAt = new Date(data.occurredAt),
) {
  const entries = data.entries
    .map((entry) => digestEntry(entry, data.currencyCode))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return sha256Digest({
    trustAccountId: data.trustAccountId,
    transactionType: data.transactionType,
    currencyCode: data.currencyCode,
    occurredAt: occurredAt.toISOString(),
    description,
    reversesTransactionId: data.reversesTransactionId ?? null,
    sourcePaymentId: data.sourcePaymentId ?? null,
    sourceRefundId: data.sourceRefundId ?? null,
    entries,
  });
}

function reversalSignature(entry: {
  ledgerAccountId?: string | null;
  accountingBucket: string;
  direction: string;
  amountMinor: number;
  currencyCode?: string | null;
}, invert: boolean) {
  const direction = invert
    ? entry.direction === "debit" ? "credit" : "debit"
    : entry.direction;
  return canonicalJson({
    ledgerAccountId: entry.ledgerAccountId ?? null,
    accountingBucket: entry.accountingBucket,
    direction,
    amountMinor: entry.amountMinor,
    currencyCode: entry.currencyCode,
  });
}

export function assertExactReversal(originalEntries: any[], requestedEntries: PostTrustTransactionArgs["data"]["entries"], currencyCode: string) {
  const expected = originalEntries.map((entry) => reversalSignature(entry, true)).sort();
  const actual = requestedEntries.map((entry) => reversalSignature({ ...entry, currencyCode }, false)).sort();
  if (canonicalJson(expected) !== canonicalJson(actual)) {
    throw new Error("A reversal must exactly invert every entry in the referenced transaction.");
  }
}

export function assertExactTrustSourcePosting(args: {
  kind: "payment" | "refund";
  source: any;
  transactionType: string;
  trustAccountId: string;
  currencyCode: string;
  ledgers: Array<{ matterId?: string | null }>;
  entries: PostTrustTransactionArgs["data"]["entries"];
}) {
  const total = (bucket: TrustAccountingBucket, direction: TrustEntryDirection) =>
    args.entries.reduce((sum, entry) =>
      entry.accountingBucket === bucket && entry.direction === direction
        ? sum + entry.amountMinor
        : sum, 0);
  const source = args.source;

  if (source.trustTransactions.length) {
    throw new Error(`The source ${args.kind} already has a posted trust transaction.`);
  }
  if (source.matterId && args.ledgers.some((ledger) => ledger.matterId !== source.matterId)) {
    throw new Error(`Source ${args.kind} and client ledgers must use the same matter scope.`);
  }

  if (args.kind === "payment") {
    if (
      args.transactionType !== "deposit" ||
      source.paymentType !== "trust_deposit" ||
      !new Set(["captured", "settled"]).has(source.status) ||
      source.trustAccountId !== args.trustAccountId ||
      source.currencyCode !== args.currencyCode
    ) {
      throw new Error("A trust source payment must be a captured or settled same-account trust deposit in the posting currency.");
    }
    if (
      total("client_liability", "credit") !== source.amountMinor ||
      total("bank_control", "debit") !== source.amountMinor ||
      total("client_liability", "debit") !== 0 ||
      total("bank_control", "credit") !== 0
    ) {
      throw new Error("A source payment posting must exactly debit bank control and credit client liability for the payment amount.");
    }
    return;
  }

  if (
    args.transactionType !== "disbursement" ||
    !new Set(["approved", "processing"]).has(source.status) ||
    source.payment.paymentType !== "trust_deposit" ||
    source.payment.trustAccountId !== args.trustAccountId ||
    source.currencyCode !== args.currencyCode
  ) {
    throw new Error("A trust source refund must be an approved or processing same-account trust-deposit refund in the posting currency.");
  }
  if (
    total("client_liability", "debit") !== source.amountMinor ||
    total("bank_control", "credit") !== source.amountMinor ||
    total("client_liability", "credit") !== 0 ||
    total("bank_control", "debit") !== 0
  ) {
    throw new Error("A source refund posting must exactly debit client liability and credit bank control for the refund amount.");
  }
}

export async function postTrustTransaction(
  _root: unknown,
  { data }: PostTrustTransactionArgs,
  context: Context,
) {
  const session = context.session as any;
  const firmId = activeFirmId(session);
  if (!firmId || !session?.itemId || !permissions.canManageTrust({ session })) {
    throw new Error("You do not have permission to post trust transactions.");
  }

  const description = requiredText(data.description, "Description", 2000);
  if (!transactionTypes.has(data.transactionType)) throw new Error("Unsupported trust transaction type.");
  if (data.sourcePaymentId && data.sourceRefundId) {
    throw new Error("A trust transaction cannot reference both a source payment and a source refund.");
  }
  const occurredAt = new Date(data.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("A valid occurrence timestamp is required.");
  if (occurredAt.getTime() > Date.now()) throw new Error("Trust transactions cannot be future-dated.");
  for (const entry of data.entries) normalizedMemo(entry.memo);

  const validatedInput: TrustPostingInput = {
    idempotencyKey: data.idempotencyKey,
    trustAccountId: data.trustAccountId,
    currencyCode: data.currencyCode,
    occurredAt: data.occurredAt,
    description,
    entries: data.entries.map((entry) => ({
      ledgerAccountId: entry.ledgerAccountId ?? undefined,
      accountingBucket: entry.accountingBucket,
      direction: entry.direction,
      amountMinor: entry.amountMinor,
      currencyCode: entry.currencyCode ?? undefined,
      memo: entry.memo ?? undefined,
    })),
    reversesTransactionId: data.reversesTransactionId ?? undefined,
    sourcePaymentId: data.sourcePaymentId ?? undefined,
    sourceRefundId: data.sourceRefundId ?? undefined,
  };
  const validation = validateTrustPosting(validatedInput);
  const storedIdempotencyKey = `${firmId}:${validation.idempotencyKey}`;
  const postingDigest = computeTrustPostingDigest(data, description, occurredAt);
  const ledgerIds = [...new Set(data.entries.flatMap((entry) =>
    entry.ledgerAccountId ? [entry.ledgerAccountId] : [],
  ))];
  const prisma = context.prisma as any;

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageTrust");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${storedIdempotencyKey}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-account:${firmId}:${data.trustAccountId}`}))`;

    const replay = await tx.trustTransaction.findUnique({
      where: { idempotencyKey: storedIdempotencyKey },
      include: { entries: true },
    });
    if (replay) {
      if (replay.postingDigest !== postingDigest) {
        throw new Error("Idempotency key was already used for a different trust posting.");
      }
      await assertTrustReplayMatterAccess(tx, firmId, session.itemId, replay.entries);
      return { transaction: replay, replayed: true };
    }

    const account = await tx.trustAccount.findFirst({
      where: { id: data.trustAccountId, firmId, status: "active" },
      select: { id: true, currencyCode: true },
    });
    if (!account) throw new Error("Active trust account not found in the active firm.");
    if (account.currencyCode !== data.currencyCode) {
      throw new Error("Trust transaction currency must match the trust account currency.");
    }

    const completedPeriods = await tx.trustReconciliation.findMany({
      where: {
        firmId,
        trustAccountId: account.id,
        status: "completed",
        periodEnd: { gte: occurredAt },
      },
      select: { status: true, periodStart: true, periodEnd: true },
    });
    assertTrustPostingPeriodOpen(occurredAt, completedPeriods);

    const ledgers = ledgerIds.length
      ? await tx.trustLedgerAccount.findMany({
          where: {
            id: { in: ledgerIds },
            firmId,
            trustAccountId: account.id,
            currencyCode: data.currencyCode,
            status: "active",
            ...matterAccessWhere(session.itemId),
          },
          select: { id: true, matterId: true },
        })
      : [];
    if (ledgers.length !== ledgerIds.length) {
      throw new Error("Every client ledger must be active, accessible, and belong to the selected trust account and firm.");
    }
    const ledgerById = new Map(ledgers.map((ledger: any) => [ledger.id, ledger]));

    if (data.reversesTransactionId) {
      if (data.transactionType !== "reversal") {
        throw new Error("A transaction with a reversal reference must use the reversal type.");
      }
      const [original, priorReversal] = await Promise.all([
        tx.trustTransaction.findFirst({
          where: {
            id: data.reversesTransactionId,
            firmId,
            trustAccountId: account.id,
            currencyCode: data.currencyCode,
          },
          include: { entries: true },
        }),
        tx.trustTransaction.findFirst({
          where: { firmId, reversesTransactionId: data.reversesTransactionId },
          select: { id: true },
        }),
      ]);
      if (!original) throw new Error("Reversed transaction not found in the selected trust account and firm.");
      if (priorReversal) throw new Error("The referenced trust transaction already has a reversal.");
      assertExactReversal(original.entries, data.entries, data.currencyCode);
    } else if (data.transactionType === "reversal") {
      throw new Error("A reversal must reference the transaction it corrects.");
    }

    if (data.sourcePaymentId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-source-payment:${firmId}:${data.sourcePaymentId}`}))`;
      const payment = await tx.payment.findFirst({
        where: { id: data.sourcePaymentId, firmId, ...matterAccessWhere(session.itemId) },
        select: {
          id: true, matterId: true, paymentType: true, status: true, amountMinor: true,
          currencyCode: true, trustAccountId: true, trustTransactions: { select: { id: true } },
        },
      });
      if (!payment) throw new Error("Payment not found in the accessible active-firm scope.");
      assertExactTrustSourcePosting({
        kind: "payment", source: payment, transactionType: data.transactionType,
        trustAccountId: account.id, currencyCode: data.currencyCode, ledgers, entries: data.entries,
      });
    }

    if (data.sourceRefundId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trust-source-refund:${firmId}:${data.sourceRefundId}`}))`;
      const refund = await tx.refund.findFirst({
        where: { id: data.sourceRefundId, firmId, ...matterAccessWhere(session.itemId) },
        select: {
          id: true, matterId: true, status: true, amountMinor: true, currencyCode: true,
          trustTransactions: { select: { id: true } },
          payment: { select: { paymentType: true, trustAccountId: true } },
        },
      });
      if (!refund) throw new Error("Refund not found in the accessible active-firm scope.");
      assertExactTrustSourcePosting({
        kind: "refund", source: refund, transactionType: data.transactionType,
        trustAccountId: account.id, currencyCode: data.currencyCode, ledgers, entries: data.entries,
      });
    }

    if (ledgerIds.length) {
      const historicalEntries = await tx.trustLedgerEntry.findMany({
        where: {
          firmId,
          ledgerAccountId: { in: ledgerIds },
          accountingBucket: "client_liability",
        },
        select: { ledgerAccountId: true, direction: true, amountMinor: true, occurredAt: true },
      });
      assertTrustLedgerHistoricalMinimumBalances(
        historicalEntries as Array<{ ledgerAccountId: string; direction: TrustEntryDirection; amountMinor: number; occurredAt: Date }>,
        data.entries.flatMap((entry) => entry.accountingBucket === "client_liability" && entry.ledgerAccountId
          ? [{ ledgerAccountId: entry.ledgerAccountId, direction: entry.direction, amountMinor: entry.amountMinor, occurredAt }]
          : []),
      );
    }

    const transaction = await tx.trustTransaction.create({
      data: {
        firmId,
        transactionNumber: `TRUST-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
        idempotencyKey: storedIdempotencyKey,
        postingDigest,
        trustAccountId: account.id,
        transactionType: data.transactionType,
        status: "posted",
        currencyCode: data.currencyCode,
        description,
        occurredAt,
        postedAt: new Date(),
        postedById: session.itemId,
        postedByAgentId: session.agentPrincipalId ?? null,
        sourcePaymentId: data.sourcePaymentId ?? null,
        sourceRefundId: data.sourceRefundId ?? null,
        reversesTransactionId: data.reversesTransactionId ?? null,
      },
    });

    await tx.trustLedgerEntry.createMany({
      data: data.entries.map((entry) => {
        const ledger = entry.ledgerAccountId ? ledgerById.get(entry.ledgerAccountId) as any : null;
        return {
          firmId,
          matterId: ledger?.matterId ?? null,
          transactionId: transaction.id,
          trustAccountId: account.id,
          ledgerAccountId: entry.ledgerAccountId ?? null,
          accountingBucket: entry.accountingBucket,
          direction: entry.direction,
          amountMinor: entry.amountMinor,
          currencyCode: data.currencyCode,
          memo: normalizedMemo(entry.memo),
          occurredAt,
        };
      }),
    });

    const posted = await tx.trustTransaction.findUnique({
      where: { id: transaction.id },
      include: { entries: true },
    });
    if (!posted) throw new Error("Trust posting could not be reloaded after creation.");
    await tx.auditEvent.create({
      data: {
        firmId,
        eventId: `trust-posting:${storedIdempotencyKey}`,
        eventType: "trust.transaction_posted",
        category: "financial",
        outcome: "succeeded",
        ...workflowActor(context, session.itemId),
        trustTransactionId: posted.id,
        occurredAt: new Date(),
        metadata: {
          postingDigest,
          transactionType: data.transactionType,
          currencyCode: data.currencyCode,
          entryCount: data.entries.length,
          reversal: Boolean(data.reversesTransactionId),
        },
      },
    });
    return { transaction: posted, replayed: false };
  });
}
