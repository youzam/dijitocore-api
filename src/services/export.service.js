const prisma = require("../config/prisma");
const { getDownload, uploadFile } = require("../utils/storage/storage.manager");
const auditHelper = require("../utils/audit.helper");

// ======================================================
// 🔥 MODEL REGISTRY
// ======================================================
const MODEL_REGISTRY = [
  { model: "user", key: "users", field: "id", target: "USER", policy: "CORE" },
  {
    model: "business",
    key: "business",
    field: "id",
    target: "BUSINESS",
    policy: "CORE",
  },
  {
    model: "customer",
    key: "customer",
    field: "id",
    target: "CUSTOMER",
    policy: "CORE",
  },

  { model: "consentLog", key: "consents", field: "userId", policy: "CORE" },
  { model: "ticket", key: "userTickets", field: "userId", policy: "CORE" },

  { model: "contract", key: "contracts", field: "customerId", policy: "CORE" },
  {
    model: "payment",
    key: "customerPayments",
    field: "customerId",
    policy: "CORE",
  },
  {
    model: "customerCredit",
    key: "customerCredits",
    field: "customerId",
    policy: "CORE",
  },

  { model: "user", key: "businessUsers", field: "businessId", policy: "CORE" },
  {
    model: "customer",
    key: "businessCustomers",
    field: "businessId",
    policy: "CORE",
  },
  {
    model: "payment",
    key: "businessPayments",
    field: "businessId",
    policy: "CORE",
  },

  {
    model: "subscription",
    key: "subscriptions",
    field: "businessId",
    policy: "CORE",
  },

  { model: "auditLog", key: "auditLogs", field: "userId", policy: "EXTENDED" },
];

// ======================================================
// 🧠 ENGINE
// ======================================================
const buildDynamicExport = async (targetType, targetId) => {
  const result = {};

  for (const entry of MODEL_REGISTRY) {
    const { model, key, field, policy, target } = entry;

    if (target && target !== targetType) continue;

    if (!prisma[model]) continue;

    // CORE ENTITY (id)
    if (field === "id") {
      const data = await prisma[model].findUnique({
        where: { id: targetId },
      });

      if (data) result[key] = data;
      continue;
    }

    const matches =
      (targetType === "USER" && field === "userId") ||
      (targetType === "CUSTOMER" && field === "customerId") ||
      (targetType === "BUSINESS" && field === "businessId");

    if (!matches) continue;

    const queryOptions =
      policy === "EXTENDED"
        ? { take: 1000, orderBy: { createdAt: "desc" } }
        : {};

    const data = await prisma[model].findMany({
      where: { [field]: targetId },
      ...queryOptions,
    });

    if (data.length > 0) result[key] = data;
  }

  return result;
};

// ======================================================
// 📦 EXPORT
// ======================================================
exports.generateExport = async (requestId) => {
  const request = await prisma.dataRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.type !== "EXPORT") {
    throw new Error("Invalid request");
  }

  const exportData = await buildDynamicExport(
    request.targetType,
    request.targetId,
  );

  const payload = {
    data: exportData,
    meta: {
      requestId: request.id,
      targetType: request.targetType,
      generatedAt: new Date(),
    },
  };

  const buffer = Buffer.from(JSON.stringify(payload, null, 2));

  const key = `exports/${request.targetType.toLowerCase()}/${request.id}.json`;

  const { key: storedKey, provider } = await uploadFile({
    key,
    body: buffer,
    contentType: "application/json",
  });

  await prisma.dataRequest.update({
    where: { id: request.id },
    data: {
      exportFilePath: storedKey,
      storageProvider: provider,
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
    action: "DATA_EXPORT_GENERATED",
    module: "COMPLIANCE",
    actorType: "SYSTEM",
  });

  return { key: storedKey, provider };
};

// ======================================================
// 📥 DOWNLOAD
// ======================================================
exports.downloadExport = async (requestId, user) => {
  const request = await prisma.dataRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.type !== "EXPORT") {
    throw new Error("Export not found");
  }

  if (request.status !== "COMPLETED") {
    throw new Error("Export not ready");
  }

  const isOwner =
    request.requestedByUserId === user.id ||
    request.requestedByCustomerId === user.id;

  const isAdmin = user.role && user.role.includes("ADMIN");

  if (!isOwner && !isAdmin) {
    throw new Error("Unauthorized");
  }

  const result = await getDownload({
    key: request.exportFilePath,
    provider: request.storageProvider || "local",
  });

  await auditHelper.logAudit({
    userId: user.id,
    entityType: "DATA_REQUEST",
    entityId: request.id,
    action: "DATA_EXPORT_DOWNLOADED",
    module: "COMPLIANCE",
    actorType: "USER",
  });

  return result;
};
