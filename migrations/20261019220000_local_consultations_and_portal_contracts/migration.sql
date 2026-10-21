-- Additive reconciliation of existing portal source and local consultation contracts.
-- Existing rows retain explicit legacy version zero and are not assigned owners.
-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "account" TEXT,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "feeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requestDigest" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requestKey" TEXT,
ADD COLUMN     "serviceSnapshot" JSONB,
ADD COLUMN     "serviceTitle" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoColor" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "logoIcon" TEXT NOT NULL DEFAULT '<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g clip-rule="evenodd" fill-rule="evenodd"><path d="m34.5868 8.40061-9.6868-2.59556c-.6687-.17919-1.2108.23679-1.2108.92911v10.02854c0 .6923.5421 1.3988 1.2108 1.578l9.6868 2.5955c.6687.1792 1.2109-.2368 1.2109-.9291v-10.02848c0-.69232-.5422-1.39882-1.2109-1.57801zm-9.6868-6.35625c-2.6749-.71674-4.8434.94718-4.8434 3.71647v10.02847c0 2.7693 2.1685 5.5953 4.8434 6.312l9.6868 2.5956c2.6749.7168 4.8434-.9472 4.8434-3.7165v-10.0284c0-2.76934-2.1685-5.59533-4.8434-6.31207z" fill="#8098f9"/><path d="m26.9812 16.5707-12.1085-3.2444c-.6687-.1792-1.2109.2368-1.2109.9291v12.5356c0 .6923.5422 1.3988 1.2109 1.578l12.1085 3.2445c.6687.1792 1.2108-.2368 1.2108-.9291v-12.5356c0-.6924-.5421-1.3989-1.2108-1.5781zm-12.1085-7.0051c-2.6749-.71674-4.8434.9472-4.8434 3.7165v12.5356c0 2.7693 2.1685 5.5953 4.8434 6.312l12.1085 3.2445c2.6749.7167 4.8433-.9472 4.8433-3.7165v-12.5356c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#6172f3"/><path d="m19.3736 24.7409-14.53021-3.8934c-.66873-.1792-1.21085.2368-1.21085.9291v15.0428c0 .6923.54212 1.3988 1.21085 1.578l14.53021 3.8933c.6687.1792 1.2108-.2368 1.2108-.9291v-15.0427c0-.6923-.5421-1.3988-1.2108-1.578zm-14.53021-7.6541c-2.67493-.7167-4.84339.9472-4.84339 3.7165v15.0427c0 2.7693 2.16846 5.5953 4.84339 6.3121l14.53021 3.8933c2.6749.7168 4.8433-.9472 4.8433-3.7164v-15.0428c0-2.7693-2.1684-5.5953-4.8433-6.312z" fill="#444ce7"/></g></svg>';

-- AlterTable
ALTER TABLE "PortalMatterAccess" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "policyRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PortalShare" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "grantVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "policyRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PracticeArea" ADD COLUMN     "consultationFeeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "consultationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PortalDiscoveryPolicy" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT '',
    "statuses" JSONB,
    "admission" TEXT NOT NULL DEFAULT '',
    "reasonDigest" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalDiscoveryPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalGrantIntent" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "portalAccount" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "grant" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "intentDigest" TEXT NOT NULL DEFAULT '',
    "operation" TEXT NOT NULL DEFAULT '',
    "policyRevision" INTEGER NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalGrantIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalDiscoveryPolicy_firm_idx" ON "PortalDiscoveryPolicy"("firm");

-- CreateIndex
CREATE INDEX "PortalDiscoveryPolicy_recordedBy_idx" ON "PortalDiscoveryPolicy"("recordedBy");

-- CreateIndex
CREATE UNIQUE INDEX "PortalDiscoveryPolicy_firm_revision_key" ON "PortalDiscoveryPolicy"("firm", "revision");

-- CreateIndex
CREATE INDEX "PortalGrantIntent_firm_idx" ON "PortalGrantIntent"("firm");

