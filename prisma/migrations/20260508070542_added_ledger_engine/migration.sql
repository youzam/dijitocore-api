-- CreateEnum
CREATE TYPE "LedgerScopeType" AS ENUM ('SYSTEM', 'TENANT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerReferenceType" AS ENUM ('SUBSCRIPTION_PAYMENT', 'SETUP_FEE', 'SUBSCRIPTION_RENEWAL', 'SYSTEM_ADJUSTMENT', 'SYSTEM_REFUND', 'CUSTOMER_INSTALLMENT_PAYMENT', 'CUSTOMER_WAIVER', 'CUSTOMER_REFUND');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('SYSTEM_CASH', 'SYSTEM_REVENUE', 'SYSTEM_REFUND', 'SYSTEM_ADJUSTMENT', 'TENANT_CASH', 'TENANT_RECEIVABLE', 'TENANT_WAIVER');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "scopeType" "LedgerScopeType" NOT NULL,
    "businessId" TEXT,
    "referenceId" TEXT NOT NULL,
    "referenceType" "LedgerReferenceType" NOT NULL,
    "transactionType" TEXT,
    "accountType" "LedgerAccountType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'POSTED',
    "gateway" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "subscriptionAmount" DECIMAL(18,2),
    "setupFeeAmount" DECIMAL(18,2),
    "subscriptionId" TEXT,
    "packageId" TEXT,
    "businessNameSnapshot" TEXT,
    "packageNameSnapshot" TEXT,
    "countrySnapshot" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_scopeType_idx" ON "ledger_entries"("scopeType");

-- CreateIndex
CREATE INDEX "ledger_entries_businessId_idx" ON "ledger_entries"("businessId");

-- CreateIndex
CREATE INDEX "ledger_entries_referenceId_idx" ON "ledger_entries"("referenceId");

-- CreateIndex
CREATE INDEX "ledger_entries_referenceType_idx" ON "ledger_entries"("referenceType");

-- CreateIndex
CREATE INDEX "ledger_entries_accountType_idx" ON "ledger_entries"("accountType");

-- CreateIndex
CREATE INDEX "ledger_entries_status_idx" ON "ledger_entries"("status");

-- CreateIndex
CREATE INDEX "ledger_entries_subscriptionId_idx" ON "ledger_entries"("subscriptionId");

-- CreateIndex
CREATE INDEX "ledger_entries_packageId_idx" ON "ledger_entries"("packageId");

-- CreateIndex
CREATE INDEX "ledger_entries_createdAt_idx" ON "ledger_entries"("createdAt");
