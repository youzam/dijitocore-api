const prisma = require("../config/prisma");

/**
 * Central place for resolving current usage per limit
 */
const limitResolvers = {
  maxUsers: async (businessId) => {
    return prisma.user.count({
      where: { businessId },
    });
  },

  maxActiveContracts: async (businessId) => {
    return prisma.contract.count({
      where: {
        businessId,
        status: "ACTIVE",
      },
    });
  },

  maxApprovalRequests: async (businessId) => {
    return prisma.approvalRequest.count({
      where: { businessId },
    });
  },

  maxMonthlySms: async (businessId) => {
    return prisma.smsLog.count({
      where: { businessId },
    });
  },
};

exports.getResolver = (limitKey) => {
  return limitResolvers[limitKey];
};
