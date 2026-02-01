/*
  Warnings:

  - You are about to drop the column `actorId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `actorRole` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entity` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entityId` on the `AuditLog` table. All the data in the column will be lost.
  - Added the required column `fullName` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "actorId",
DROP COLUMN "actorRole",
DROP COLUMN "entity",
DROP COLUMN "entityId",
ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "activeContracts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "district" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "guarantorName" TEXT,
ADD COLUMN     "guarantorPhone" TEXT,
ADD COLUMN     "idType" TEXT,
ADD COLUMN     "idVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPaymentAt" TIMESTAMP(3),
ADD COLUMN     "monthlyIncome" INTEGER,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "relationship" TEXT,
ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "totalContracts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalOutstanding" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPaid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ward" TEXT;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
