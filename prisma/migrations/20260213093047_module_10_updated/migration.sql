-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "SystemJobLog" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemErrorGroup" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "occurrence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SystemErrorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemError" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "stack" TEXT,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemHealthSnapshot" (
    "id" TEXT NOT NULL,
    "dbStatus" TEXT NOT NULL,
    "lastJobRunAt" TIMESTAMP(3),
    "failedJobsCount" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportIncident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemJobLog_jobName_idx" ON "SystemJobLog"("jobName");

-- CreateIndex
CREATE INDEX "SystemJobLog_status_idx" ON "SystemJobLog"("status");

-- CreateIndex
CREATE INDEX "SystemJobLog_createdAt_idx" ON "SystemJobLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemErrorGroup_signature_key" ON "SystemErrorGroup"("signature");

-- CreateIndex
CREATE INDEX "SystemError_groupId_idx" ON "SystemError"("groupId");

-- CreateIndex
CREATE INDEX "SystemError_createdAt_idx" ON "SystemError"("createdAt");

-- CreateIndex
CREATE INDEX "SystemHealthSnapshot_createdAt_idx" ON "SystemHealthSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "SupportIncident_status_idx" ON "SupportIncident"("status");

-- CreateIndex
CREATE INDEX "SupportIncident_severity_idx" ON "SupportIncident"("severity");

-- CreateIndex
CREATE INDEX "SupportIncident_createdAt_idx" ON "SupportIncident"("createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_businessId_idx" ON "ApprovalRequest"("businessId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityType_idx" ON "ApprovalRequest"("entityType");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityId_idx" ON "ApprovalRequest"("entityId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_idx" ON "AuditLog"("businessId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SystemError" ADD CONSTRAINT "SystemError_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SystemErrorGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
