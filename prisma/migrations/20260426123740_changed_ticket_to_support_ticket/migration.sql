/*
  Warnings:

  - You are about to drop the column `currency` on the `SystemSetting` table. All the data in the column will be lost.
  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketActorType" AS ENUM ('TENANT', 'ADMIN');

-- AlterTable
ALTER TABLE "SystemSetting" DROP COLUMN "currency";

-- DropTable
DROP TABLE "Ticket";

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdByType" "TicketActorType" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "assignedAdminId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "slaDeadline" TIMESTAMP(3),
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_businessId_idx" ON "SupportTicket"("businessId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdByType_idx" ON "SupportTicket"("createdByType");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedAdminId_idx" ON "SupportTicket"("assignedAdminId");
