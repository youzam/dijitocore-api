/*
  Warnings:

  - You are about to drop the column `requestedById` on the `DataRequest` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "DataRequest" DROP CONSTRAINT "DataRequest_requestedById_fkey";

-- DropIndex
DROP INDEX "DataRequest_targetType_targetId_idx";

-- DropIndex
DROP INDEX "DataRequest_type_status_idx";

-- AlterTable
ALTER TABLE "DataRequest" DROP COLUMN "requestedById",
ADD COLUMN     "requestedByAdminId" TEXT,
ADD COLUMN     "requestedByCustomerId" TEXT,
ADD COLUMN     "requestedByUserId" TEXT;

-- CreateTable
CREATE TABLE "DataExportStorage" (
    "id" TEXT NOT NULL,
    "dataRequestId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExportStorage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_requestedByAdminId_fkey" FOREIGN KEY ("requestedByAdminId") REFERENCES "SystemAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_requestedByCustomerId_fkey" FOREIGN KEY ("requestedByCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
