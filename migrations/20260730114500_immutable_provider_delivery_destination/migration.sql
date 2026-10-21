-- Bind every provider delivery attempt to an immutable stored destination.
-- Existing pending deliveries are left with an empty sentinel and bind to their
-- current subscription destination atomically on their first controlled attempt.
ALTER TABLE "WebhookDelivery"
  ADD COLUMN "destinationUrl" TEXT NOT NULL DEFAULT '';
