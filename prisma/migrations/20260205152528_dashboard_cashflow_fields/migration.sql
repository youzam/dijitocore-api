/*
  Warnings:

  - Added the required column `cashflow30` to the `DashboardSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cashflow60` to the `DashboardSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cashflow90` to the `DashboardSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DashboardSnapshot" ADD COLUMN     "cashflow30" INTEGER NOT NULL,
ADD COLUMN     "cashflow60" INTEGER NOT NULL,
ADD COLUMN     "cashflow90" INTEGER NOT NULL;
