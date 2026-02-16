const prisma = require("../config/prisma");

/**
 * Append-only audit logger
 */
exports.logAudit = async ({
  tx,
  businessId,
  userId = null,
  entityType = null,
  entityId = null,
  action,
  metadata = {},
}) => {
  try {
    if (!businessId || !action) {
      return; // prevent invalid logs
    }

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
