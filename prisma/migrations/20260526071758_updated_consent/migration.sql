/*
  Warnings:

  - Added the required column `actorType` to the `ConsentLog` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `ConsentLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `ConsentLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ConsentActorType" AS ENUM ('USER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_AND_PRIVACY', 'MARKETING', 'DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LegalPolicyType" AS ENUM ('TERMS', 'PRIVACY');

-- AlterTable
ALTER TABLE "ConsentLog" ADD COLUMN     "actorType" "ConsentActorType" NOT NULL,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "privacyVersion" TEXT,
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "userAgent" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "ConsentType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ConsentStatus" NOT NULL;

-- CreateTable
CREATE TABLE "LegalPolicyDocument" (
    "id" TEXT NOT NULL,
    "type" "LegalPolicyType" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalPolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalPolicyDocument_type_idx" ON "LegalPolicyDocument"("type");

-- CreateIndex
CREATE INDEX "LegalPolicyDocument_isActive_idx" ON "LegalPolicyDocument"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LegalPolicyDocument_type_version_key" ON "LegalPolicyDocument"("type", "version");

-- CreateIndex
CREATE INDEX "ConsentLog_actorType_idx" ON "ConsentLog"("actorType");

-- CreateIndex
CREATE INDEX "ConsentLog_customerId_idx" ON "ConsentLog"("customerId");

-- CreateIndex
CREATE INDEX "ConsentLog_type_idx" ON "ConsentLog"("type");

-- CreateIndex
CREATE INDEX "ConsentLog_status_idx" ON "ConsentLog"("status");

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
