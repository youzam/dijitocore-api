const prisma = require('../config/prisma');
const { logAudit } = require('../utils/audit.helper');

const run = async () => {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const subscription = await prisma.subscription.updateMany({
    where: {
      status: 'PENDING',
      deletedAt: null,
      createdAt: {
        lt: cutoffDate,
      },
      subscriptionPayments: {
        none: {
          status: 'CONFIRMED',
        },
      },
    },
    data: {
      deletedAt: new Date(),
    },
  });

  await logAudit({
    businessId: subscription.businessId,
    entityType: 'SUBSCRIPTION',
    entityId: subscription.id,
    action: 'STALE_PENDING_SUBSCRIPTION_CLEANED',
    actorType: 'ADMIN',
    module: 'SUBSCRIPTION',
  });
};

module.exports = {
  run,
};
