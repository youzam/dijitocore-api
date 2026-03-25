const prisma = require("../config/prisma");

exports.logAudit = async ({
  tx,
  businessId = null,
  userId = null,
  customerId = null,
  entityType = null,
  entityId = null,
  action,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  actorType, // optional (TENANT||ADMIN)
  module, // optional
}) => {
  if (!action) {
    throw new Error("Audit missing action");
  }

  const data = {
    businessId,
    userId,
    customerId,
    entityType,
    entityId,
    action,
    metadata,
    ipAddress,
    userAgent,
    actorType: actorType || (businessId ? "TENANT" : "ADMIN"),
    module: module || null,
  };

  if (tx) {
    return tx.auditLog.create({ data });
  }

  return prisma.auditLog.create({ data });
};
