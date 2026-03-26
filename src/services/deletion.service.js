const prisma = require("../config/prisma");
const auditHelper = require("../utils/audit.helper");

/**
 * 🔥 RETENTION RULES
 */
const RETENTION_RULES = {
  payment: "STRICT",
  transaction: "STRICT",
  invoice: "STRICT",
  subscription: "STRICT",

  contract: "PARTIAL",
  auditLog: "PARTIAL",

  user: "FULL",
  customer: "FULL",
};

/**
 * 🔥 CHECK MODEL FIELD
 */
const modelHasField = (modelName, field) => {
  try {
    const model = prisma._dmmf.modelMap[modelName];
    if (!model) return false;
    return model.fields.some((f) => f.name === field);
  } catch {
    return false;
  }
};

/**
 * 🔥 GET ALL MODELS
 */
const getAllModels = () => {
  return Object.keys(prisma).filter((key) => {
    if (key.startsWith("$")) return false;
    if (key === "_dmmf") return false;
    return typeof prisma[key]?.findMany === "function";
  });
};

/**
 * 🔥 ANONYMIZE RECORD
 */
const anonymizeRecord = (record) => {
  const updated = { ...record };

  if ("name" in updated) updated.name = "Deleted User";
  if ("email" in updated) updated.email = null;
  if ("phone" in updated) updated.phone = null;
  if ("password" in updated) updated.password = null;

  if ("address" in updated) updated.address = null;
  if ("profileImage" in updated) updated.profileImage = null;

  return updated;
};

/**
 * 🔥 BUILD UPDATE DATA BASED ON RETENTION
 */
const buildUpdateData = (modelName, record) => {
  const rule = RETENTION_RULES[modelName] || "FULL";

  const updateData = {};

  // 🔥 SOFT DELETE ALWAYS
  if (modelHasField(modelName, "isDeleted")) {
    updateData.isDeleted = true;
  }

  // 🔴 STRICT → no anonymization
  if (rule === "STRICT") {
    return updateData;
  }

  // 🟡 PARTIAL + 🟢 FULL → anonymize
  const anonymized = anonymizeRecord(record);

  Object.keys(anonymized).forEach((key) => {
    if (anonymized[key] !== record[key]) {
      updateData[key] = anonymized[key];
    }
  });

  return updateData;
};

/**
 * 🔥 PROCESS MODEL
 */
const processModelDeletion = async (modelName, request) => {
  const { targetType, targetId } = request;

  const model = prisma[modelName];
  if (!model) return;

  const where = {};

  // 🔥 OWNERSHIP FILTER
  if (targetType === "USER" && modelHasField(modelName, "userId")) {
    where.userId = targetId;
  }

  if (targetType === "CUSTOMER" && modelHasField(modelName, "customerId")) {
    where.customerId = targetId;
  }

  if (targetType === "BUSINESS" && modelHasField(modelName, "businessId")) {
    where.businessId = targetId;
  }

  // direct match
  if (modelName === "user" && targetType === "USER") {
    where.id = targetId;
  }

  if (modelName === "customer" && targetType === "CUSTOMER") {
    where.id = targetId;
  }

  if (Object.keys(where).length === 0) return;

  const records = await model.findMany({ where });

  if (!records.length) return;

  for (const record of records) {
    const updateData = buildUpdateData(modelName, record);

    if (Object.keys(updateData).length === 0) continue;

    await model.update({
      where: { id: record.id },
      data: updateData,
    });
  }
};

/**
 * 🔥 MAIN DELETE EXECUTION
 */
exports.executeDeletion = async (requestId) => {
  const request = await prisma.dataRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.type !== "DELETE") {
    throw new Error("Invalid delete request");
  }

  const models = getAllModels();

  for (const modelName of models) {
    try {
      await processModelDeletion(modelName, request);
    } catch (err) {
      console.error(`Delete failed for ${modelName}`, err.message);
    }
  }

  await prisma.dataRequest.update({
    where: { id: request.id },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
    },
  });

  await auditHelper.logAudit({
    userId: request.requestedByUserId || null,
    entityType: "DATA_REQUEST",
    entityId: request.id,
    action: "DATA_DELETION_COMPLETED",
    module: "COMPLIANCE",
  });

  return true;
};
