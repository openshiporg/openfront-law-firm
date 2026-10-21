-- Additive only: one enum, one table, two columns, indexes and a foreign key. Nothing is dropped or rewritten.
-- Generated offline with prisma migrate diff from the previous schema.prisma; the User.role -> bootstrapRole
-- rename keeps its database column ("role") and produces no SQL.

-- CreateEnum
CREATE TYPE "PublicSitePolicyStatusType" AS ENUM ('draft', 'published');

-- AlterTable
ALTER TABLE "PracticeArea" ADD COLUMN     "publicSlug" TEXT;

-- AlterTable
ALTER TABLE "WebhookSubscription" ADD COLUMN     "signingSecretEncrypted" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PublicSitePolicy" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "status" "PublicSitePolicyStatusType" NOT NULL DEFAULT 'draft',
    "publicAccountsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "privacyNotice" TEXT NOT NULL DEFAULT '',
    "privacyNoticeVersion" INTEGER DEFAULT 0,
    "firstContactNotice" TEXT NOT NULL DEFAULT '',
    "firstContactNoticeVersion" INTEGER DEFAULT 0,
    "aboutStatement" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicSitePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicSitePolicy_firm_idx" ON "PublicSitePolicy"("firm");

-- CreateIndex
CREATE UNIQUE INDEX "PublicSitePolicy_firm_key" ON "PublicSitePolicy"("firm");

-- CreateIndex
CREATE INDEX "PracticeArea_publicSlug_idx" ON "PracticeArea"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeArea_firm_publicSlug_key" ON "PracticeArea"("firm", "publicSlug");

-- AddForeignKey
ALTER TABLE "PublicSitePolicy" ADD CONSTRAINT "PublicSitePolicy_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: give existing public services the slug the PracticeArea hook would derive from a
-- simple code (letters, digits, single hyphens). Codes that are not already slug-shaped, or that
-- collide case-insensitively with another public service in the same firm, stay NULL for an
-- operator to choose, so no two services ever claim one URL.
UPDATE "PracticeArea" p
SET "publicSlug" = lower(p."code")
WHERE p."isPublic" = true
  AND p."publicSlug" IS NULL
  AND length(p."code") BETWEEN 1 AND 80
  AND lower(p."code") ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  AND NOT EXISTS (
    SELECT 1 FROM "PracticeArea" o
    WHERE o."firm" = p."firm" AND o."id" <> p."id" AND o."isPublic" = true AND lower(o."code") = lower(p."code")
  );
