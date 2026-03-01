-- CreateTable
CREATE TABLE "JobLock" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobLock_jobName_key" ON "JobLock"("jobName");

-- CreateIndex
CREATE INDEX "JobLock_lockedUntil_idx" ON "JobLock"("lockedUntil");
