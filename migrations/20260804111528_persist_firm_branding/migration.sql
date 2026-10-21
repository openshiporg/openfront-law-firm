-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "brandColor" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandTagline" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "displayName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "shortName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "supportEmail" TEXT NOT NULL DEFAULT '';

-- Preserve every existing tenant's identity while giving the operator shell a
-- deterministic fallback brand. Only the known synthetic demo tenant receives
-- the fictional Harbor & Pine alternate brand.
UPDATE "Firm"
SET "displayName" = "name",
    "shortName" = LEFT("name", 40)
WHERE "displayName" = '' OR "shortName" = '';

UPDATE "Firm"
SET "displayName" = 'Harbor & Pine Legal',
    "shortName" = 'Harbor & Pine',
    "brandTagline" = 'Practical counsel for growing businesses and families.',
    "brandColor" = '#1f4d46',
    "supportEmail" = 'hello@harborpine.example'
WHERE "slug" IN ('openfront-law-firm-demo', 'harbor-pine-legal');
