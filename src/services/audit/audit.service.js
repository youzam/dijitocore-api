const prisma = require("../../config/prisma");

exports.logAction = async ({
  action,
  businessId,
  userId,
  customerId,
  metadata,
}) => {
  await prisma.auditLog.create({
    data: {
      action,
      businessId,
      userId,
      customerId,
      metadata,
    },
  });
};
