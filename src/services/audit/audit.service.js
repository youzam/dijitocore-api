const { logAudit } = require("../../utils/audit.helper");

/**
 * Centralized audit service wrapper
 * Keeps backward compatibility with existing calls
 */

exports.createAuditLog = async ({
  tx,
  businessId,
  userId = null,
  customerId = null,
  entityType = null,
  entityId = null,
  action,
  metadata = {},
}) => {
  return logAudit({
    tx,
    businessId,
    userId,
    entityType,
    entityId,
    action,
    metadata: {
      ...metadata,
      customerId,
    },
  });
};
