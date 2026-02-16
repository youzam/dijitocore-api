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
  const db = tx || prisma;

  // 🔒 Enforce active subscription
  await subscriptionAuthority.assertActiveSubscription(businessId);

  // 🔒 Enforce monthly approval limit
  await subscriptionAuthority.assertMonthlyLimit(
    businessId,
    "maxApprovalRequests",
  );

  // 🔒 Prevent duplicate pending approval for same entity
  const existing = await db.approvalRequest.findFirst({
    where: {
      businessId,
      entityType,
      entityId,
      status: "PENDING",
    },
  });

  if (existing) {
    throw new AppError("approval.already_pending", 400);
  }

  const approval = await db.approvalRequest.create({
    data: {
      businessId,
      entityType,
      entityId,
      type,
      requestedBy,
      reason,
    },
  });

  // 🔒 Track usage after successful creation
  await subscriptionAuthority.trackUsage(businessId, "maxApprovalRequests", 1);

  return approval;
};

exports.approveApproval = async ({
  tx,
  approvalId,
  businessId,
  approverId,
}) => {
  const db = tx || prisma;

  const approval = await db.approvalRequest.findFirst({
    where: {
      id: approvalId,
      businessId,
      status: "PENDING",
    },
  });

  if (!approval) {
    throw new AppError("approval.not_found", 404);
  }

  // 🔒 Prevent self-approval
  if (approval.requestedBy === approverId) {
    throw new AppError("approval.self_not_allowed", 403);
  }

  return db.approvalRequest.update({
    where: {
      id: approvalId,
      status: "PENDING", // optimistic guard
    },
    data: {
      status: "APPROVED",
      approvedBy: approverId,
      resolvedAt: new Date(),
    },
  });
};

exports.rejectApproval = async ({ tx, approvalId, businessId, approverId }) => {
  const db = tx || prisma;

  const approval = await db.approvalRequest.findFirst({
    where: {
      id: approvalId,
      businessId,
      status: "PENDING",
    },
  });

  if (!approval) {
    throw new AppError("approval.not_found", 404);
  }

  // 🔒 Prevent self-reject
  if (approval.requestedBy === approverId) {
    throw new AppError("approval.self_not_allowed", 403);
  }

  return db.approvalRequest.update({
    where: {
      id: approvalId,
      status: "PENDING",
    },
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