-- CreateIndex
CREATE INDEX "PortalGrantIntent_actor_idx" ON "PortalGrantIntent"("actor");

-- CreateIndex
CREATE INDEX "PortalGrantIntent_matter_idx" ON "PortalGrantIntent"("matter");

-- CreateIndex
CREATE INDEX "PortalGrantIntent_portalAccount_idx" ON "PortalGrantIntent"("portalAccount");

-- CreateIndex
CREATE INDEX "PortalGrantIntent_contact_idx" ON "PortalGrantIntent"("contact");

-- CreateIndex
CREATE INDEX "PortalGrantIntent_grant_idx" ON "PortalGrantIntent"("grant");

-- CreateIndex
CREATE UNIQUE INDEX "PortalGrantIntent_firm_actor_idempotencyKey_key" ON "PortalGrantIntent"("firm", "actor", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Consultation_account_idx" ON "Consultation"("account");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_firm_requestKey_key" ON "Consultation"("firm", "requestKey");

-- CreateIndex
CREATE INDEX "PortalMatterAccess_contact_idx" ON "PortalMatterAccess"("contact");

-- CreateIndex
CREATE INDEX "PortalShare_contact_idx" ON "PortalShare"("contact");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_account_fkey" FOREIGN KEY ("account") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMatterAccess" ADD CONSTRAINT "PortalMatterAccess_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalShare" ADD CONSTRAINT "PortalShare_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDiscoveryPolicy" ADD CONSTRAINT "PortalDiscoveryPolicy_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDiscoveryPolicy" ADD CONSTRAINT "PortalDiscoveryPolicy_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalGrantIntent" ADD CONSTRAINT "PortalGrantIntent_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalGrantIntent" ADD CONSTRAINT "PortalGrantIntent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalGrantIntent" ADD CONSTRAINT "PortalGrantIntent_matter_fkey" FOREIGN KEY ("matter") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalGrantIntent" ADD CONSTRAINT "PortalGrantIntent_portalAccount_fkey" FOREIGN KEY ("portalAccount") REFERENCES "PortalAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalGrantIntent" ADD CONSTRAINT "PortalGrantIntent_contact_fkey" FOREIGN KEY ("contact") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalGrantIntent" ADD CONSTRAINT "PortalGrantIntent_grant_fkey" FOREIGN KEY ("grant") REFERENCES "PortalMatterAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ordinary local invariants; neither synthetic fixtures nor operators may skip them.
ALTER TABLE "PracticeArea" ADD CONSTRAINT "PracticeArea_consultation_bounds" CHECK ("consultationFeeMinor" >= 0 AND "consultationMinutes" BETWEEN 15 AND 120);
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_owned_snapshot" CHECK (
  "feeMinor" >= 0 AND ("account" IS NULL OR (
    "requestKey" IS NOT NULL AND length("requestDigest") = 64 AND "serviceSnapshot" IS NOT NULL
    AND length("serviceTitle") > 0 AND "startsAt" IS NOT NULL AND "endsAt" > "startsAt"
  ))
);
CREATE FUNCTION law_consultation_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."account" IS NOT NULL AND ROW(NEW."account", NEW."firm", NEW."intake", NEW."requestKey", NEW."requestDigest", NEW."serviceTitle", NEW."serviceSnapshot", NEW."feeMinor", NEW."currencyCode", NEW."startsAt", NEW."endsAt", NEW."host") IS DISTINCT FROM ROW(OLD."account", OLD."firm", OLD."intake", OLD."requestKey", OLD."requestDigest", OLD."serviceTitle", OLD."serviceSnapshot", OLD."feeMinor", OLD."currencyCode", OLD."startsAt", OLD."endsAt", OLD."host") THEN
    RAISE EXCEPTION 'Accepted consultation identity and snapshot are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER law_consultation_snapshot_immutable BEFORE UPDATE ON "Consultation" FOR EACH ROW EXECUTE FUNCTION law_consultation_snapshot_immutable();

