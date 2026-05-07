/*
  Warnings:

  - You are about to drop the column `action` on the `Permission` table. All the data in the column will be lost.
  - You are about to drop the column `module` on the `Permission` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `Permission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Permission` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Permission_module_action_scope_key";

-- AlterTable
ALTER TABLE "Permission" DROP COLUMN "action",
DROP COLUMN "module",
DROP COLUMN "scope",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_name_idx" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");
