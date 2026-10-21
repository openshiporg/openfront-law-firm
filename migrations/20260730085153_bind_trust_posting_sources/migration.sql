-- A payment or refund may be bound to at most one immutable trust posting.
-- Fail closed with a clear error if historical duplicates exist; do not repair data automatically.
DO $$
BEGIN
  IF EXISTS (
    SELECT "sourcePayment"
    FROM "TrustTransaction"
    WHERE "sourcePayment" IS NOT NULL
    GROUP BY "sourcePayment"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce trust source payment uniqueness: duplicate sourcePayment values exist';
  END IF;

  IF EXISTS (
    SELECT "sourceRefund"
    FROM "TrustTransaction"
    WHERE "sourceRefund" IS NOT NULL
    GROUP BY "sourceRefund"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce trust source refund uniqueness: duplicate sourceRefund values exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "TrustTransaction_sourcePayment_key"
  ON "TrustTransaction"("sourcePayment");

CREATE UNIQUE INDEX "TrustTransaction_sourceRefund_key"
  ON "TrustTransaction"("sourceRefund");
