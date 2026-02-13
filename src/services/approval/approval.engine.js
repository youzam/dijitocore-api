const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");

exports.createApproval = async ({
  tx,
  businessId,
  entityType,
  entityId,
  type,
  requestedBy,
  reason,
}) => {
  return (tx || prisma).approvalRequest.create({
    data: {
      businessId,
      entityType,
      entityId,
      type,
      requestedBy,
      reason,
    },
  });
};

exports.approveApproval = async ({
  tx,
  approvalId,
  businessId,
  approverId,
}) => {
  const approval = await (tx || prisma).approvalRequest.findFirst({
    where: { id: approvalId, businessId, status: "PENDING" },
  });

  if (!approval) {
    throw new AppError("approval.not_found", 404);
  }

  return (tx || prisma).approvalRequest.update({
    where: { id: approvalId },
    data: {
      status: "APPROVED",
      approvedBy: approverId,
      resolvedAt: new Date(),
    },
  });
};

exports.rejectApproval = async ({ tx, approvalId, businessId, approverId }) => {
  const approval = await (tx || prisma).approvalRequest.findFirst({
    where: { id: approvalId, businessId, status: "PENDING" },
  });

  if (!approval) {
    throw new AppError("approval.not_found", 404);
  }

  return (tx || prisma).approvalRequest.update({
    where: { id: approvalId },
    data: {
      status: "REJECTED",
      approvedBy: approverId,
      resolvedAt: new Date(),
    },
  });
};

/* ================= LIST APPROVALS ================= */
exports.listApprovals = async ({ businessId, status, entityType }) => {
  const where = { businessId };

  if (status) where.status = status;
  if (entityType) where.entityType = entityType;

  return prisma.approvalRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
};
