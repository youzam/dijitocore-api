-- AlterTable
ALTER TABLE "SystemJobLog" ADD COLUMN     "lastRetriedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApiMetric" (
    "id" SERIAL NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "successRequests" INTEGER NOT NULL,
    "failedRequests" INTEGER NOT NULL,
    "avgResponseTime" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiMetric_pkey" PRIMARY KEY ("id")
);
