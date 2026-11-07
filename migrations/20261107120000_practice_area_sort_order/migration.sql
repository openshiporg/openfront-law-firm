-- PracticeArea: firm-chosen public listing order (lowest first; ties by web address).
ALTER TABLE "PracticeArea" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
