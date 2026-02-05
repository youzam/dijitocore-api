/*
  Warnings:

  - You are about to drop the column `date` on the `DashboardSnapshot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[businessId,snapshotDate]` on the table `DashboardSnapshot` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `snapshotDate` to the `DashboardSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DashboardSnapshot_businessId_date_idx";

-- AlterTable
ALTER TABLE "DashboardSnapshot" DROP COLUMN "date",
ADD COLUMN     "snapshotDate" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "DashboardStaffMetric" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "collected" INTEGER NOT NULL,
    "overdue" INTEGER NOT NULL,
    "efficiency" DOUBLE PRECISION NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardStaffMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardAssetMetric" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "soldCount" INTEGER NOT NULL,
    "totalValue" INTEGER NOT NULL,
    "overdue" INTEGER NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardAssetMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardHealth" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "collectionRate" DOUBLE PRECISION NOT NULL,
    "overdueRatio" DOUBLE PRECISION NOT NULL,
    "churnRate" DOUBLE PRECISION NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardStaffMetric_businessId_idx" ON "DashboardStaffMetric"("businessId");

-- CreateIndex
CREATE INDEX "DashboardStaffMetric_staffId_idx" ON "DashboardStaffMetric"("staffId");

-- CreateIndex
CREATE INDEX "DashboardAssetMetric_businessId_idx" ON "DashboardAssetMetric"("businessId");

-- CreateIndex
CREATE INDEX "DashboardAssetMetric_assetId_idx" ON "DashboardAssetMetric"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardHealth_businessId_snapshotDate_key" ON "DashboardHealth"("businessId", "snapshotDate");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_businessId_idx" ON "DashboardSnapshot"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardSnapshot_businessId_snapshotDate_key" ON "DashboardSnapshot"("businessId", "snapshotDate");
