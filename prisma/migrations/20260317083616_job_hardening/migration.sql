-- CreateTable
CREATE TABLE "DeadJob" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadJob_pkey" PRIMARY KEY ("id")
);
