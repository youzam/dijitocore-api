const prisma = require("../config/prisma");

exports.logAudit = async ({
  tx,
  businessId,
  userId,
  entityType,
  entityId,
  action,
  metadata = {},
}) => {
  try {
    await (tx || prisma).auditLog.create({
      data: {
        businessId,
        userId,
        entityType,
        entityId,
        action,
        metadata,
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};
