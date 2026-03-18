/*
  Warnings:

  - You are about to drop the `SuperAdmin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdminSession" DROP CONSTRAINT "AdminSession_adminId_fkey";

-- DropForeignKey
ALTER TABLE "DataRequest" DROP CONSTRAINT "DataRequest_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "DataRequest" DROP CONSTRAINT "DataRequest_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "DataRetentionPolicy" DROP CONSTRAINT "DataRetentionPolicy_createdById_fkey";

-- DropForeignKey
ALTER TABLE "PolicyVersion" DROP CONSTRAINT "PolicyVersion_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ReportExport" DROP CONSTRAINT "ReportExport_requestedBy_fkey";

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "systemAdminRoleId" TEXT;

-- DropTable
DROP TABLE "SuperAdmin";

-- CreateTable
CREATE TABLE "SystemAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "AdminStatus" NOT NULL,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SystemAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAdminRole" (
    "id" TEXT NOT NULL,
    "name" "AdminRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemAdmin_email_key" ON "SystemAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SystemAdminRole_name_key" ON "SystemAdminRole"("name");

-- AddForeignKey
ALTER TABLE "SystemAdmin" ADD CONSTRAINT "SystemAdmin_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "SystemAdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "SystemAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_systemAdminRoleId_fkey" FOREIGN KEY ("systemAdminRoleId") REFERENCES "SystemAdminRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "SystemAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "SystemAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "SystemAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "SystemAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "SystemAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
