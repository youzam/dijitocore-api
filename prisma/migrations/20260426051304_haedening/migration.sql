/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the column `deletedBy` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `SystemSetting` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FraudFlagStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "FraudEntityType" AS ENUM ('USER', 'ADMIN', 'CUSTOMER', 'SUBSCRIPTION_PAYMENT');

-- AlterEnum
ALTER TYPE "CustomerStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "deletedAt",
DROP COLUMN "deletedBy",
DROP COLUMN "isDeleted",
ADD COLUMN     "featureFlags" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FraudFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "adminId" TEXT,
    "customerId" TEXT,
    "subscriptionPaymentId" TEXT,
    "entityType" "FraudEntityType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FraudFlagStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FraudFlag_userId_idx" ON "FraudFlag"("userId");

-- CreateIndex
CREATE INDEX "FraudFlag_adminId_idx" ON "FraudFlag"("adminId");

-- CreateIndex
CREATE INDEX "FraudFlag_customerId_idx" ON "FraudFlag"("customerId");

-- CreateIndex
CREATE INDEX "FraudFlag_subscriptionPaymentId_idx" ON "FraudFlag"("subscriptionPaymentId");

-- AddForeignKey
ALTER TABLE "FraudFlag" ADD CONSTRAINT "FraudFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudFlag" ADD CONSTRAINT "FraudFlag_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "SystemAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudFlag" ADD CONSTRAINT "FraudFlag_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudFlag" ADD CONSTRAINT "FraudFlag_subscriptionPaymentId_fkey" FOREIGN KEY ("subscriptionPaymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
