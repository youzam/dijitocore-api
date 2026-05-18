/*
  Warnings:

  - The values [TRIAL] on the enum `SubscriptionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `convertedAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `isTrial` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialEndedAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialStartedAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialDays` on the `SubscriptionPackage` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "public"."SubscriptionStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "convertedAt",
DROP COLUMN "isTrial",
DROP COLUMN "trialEndedAt",
DROP COLUMN "trialStartedAt";

-- AlterTable
ALTER TABLE "SubscriptionPackage" DROP COLUMN "trialDays";
