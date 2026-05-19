/*
  Warnings:

  - You are about to drop the column `altPhone` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "amendmentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAmendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "altPhone",
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "contract_amendments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_amendments_businessId_idx" ON "contract_amendments"("businessId");

-- CreateIndex
CREATE INDEX "contract_amendments_contractId_idx" ON "contract_amendments"("contractId");

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
