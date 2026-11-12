-- A payment refunded in full reads Refunded instead of Captured.
ALTER TYPE "PaymentStatusType" ADD VALUE IF NOT EXISTS 'refunded' AFTER 'settled';
