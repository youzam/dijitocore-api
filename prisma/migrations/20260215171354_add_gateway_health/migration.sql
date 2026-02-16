/*
  Warnings:

  - You are about to drop the column `trialDays` on the `SystemSetting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[externalTransactionId]` on the table `SubscriptionPayment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billingCycle` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceMonthlySnapshot` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `setupFeeSnapshot` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GatewayStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL,
ADD COLUMN     "priceMonthlySnapshot" INTEGER NOT NULL,
ADD COLUMN     "priceYearlySnapshot" INTEGER,
ADD COLUMN     "setupFeeSnapshot" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN     "externalTransactionId" TEXT,
ADD COLUMN     "gatewayPayloadHash" TEXT;

-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "trialDays";

-- CreateTable
CREATE TABLE "GatewayHealth" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "GatewayStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheck" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayHealth_code_key" ON "GatewayHealth"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_externalTransactionId_key" ON "SubscriptionPayment"("externalTransactionId");
