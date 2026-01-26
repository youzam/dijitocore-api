/*
  Warnings:

  - You are about to drop the column `key` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `SystemSetting` table. All the data in the column will be lost.
  - Added the required column `currency` to the `SystemSetting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trialDays` to the `SystemSetting` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SystemSetting_key_key";

-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "key",
DROP COLUMN "value",
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "isBootstrapped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialDays" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
