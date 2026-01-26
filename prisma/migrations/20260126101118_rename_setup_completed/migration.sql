/*
  Warnings:

  - You are about to drop the column `isProfileComplete` on the `Business` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Business" DROP COLUMN "isProfileComplete",
ADD COLUMN     "setupCompleted" BOOLEAN NOT NULL DEFAULT false;
