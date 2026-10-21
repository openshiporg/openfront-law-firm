import { isGraphqlInt } from "./int32";

export type TrustEntryDirection = "debit" | "credit";
export type TrustAccountingBucket =
  | "bank_control"
  | "client_liability"
  | "bank_fee"
  | "suspense";

export type TrustPostingEntryInput = {
  ledgerAccountId?: string;
  accountingBucket: TrustAccountingBucket;
  direction: TrustEntryDirection;
  amountMinor: number;
  currencyCode?: string;
  memo?: string;
};

export type TrustPostingInput = {
  idempotencyKey: string;
  trustAccountId: string;
  currencyCode: string;
  occurredAt?: string;
  description: string;
  entries: TrustPostingEntryInput[];
  reversesTransactionId?: string;
  sourcePaymentId?: string;
  sourceRefundId?: string;
};

const currencyPattern = /^[A-Z]{3}$/;
const accountingBuckets = new Set<TrustAccountingBucket>([
  "bank_control",
  "client_liability",
  "bank_fee",
  "suspense",
]);

export type HistoricalTrustEntry = {
  ledgerAccountId: string;
  direction: TrustEntryDirection;
  amountMinor: number;
  occurredAt: Date | string;
};

export type TrustPeriodStatus = "draft" | "in_review" | "completed" | "reopened";

export function assertTrustLedgerHistoricalMinimumBalances(
  existingEntries: HistoricalTrustEntry[],
  proposedEntries: HistoricalTrustEntry[],
) {
  const events = new Map<string, Map<number, number>>();
  const add = (entry: HistoricalTrustEntry) => {
    if (!entry.ledgerAccountId || !isGraphqlInt(entry.amountMinor) || entry.amountMinor <= 0) {
      throw new Error("Trust ledger history contains an invalid client-liability entry.");
    }
    const occurredAt = entry.occurredAt instanceof Date ? entry.occurredAt : new Date(entry.occurredAt);
    const at = occurredAt.valueOf();
    if (!Number.isFinite(at)) throw new Error("Trust ledger history contains an invalid effective date.");
    const delta = entry.direction === "credit" ? entry.amountMinor : entry.direction === "debit" ? -entry.amountMinor : null;
    if (delta === null) throw new Error("Trust ledger history contains an invalid direction.");
    let ledgerEvents = events.get(entry.ledgerAccountId);
    if (!ledgerEvents) events.set(entry.ledgerAccountId, (ledgerEvents = new Map()));
    const next = (ledgerEvents.get(at) ?? 0) + delta;
    if (!isGraphqlInt(next)) throw new Error("Trust ledger history exceeds the supported database integer range.");
    ledgerEvents.set(at, next);
  };

  for (const entry of existingEntries) add(entry);
  for (const entry of proposedEntries) add(entry);

  for (const ledgerEvents of events.values()) {
    let balance = 0;
    for (const [, delta] of [...ledgerEvents].sort(([left], [right]) => left - right)) {
      balance += delta;
      if (!isGraphqlInt(balance)) throw new Error("Trust ledger balance exceeds the supported database integer range.");
      if (balance < 0) throw new Error("Trust posting would make a client ledger historically over-disbursed.");
    }
  }
}

export function assertTrustPostingPeriodOpen(
  occurredAt: Date | string,
  reconciliations: Array<{ status: TrustPeriodStatus; periodStart: Date | string; periodEnd: Date | string }>,
) {
  const effectiveAt = occurredAt instanceof Date ? occurredAt.valueOf() : new Date(occurredAt).valueOf();
  if (!Number.isFinite(effectiveAt)) throw new Error("A valid trust posting effective date is required.");
  // Reconciled balances are cumulative through periodEnd (see trustBalancesAsOf), so
  // a posting dated on or before ANY completed period's end changes that period's
  // closing balances, even when it falls before the period start.
  const closedPeriod = reconciliations.some((reconciliation) => {
    if (reconciliation.status !== "completed") return false;
    const end = reconciliation.periodEnd instanceof Date ? reconciliation.periodEnd.valueOf() : new Date(reconciliation.periodEnd).valueOf();
    return !Number.isFinite(end) || effectiveAt <= end;
  });
  if (closedPeriod) throw new Error("Trust postings cannot be dated on or before the end of a completed reconciliation period; reopen that reconciliation through review first.");
}

export function validateTrustPosting(input: TrustPostingInput) {
  const idempotencyKey = input.idempotencyKey?.trim();
  if (!idempotencyKey || idempotencyKey.length < 12 || idempotencyKey.length > 160) {
    throw new Error("A durable idempotency key between 12 and 160 characters is required.");
  }
  if (!input.trustAccountId?.trim()) throw new Error("A trust account is required.");
  if (!currencyPattern.test(input.currencyCode)) {
    throw new Error("A three-letter uppercase currency code is required.");
  }
  if (!Array.isArray(input.entries) || input.entries.length < 2) {
    throw new Error("A trust posting requires at least two ledger entries.");
  }

  let debitTotalMinor = 0;
  let creditTotalMinor = 0;

  for (const entry of input.entries) {
    if (!isGraphqlInt(entry.amountMinor) || entry.amountMinor <= 0) {
      throw new Error("Every trust entry must use a positive integer minor-unit amount.");
    }
    const entryCurrency = entry.currencyCode ?? input.currencyCode;
    if (entryCurrency !== input.currencyCode) {
      throw new Error("Every trust entry must use the same currency as its transaction.");
    }
    if (!accountingBuckets.has(entry.accountingBucket)) {
      throw new Error("Trust entry accounting bucket is not supported.");
    }
    if (entry.accountingBucket === "client_liability" && !entry.ledgerAccountId?.trim()) {
      throw new Error("A client-liability trust entry requires a ledger account.");
    }
    if (entry.accountingBucket !== "client_liability" && entry.ledgerAccountId?.trim()) {
      throw new Error("Only client-liability entries may reference a client ledger account.");
    }
    if ((entry.memo?.trim().length ?? 0) > 1000) {
      throw new Error("Trust entry memo must be 1000 characters or fewer.");
    }
    if (entry.direction === "debit") debitTotalMinor += entry.amountMinor;
    else if (entry.direction === "credit") creditTotalMinor += entry.amountMinor;
    else throw new Error("Trust entry direction must be debit or credit.");
  }

  if (!isGraphqlInt(debitTotalMinor) || !isGraphqlInt(creditTotalMinor)) {
    throw new Error("Trust posting totals exceed the supported database integer range.");
  }
  if (debitTotalMinor !== creditTotalMinor) {
    throw new Error("Trust transaction debits must equal credits.");
  }

  return {
    idempotencyKey,
    currencyCode: input.currencyCode,
    debitTotalMinor,
    creditTotalMinor,
    entryCount: input.entries.length,
  };
}
