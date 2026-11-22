-- CreateEnum
CREATE TYPE "LegalSourceProviderType" AS ENUM ('maine_statutes', 'ecfr', 'maine_law_court', 'courtlistener');

-- CreateEnum
CREATE TYPE "LegalSourceKindType" AS ENUM ('statute', 'regulation', 'judgment');

-- CreateTable
CREATE TABLE "LegalSource" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "provider" "LegalSourceProviderType" NOT NULL,
    "kind" "LegalSourceKindType" NOT NULL,
    "externalId" TEXT NOT NULL DEFAULT '',
    "jurisdiction" TEXT NOT NULL DEFAULT '',
    "citation" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "court" TEXT NOT NULL DEFAULT '',
    "decidedOn" TEXT NOT NULL DEFAULT '',
    "sourceAsOf" TEXT NOT NULL DEFAULT '',
    "officialUrl" TEXT NOT NULL DEFAULT '',
    "sourceStatus" TEXT NOT NULL DEFAULT '',
    "contentSha256" TEXT NOT NULL DEFAULT '',
    "paragraphCount" INTEGER NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "retrievedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalSourceParagraph" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "anchor" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "textSha256" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalSourceParagraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "author" TEXT,
    "claimCount" INTEGER NOT NULL,
    "supportedCount" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "removedCitations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ResearchNote_citedParagraphs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ResearchNote_citedParagraphs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "LegalSource_firm_idx" ON "LegalSource"("firm");

-- CreateIndex
CREATE INDEX "LegalSource_matter_idx" ON "LegalSource"("matter");

-- CreateIndex
CREATE INDEX "LegalSource_retrievedBy_idx" ON "LegalSource"("retrievedBy");

-- CreateIndex
CREATE UNIQUE INDEX "LegalSource_matter_provider_externalId_key" ON "LegalSource"("matter", "provider", "externalId");

-- CreateIndex
CREATE INDEX "LegalSourceParagraph_firm_idx" ON "LegalSourceParagraph"("firm");

-- CreateIndex
CREATE INDEX "LegalSourceParagraph_matter_idx" ON "LegalSourceParagraph"("matter");

-- CreateIndex
CREATE INDEX "LegalSourceParagraph_source_idx" ON "LegalSourceParagraph"("source");

-- CreateIndex
CREATE UNIQUE INDEX "LegalSourceParagraph_source_anchor_key" ON "LegalSourceParagraph"("source", "anchor");

-- CreateIndex
CREATE INDEX "ResearchNote_firm_idx" ON "ResearchNote"("firm");

-- CreateIndex
CREATE INDEX "ResearchNote_matter_idx" ON "ResearchNote"("matter");

-- CreateIndex
CREATE INDEX "ResearchNote_author_idx" ON "ResearchNote"("author");

-- CreateIndex
CREATE INDEX "_ResearchNote_citedParagraphs_B_index" ON "_ResearchNote_citedParagraphs"("B");

-- AddForeignKey
ALTER TABLE "LegalSource" ADD CONSTRAINT "LegalSource_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalSource" ADD CONSTRAINT "LegalSource_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalSource" ADD CONSTRAINT "LegalSource_retrievedBy_fkey" FOREIGN KEY ("retrievedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalSourceParagraph" ADD CONSTRAINT "LegalSourceParagraph_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalSourceParagraph" ADD CONSTRAINT "LegalSourceParagraph_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalSourceParagraph" ADD CONSTRAINT "LegalSourceParagraph_source_fkey" FOREIGN KEY ("source") REFERENCES "LegalSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_author_fkey" FOREIGN KEY ("author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ResearchNote_citedParagraphs" ADD CONSTRAINT "_ResearchNote_citedParagraphs_A_fkey" FOREIGN KEY ("A") REFERENCES "LegalSourceParagraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ResearchNote_citedParagraphs" ADD CONSTRAINT "_ResearchNote_citedParagraphs_B_fkey" FOREIGN KEY ("B") REFERENCES "ResearchNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

