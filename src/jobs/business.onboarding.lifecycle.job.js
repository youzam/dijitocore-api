const prisma = require('../config/prisma');

const notificationService = require('../services/notifications/notification.service');
const { logAudit } = require('../utils/audit.helper');

const DAY = 24 * 60 * 60 * 1000;

const run = async () => {
  const now = Date.now();

  const businesses = await prisma.business.findMany({
    where: {
      status: 'PENDING',
      setupCompleted: false,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  for (const business of businesses) {
    const ageInDays = Math.floor(
      (now - new Date(business.createdAt).getTime()) / DAY,
    );

    if (ageInDays === 9) {
      await notificationService.sendOnboardingNotice({
        email: business.email,
        businessName: business.name,
        stage: 'FIRST_WARNING',
      });
    }

    if (ageInDays === 16) {
      await notificationService.sendOnboardingNotice({
        email: business.email,
        businessName: business.name,
        stage: 'SECOND_WARNING',
      });
    }

    if (ageInDays === 23) {
      await notificationService.sendOnboardingNotice({
        email: business.email,
        businessName: business.name,
        stage: 'FINAL_WARNING',
      });
    }

    if (ageInDays >= 30) {
      await prisma.business.update({
        where: {
          id: business.id,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          status: 'INACTIVE',
        },
      });

      await logAudit({
        businessId: business.id,
        entityType: 'BUSINESS',
        entityId: business.id,
        action: 'BUSINESS_ONBOARDING_AUTO_CLEANUP',
        actorType: 'ADMIN',
        module: 'BUSINESS',
      });
    }
  }
};

module.exports = {
  run,
};
