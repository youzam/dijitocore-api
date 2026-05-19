/*
  Warnings:

  - You are about to drop the column `attachments` on the `InstallmentPayment` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ScheduleStatus" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "InstallmentPayment" DROP COLUMN "attachments",
ADD COLUMN     "attachment" TEXT,
ALTER COLUMN "source" SET DEFAULT 'POS';

-- AlterTable
ALTER TABLE "InstallmentSchedule" ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0;
