const prisma = require("../config/prisma");

/*
|--------------------------------------------------------------------------
| Start Impersonation
|--------------------------------------------------------------------------
*/

exports.startImpersonation = async ({ adminId, targetUserId, req }) => {
  return prisma.adminImpersonation.create({
    data: {
      adminId,
      targetUserId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
  });
};

/*
|--------------------------------------------------------------------------
| Stop Impersonation
|--------------------------------------------------------------------------
*/

exports.stopImpersonation = async (id) => {
  return prisma.adminImpersonation.update({
    where: { id },
    data: {
      endedAt: new Date(),
    },
  });
};
