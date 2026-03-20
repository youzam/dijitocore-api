const prisma = require("../config/prisma");

const limitHandlers = {
  maxUsers: async (req) => {
    return prisma.user.count({
      where: { businessId: req.user.businessId },
    });
  },

  maxActiveContracts: async (req) => {
    return prisma.contract.count({
      where: {
        businessId: req.user.businessId,
        status: "ACTIVE",
      },
    });
  },

  maxMonthlySms: async (req) => {
    // unaweza adjust based on schema yako ya SMS logs
    return prisma.notification.count({
      where: {
        businessId: req.user.businessId,
        channel: "SMS",
      },
    });
  },
};

exports.getLimitHandler = (key) => limitHandlers[key];
