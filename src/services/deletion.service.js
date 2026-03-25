const prisma = require("../config/prisma");
const auditHelper = require("../utils/audit.helper");

// ======================================================
// 🔥 DELETION RULES (SCHEMA-AWARE)
// ======================================================
const MODEL_RULES = [
  // =============================
  // 🔹 USER RELATED
  // =============================
  { model: "session", field: "userId", action: "DELETE" },
  { model: "refreshToken", field: "userId", action: "DELETE" },

  { model: "notification", field: "userId", action: "DETACH" },
  { model: "auditLog", field: "userId", action: "DETACH" },
  { model: "loginActivity", field: "userId", action: "DETACH" },

  // =============================
  // 🔹 CUSTOMER RELATED
  // =============================
  { model: "notification", field: "customerId", action: "DETACH" },
  { model: "auditLog", field: "customerId", action: "DETACH" },

  // =============================
  // 🔹 BUSINESS RELATED
  // =============================
  { model: "notification", field: "businessId", action: "DETACH" },
  { model: "auditLog", field: "businessId", action: "DETACH" },

  // =============================
  // 🔹 FINANCIAL (KEEP STRICT)
  // =============================
  { model: "payment", field: "businessId", action: "KEEP" },
  { model: "payment", field: "customerId", action: "KEEP" },
  { model: "subscription", field: "businessId", action: "KEEP" },
  { model: "customerCredit", field: "customerId", action: "KEEP" },
];

// ======================================================
// 🔧 APPLY RULE
// ======================================================
const applyRule = async ({ model, field, action, targetId }) => {
  if (!prisma[model]) return;

  if (action === "KEEP") return;

  if (action === "DELETE") {
    await prisma[model].deleteMany({
      where: { [field]: targetId },
    });
    return;
  }

  if (action === "DETACH") {
    await prisma[model].updateMany({
      where: { [field]: targetId },
      data: { [field]: null },
    });
    return;
  }
};

// ======================================================
// 🔐 ANONYMIZATION
// ======================================================
const anonymizeUser = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: "DELETED",
      lastName: "USER",
      email: null,
      phone: null,
      isDeleted: true,
    },
  });
};

const anonymizeCustomer = async (customerId) => {
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: "DELETED",
      lastName: "CUSTOMER",
      phone: null,
      email: null,
      isDeleted: true,
    },
  });
};

const anonymizeBusiness = async (businessId) => {
  await prisma.business.update({
    where: { id: businessId },
    data: {
      name: "DELETED BUSINESS",
      isDeleted: true,
    },
  });
};

// ======================================================
// 🔥 CORE ENGINE
// ======================================================
const runDeletionEngine = async (targetType, targetId) => {
  // apply rules
  for (const rule of MODEL_RULES) {
    const matches =
      (targetType === "USER" && rule.field === "userId") ||
      (targetType === "CUSTOMER" && rule.field === "customerId") ||
      (targetType === "BUSINESS" && rule.field === "businessId");

    if (!matches) continue;

    await applyRule({
      ...rule,
      targetId,
    });
  }

  // =============================
  // 🔐 FINAL ANONYMIZATION
  // =============================
  if (targetType === "USER") {
    await anonymizeUser(targetId);
  }

  if (targetType === "CUSTOMER") {
    await anonymizeCustomer(targetId);
  }

  if (targetType === "BUSINESS") {
    // anonymize business
    await anonymizeBusiness(targetId);

    // anonymize users inside business
    const users = await prisma.user.findMany({
      where: { businessId: targetId },
      select: { id: true },
    });

    for (const u of users) {
      await anonymizeUser(u.id);
    }

    // anonymize customers inside business
    const customers = await prisma.customer.findMany({
      where: { businessId: targetId },
      select: { id: true },
    });

    for (const c of customers) {
      await anonymizeCustomer(c.id);
    }
  }
};

// ======================================================
// 🚀 ENTRY POINT
// ======================================================
exports.executeDeletion = async (dataRequestId) => {
  const request = await prisma.dataRequest.findUnique({
    where: { id: dataRequestId },
  });

  if (!request || request.type !== "DELETE") {
    throw new Error("Invalid deletion request");
  }

  await runDeletionEngine(request.targetType, request.targetId);

  await prisma.dataRequest.update({
    where: { id: request.id },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
    },
  });

  await auditHelper.logAudit({
    userId:
      request.requestedByUserId ||
      request.requestedByCustomerId ||
      request.requestedByAdminId ||
      null,
    entityType: "DATA_REQUEST",
    entityId: request.id,
    action: "DATA_DELETION_EXECUTED",
    module: "COMPLIANCE",
    actorType: "SYSTEM",
  });
};
