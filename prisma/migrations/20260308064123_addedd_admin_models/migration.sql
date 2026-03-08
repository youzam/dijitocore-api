-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'FINANCE_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'SECURITY_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'SUPPORT_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'OPERATIONS_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'READ_ONLY_AUDITOR';
