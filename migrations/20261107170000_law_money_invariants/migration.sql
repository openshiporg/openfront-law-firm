-- Money and time invariants the billing, trust and payment commands rely on (round 2, 2026-11-07).
-- Commands already compute these inside serializable transactions; these CHECKs are the backstop for any
-- other writer (seed, import, admin sudo, future code). Live data was checked read-only first: 0 violations.

-- Invoice arithmetic: total = subtotal - discount + tax, nothing negative, paid never exceeds total,
-- and balance due = total - paid except on a void invoice (voiding zeroes the balance).
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_consistent" CHECK (
  "subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "taxMinor" >= 0 AND "paidMinor" >= 0 AND "balanceDueMinor" >= 0
  AND "totalMinor" = "subtotalMinor" - "discountMinor" + "taxMinor"
  AND "paidMinor" <= "totalMinor"
  AND ("status" = 'void' OR "balanceDueMinor" = "totalMinor" - "paidMinor")
);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_currency_iso" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_amounts_valid" CHECK (
  ("quantity" IS NULL OR "quantity" > 0) AND "unitAmountMinor" >= 0 AND "subtotalMinor" >= 0 AND "lineTotalMinor" >= 0
  AND ("discountMinor" IS NULL OR "discountMinor" >= 0) AND ("taxMinor" IS NULL OR "taxMinor" >= 0)
);

-- Payments: positive, refunds never exceed the captured amount.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_within_amount" CHECK (
  "amountMinor" > 0 AND COALESCE("refundedMinor", 0) >= 0 AND COALESCE("refundedMinor", 0) <= "amountMinor"
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currency_iso" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive" CHECK ("amountMinor" > 0);
-- Allocations (reversals included) carry a positive amount; direction comes from allocationType.
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK ("amountMinor" > 0);

-- Trust: postings positive (direction says debit/credit).
ALTER TABLE "TrustLedgerEntry" ADD CONSTRAINT "TrustLedgerEntry_amount_positive" CHECK ("amountMinor" > 0);

-- Time and expenses.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_amounts_valid" CHECK ("durationMinutes" > 0 AND ("rateMinor" IS NULL OR "rateMinor" >= 0) AND ("amountMinor" IS NULL OR "amountMinor" >= 0));
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "RetainerAgreement" ADD CONSTRAINT "RetainerAgreement_amounts_nonnegative" CHECK (
  COALESCE("initialRetainerMinor", 0) >= 0 AND COALESCE("evergreenThresholdMinor", 0) >= 0 AND COALESCE("replenishmentAmountMinor", 0) >= 0
);
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_amount_nonnegative" CHECK ("amountMinor" IS NULL OR "amountMinor" >= 0);

-- Time windows.
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_window_valid" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_fee_nonnegative" CHECK ("feeMinor" IS NULL OR "feeMinor" >= 0);
ALTER TABLE "TrustReconciliation" ADD CONSTRAINT "TrustReconciliation_period_valid" CHECK ("periodEnd" >= "periodStart");
ALTER TABLE "AgentGrant" ADD CONSTRAINT "AgentGrant_window_valid" CHECK ("startsAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" > "startsAt");
