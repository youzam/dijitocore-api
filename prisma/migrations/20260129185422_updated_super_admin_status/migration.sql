/*
  Warnings:

  - You are about to drop the column `isActive` on the `SuperAdmin` table. All the data in the column will be lost.
  - Added the required column `status` to the `SuperAdmin` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "SuperAdmin" DROP COLUMN "isActive",
ADD COLUMN     "status" "AdminStatus" NOT NULL;
