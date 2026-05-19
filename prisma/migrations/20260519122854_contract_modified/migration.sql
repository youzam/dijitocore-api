-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "restoredBy" TEXT,
ADD COLUMN     "terminationExpiresAt" TIMESTAMP(3);
