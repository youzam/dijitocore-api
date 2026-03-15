/*
  Warnings:

  - You are about to drop the column `externalTransactionId` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `gatewayPayloadHash` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - Added the required column `country` to the `Business` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `SubscriptionPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `SubscriptionPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SubscriptionPayment` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `SubscriptionPayment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_businessId_fkey";

-- DropIndex
DROP INDEX "SubscriptionPayment_businessId_idx";

-- DropIndex
DROP INDEX "SubscriptionPayment_createdAt_idx";

-- DropIndex
DROP INDEX "SubscriptionPayment_externalTransactionId_key";

-- DropIndex
DROP INDEX "SubscriptionPayment_status_idx";

-- DropIndex
DROP INDEX "SubscriptionPayment_subscriptionId_idx";

-- DropIndex
DROP INDEX "SubscriptionPayment_subscriptionId_status_idx";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "isTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialEndedAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubscriptionPayment" DROP COLUMN "externalTransactionId",
DROP COLUMN "gatewayPayloadHash",
DROP COLUMN "method",
DROP COLUMN "reference",
ADD COLUMN     "adminOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "gateway" TEXT,
ADD COLUMN     "gatewayPayload" JSONB,
ADD COLUMN     "invoiceUrl" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "webhookStatus" TEXT,
ALTER COLUMN "businessId" DROP NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30),
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "oldPackageId" TEXT,
    "newPackageId" TEXT,
    "oldPrice" INTEGER,
    "newPrice" INTEGER,
    "changeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAdjustment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "maxUsage" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponUsage" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_idx" ON "SubscriptionHistory"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_businessId_idx" ON "SubscriptionHistory"("businessId");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_changeType_idx" ON "SubscriptionHistory"("changeType");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Business_country_idx" ON "Business"("country");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
