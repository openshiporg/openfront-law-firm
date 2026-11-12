-- Payments already refunded in full move to the new Refunded status.
UPDATE "Payment" SET "status" = 'refunded'
WHERE "status" = 'captured' AND "refundedMinor" >= "amountMinor";
