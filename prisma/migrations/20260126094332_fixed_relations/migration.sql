/*
  Warnings:

  - The values [TRIAL] on the enum `BusinessStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BusinessStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'GRACE', 'SUSPENDED', 'TERMINATED');
ALTER TABLE "public"."Business" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Business" ALTER COLUMN "status" TYPE "BusinessStatus_new" USING ("status"::text::"BusinessStatus_new");
ALTER TYPE "BusinessStatus" RENAME TO "BusinessStatus_old";
ALTER TYPE "BusinessStatus_new" RENAME TO "BusinessStatus";
DROP TYPE "public"."BusinessStatus_old";
ALTER TABLE "Business" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "Business_email_key";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_businessId_key" ON "BusinessSettings"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
