/*
  Warnings:

  - The values [SUSPENDED] on the enum `CustomerStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CustomerStatus_new" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "Customer" ALTER COLUMN "status" TYPE "CustomerStatus_new" USING ("status"::text::"CustomerStatus_new");
ALTER TYPE "CustomerStatus" RENAME TO "CustomerStatus_old";
ALTER TYPE "CustomerStatus_new" RENAME TO "CustomerStatus";
DROP TYPE "public"."CustomerStatus_old";
COMMIT;
