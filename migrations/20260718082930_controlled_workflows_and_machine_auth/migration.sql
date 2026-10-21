/*
  Warnings:

  - A unique constraint covering the columns `[firm,idempotencyKey]` on the table `PaymentAllocation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reversesAllocation]` on the table `PaymentAllocation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering non-empty `[inviteTokenDigest]` values on `PortalAccount` will be added after legacy empty sentinels are normalized to NULL. Duplicate issued digests will fail.
  - A unique constraint covering the columns `[firm,email]` on the table `PortalAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ApiKeyStatusType" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "OAuthClientStatusType" AS ENUM ('active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "OAuthConsentStatusType" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "OAuthTokenTokenTypeType" AS ENUM ('authorization_code', 'access_token', 'refresh_token');

-- CreateEnum
CREATE TYPE "OAuthTokenStatusType" AS ENUM ('pending', 'active', 'consumed', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "OAuthTokenCodeChallengeMethodType" AS ENUM ('S256');

-- CreateEnum
CREATE TYPE "PortalSessionStatusType" AS ENUM ('active', 'revoked', 'expired');

-- AlterTable
ALTER TABLE "PaymentAllocation" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "PortalAccount" ADD COLUMN     "inviteTokenPrefix" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "inviteTokenDigest" DROP NOT NULL,
ALTER COLUMN "inviteTokenDigest" DROP DEFAULT;

-- Empty strings were the legacy no-invitation sentinel. Normalize them before
-- adding the sparse unique index so only issued invitation digests participate.
UPDATE "PortalAccount" SET "inviteTokenDigest" = NULL WHERE "inviteTokenDigest" = '';

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageMachineCredentials" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadMachineCredentials" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "prefix" TEXT NOT NULL DEFAULT '',
    "secretDigest" TEXT NOT NULL DEFAULT '',
    "status" "ApiKeyStatusType" NOT NULL DEFAULT 'active',
    "scopes" JSONB DEFAULT '[]',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecretDigest" TEXT NOT NULL DEFAULT '',
    "status" "OAuthClientStatusType" NOT NULL DEFAULT 'active',
    "isConfidential" BOOLEAN NOT NULL DEFAULT true,
    "redirectUris" JSONB DEFAULT '[]',
    "allowedScopes" JSONB DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConsent" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "status" "OAuthConsentStatusType" NOT NULL DEFAULT 'active',
    "scopes" JSONB DEFAULT '[]',
    "consentDigest" TEXT NOT NULL DEFAULT '',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "consent" TEXT,
    "tokenType" "OAuthTokenTokenTypeType" NOT NULL,
    "tokenDigest" TEXT NOT NULL DEFAULT '',
    "tokenPrefix" TEXT NOT NULL DEFAULT '',
    "familyId" TEXT NOT NULL DEFAULT '',
    "status" "OAuthTokenStatusType" NOT NULL DEFAULT 'active',
    "scopes" JSONB DEFAULT '[]',
    "redirectUri" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "codeChallenge" TEXT NOT NULL DEFAULT '',
    "codeChallengeMethod" "OAuthTokenCodeChallengeMethodType",
    "parentToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "portalAccount" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL DEFAULT '',
    "tokenPrefix" TEXT NOT NULL DEFAULT '',
    "status" "PortalSessionStatusType" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_firm_idx" ON "ApiKey"("firm");

-- CreateIndex
CREATE INDEX "ApiKey_owner_idx" ON "ApiKey"("owner");

-- CreateIndex
CREATE INDEX "ApiKey_createdBy_idx" ON "ApiKey"("createdBy");

-- CreateIndex
CREATE INDEX "ApiKey_revokedBy_idx" ON "ApiKey"("revokedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_firm_name_key" ON "ApiKey"("firm", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClient_firm_idx" ON "OAuthClient"("firm");

-- CreateIndex
CREATE INDEX "OAuthClient_owner_idx" ON "OAuthClient"("owner");

-- CreateIndex
CREATE INDEX "OAuthClient_createdBy_idx" ON "OAuthClient"("createdBy");

-- CreateIndex
CREATE INDEX "OAuthClient_revokedBy_idx" ON "OAuthClient"("revokedBy");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_firm_name_key" ON "OAuthClient"("firm", "name");

-- CreateIndex
CREATE INDEX "OAuthConsent_firm_idx" ON "OAuthConsent"("firm");

-- CreateIndex
CREATE INDEX "OAuthConsent_client_idx" ON "OAuthConsent"("client");

-- CreateIndex
CREATE INDEX "OAuthConsent_user_idx" ON "OAuthConsent"("user");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConsent_client_user_firm_key" ON "OAuthConsent"("client", "user", "firm");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_tokenDigest_key" ON "OAuthToken"("tokenDigest");

-- CreateIndex
CREATE INDEX "OAuthToken_firm_idx" ON "OAuthToken"("firm");

-- CreateIndex
CREATE INDEX "OAuthToken_client_idx" ON "OAuthToken"("client");

-- CreateIndex
CREATE INDEX "OAuthToken_user_idx" ON "OAuthToken"("user");

-- CreateIndex
CREATE INDEX "OAuthToken_consent_idx" ON "OAuthToken"("consent");

-- CreateIndex
CREATE INDEX "OAuthToken_tokenPrefix_idx" ON "OAuthToken"("tokenPrefix");

-- CreateIndex
CREATE INDEX "OAuthToken_familyId_idx" ON "OAuthToken"("familyId");

-- CreateIndex
CREATE INDEX "OAuthToken_parentToken_idx" ON "OAuthToken"("parentToken");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_tokenDigest_key" ON "PortalSession"("tokenDigest");

-- CreateIndex
CREATE INDEX "PortalSession_firm_idx" ON "PortalSession"("firm");

-- CreateIndex
CREATE INDEX "PortalSession_portalAccount_idx" ON "PortalSession"("portalAccount");

-- CreateIndex
CREATE INDEX "PortalSession_tokenPrefix_idx" ON "PortalSession"("tokenPrefix");

-- CreateIndex
CREATE INDEX "PaymentAllocation_idempotencyKey_idx" ON "PaymentAllocation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_firm_idempotencyKey_key" ON "PaymentAllocation"("firm", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_reversesAllocation_key" ON "PaymentAllocation"("reversesAllocation");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccount_inviteTokenDigest_key" ON "PortalAccount"("inviteTokenDigest");

-- CreateIndex
CREATE INDEX "PortalAccount_inviteTokenPrefix_idx" ON "PortalAccount"("inviteTokenPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccount_firm_email_key" ON "PortalAccount"("firm", "email");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_client_fkey" FOREIGN KEY ("client") REFERENCES "OAuthClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_client_fkey" FOREIGN KEY ("client") REFERENCES "OAuthClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_consent_fkey" FOREIGN KEY ("consent") REFERENCES "OAuthConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_parentToken_fkey" FOREIGN KEY ("parentToken") REFERENCES "OAuthToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_firm_fkey" FOREIGN KEY ("firm") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_portalAccount_fkey" FOREIGN KEY ("portalAccount") REFERENCES "PortalAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
