-- Intakes whose client cancelled their only consultation were left New with a Requested
-- conflict check. Close them as withdrawn and cancel their open checks.
WITH withdrawn AS (
  SELECT i."id"
  FROM "Intake" i
  WHERE i."status" IN ('new', 'screening', 'conflict_review', 'consultation', 'decision')
    AND EXISTS (
      SELECT 1 FROM "Consultation" c
      WHERE c."intake" = i."id" AND c."status" = 'cancelled' AND c."cancellationReason" LIKE 'Cancelled by client%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM "Consultation" c
      WHERE c."intake" = i."id" AND c."status" IN ('requested', 'scheduled', 'completed')
    )
), updated AS (
  UPDATE "Intake" SET "status" = 'withdrawn', "declineReason" = 'Client cancelled the consultation.', "decidedAt" = NOW()
  WHERE "id" IN (SELECT "id" FROM withdrawn)
  RETURNING "id"
)
UPDATE "ConflictCheck" SET "status" = 'cancelled', "completedAt" = NOW(), "summary" = 'Cancelled: the client cancelled the consultation.'
WHERE "intake" IN (SELECT "id" FROM updated) AND "status" IN ('requested', 'running', 'review_required');
