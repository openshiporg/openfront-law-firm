-- AlterTable
ALTER TABLE "Intake" ADD COLUMN     "practiceArea" TEXT;

-- CreateTable
CREATE TABLE "AttorneyProfile" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "focus" TEXT NOT NULL DEFAULT '',
    "biography" TEXT NOT NULL DEFAULT '',
    "admissions" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttorneyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AttorneyProfile_practiceAreas" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AttorneyProfile_practiceAreas_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "AttorneyProfile_firm_idx" ON "AttorneyProfile"("firm");

-- CreateIndex
CREATE INDEX "AttorneyProfile_slug_idx" ON "AttorneyProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AttorneyProfile_firm_slug_key" ON "AttorneyProfile"("firm", "slug");

-- CreateIndex
CREATE INDEX "_AttorneyProfile_practiceAreas_B_index" ON "_AttorneyProfile_practiceAreas"("B");

-- CreateIndex
CREATE INDEX "Intake_practiceArea_idx" ON "Intake"("practiceArea");

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_practiceArea_fkey" FOREIGN KEY ("practiceArea") REFERENCES "PracticeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttorneyProfile" ADD CONSTRAINT "AttorneyProfile_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttorneyProfile_practiceAreas" ADD CONSTRAINT "_AttorneyProfile_practiceAreas_A_fkey" FOREIGN KEY ("A") REFERENCES "AttorneyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttorneyProfile_practiceAreas" ADD CONSTRAINT "_AttorneyProfile_practiceAreas_B_fkey" FOREIGN KEY ("B") REFERENCES "PracticeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

