-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "contractId" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "enableInApp" BOOLEAN NOT NULL DEFAULT true,
    "enablePush" BOOLEAN NOT NULL DEFAULT true,
    "enableSMS" BOOLEAN NOT NULL DEFAULT true,
    "enableWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "enableEmail" BOOLEAN NOT NULL DEFAULT true,
    "daysBeforeDue" INTEGER NOT NULL DEFAULT 3,
    "muteOverdue" BOOLEAN NOT NULL DEFAULT false,
    "muteReminders" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEscalationRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "daysOverdue" INTEGER NOT NULL,
    "roleToNotify" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkNotificationLimit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkNotificationLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_businessId_idx" ON "Notification"("businessId");

-- CreateIndex
CREATE INDEX "Notification_customerId_idx" ON "Notification"("customerId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSetting_businessId_userId_key" ON "NotificationSetting"("businessId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_businessId_type_locale_key" ON "NotificationTemplate"("businessId", "type", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEscalationRule_businessId_daysOverdue_key" ON "NotificationEscalationRule"("businessId", "daysOverdue");

-- CreateIndex
CREATE UNIQUE INDEX "BulkNotificationLimit_businessId_weekStart_key" ON "BulkNotificationLimit"("businessId", "weekStart");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEscalationRule" ADD CONSTRAINT "NotificationEscalationRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkNotificationLimit" ADD CONSTRAINT "BulkNotificationLimit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
