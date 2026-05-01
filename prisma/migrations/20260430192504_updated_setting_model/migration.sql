/*
  Warnings:

  - You are about to drop the column `activePaymentGateway` on the `SystemSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "activePaymentGateway",
ADD COLUMN     "activePaymentGateways" TEXT[] DEFAULT ARRAY['SELCOM']::TEXT[];
