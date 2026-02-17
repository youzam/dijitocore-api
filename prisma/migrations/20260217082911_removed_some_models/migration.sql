-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "featuresSnapshot" JSONB,
ADD COLUMN     "limitsSnapshot" JSONB;

-- CreateTable
CREATE TABLE "SubscriptionUsage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionUsage_businessId_idx" ON "SubscriptionUsage"("businessId");

-- CreateIndex
CREATE INDEX "SubscriptionUsage_metric_idx" ON "SubscriptionUsage"("metric");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionUsage_businessId_metric_period_key" ON "SubscriptionUsage"("businessId", "metric", "period");

-- AddForeignKey
ALTER TABLE "SubscriptionUsage" ADD CONSTRAINT "SubscriptionUsage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
