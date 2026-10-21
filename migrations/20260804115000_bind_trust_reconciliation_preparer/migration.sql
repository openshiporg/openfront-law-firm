-- Preserve the human preparer required for independent trust reconciliation review.
-- Historical rows remain nullable because a preparer cannot be reconstructed safely.
-- Controlled completion fails closed for any historical row without this evidence.
ALTER TABLE "TrustReconciliation"
  ADD COLUMN "createdBy" TEXT;

CREATE INDEX "TrustReconciliation_createdBy_idx"
  ON "TrustReconciliation"("createdBy");

ALTER TABLE "TrustReconciliation"
  ADD CONSTRAINT "TrustReconciliation_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
