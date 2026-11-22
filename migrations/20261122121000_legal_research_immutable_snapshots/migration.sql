-- DropIndex
DROP INDEX "LegalSource_matter_provider_externalId_key";

-- CreateIndex
CREATE UNIQUE INDEX "LegalSource_matter_provider_externalId_contentSha256_key" ON "LegalSource"("matter", "provider", "externalId", "contentSha256");

