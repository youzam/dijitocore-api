-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('SIGNUP_STARTED', 'EMAIL_VERIFIED', 'BUSINESS_CREATED', 'CHECKOUT_STARTED', 'CHECKOUT_COMPLETED');

-- CreateTable
CREATE TABLE "UserOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "billingCycle" "BillingCycle",
    "step" "OnboardingStep" NOT NULL DEFAULT 'SIGNUP_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOnboarding_userId_key" ON "UserOnboarding"("userId");

-- CreateIndex
CREATE INDEX "UserOnboarding_userId_idx" ON "UserOnboarding"("userId");

-- CreateIndex
CREATE INDEX "UserOnboarding_packageId_idx" ON "UserOnboarding"("packageId");

-- CreateIndex
CREATE INDEX "UserOnboarding_step_idx" ON "UserOnboarding"("step");

-- AddForeignKey
ALTER TABLE "UserOnboarding" ADD CONSTRAINT "UserOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnboarding" ADD CONSTRAINT "UserOnboarding_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SubscriptionPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
