-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_couponId_fkey";

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "couponId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubscriptionPackage" ADD COLUMN     "configVersion" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
