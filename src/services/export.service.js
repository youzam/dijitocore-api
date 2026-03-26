const prisma = require("../config/prisma");
const auditHelper = require("../utils/audit.helper");
const { getDownload, uploadFile } = require("../utils/storage/storage.manager");

/**
 * 🔥 GET ALL PRISMA MODELS (DYNAMIC)
 */
const getAllModels = () => {
  return Object.keys(prisma).filter((key) => {
    if (key.startsWith("$")) return false;
    if (key === "_dmmf") return false;
    return typeof prisma[key]?.findMany === "function";
  });
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
 * 🔥 PERSONAL DATA FILTER (CORE LOGIC)
 */
const buildPersonalDataExport = async (request) => {
  const { targetType, targetId } = request;

  const models = getAllModels();
  const exportData = {};

  for (const modelName of models) {
    try {
      const model = prisma[modelName];

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

      if (Object.keys(where).length === 0) continue;

      // 🔥 SOFT DELETE FILTER
      if (modelHasField(modelName, "isDeleted")) {
        where.isDeleted = false;
      }

      const BATCH_SIZE = 500;
      let skip = 0;
      let batch = [];

      const allData = [];

      do {
        batch = await model.findMany({
          where,
          skip,
          take: BATCH_SIZE,
        });

        if (batch.length > 0) {
          allData.push(...batch);
          skip += BATCH_SIZE;
        }
      } while (batch.length === BATCH_SIZE);

      if (allData.length > 0) {
        exportData[modelName] = sanitizeData(allData, modelName, targetType);
      }

      if (data.length > 0) {
        exportData[modelName] = sanitizeData(data, modelName, targetType);
      }
    } catch (err) {
      if (!exportData._errors) {
        exportData._errors = [];
      }

      exportData._errors.push({
        model: modelName,
        error: err.message,
      });
    }
  }

  if (exportData._errors?.length) {
    console.warn("Partial export completed with errors", exportData._errors);
  }

  return exportData;
};

/**
 * 🔥 SANITIZATION (PRIVACY PROTECTION)
 */
const sanitizeData = (records, modelName, targetType) => {
  return records.map((record) => {
    const clean = { ...record };

    // 🔥 CUSTOMER EXPORT → remove user references
    if (targetType === "CUSTOMER") {
      delete clean.userId;
      delete clean.assignedUserId;
    }

    // 🔥 USER EXPORT → remove customer references
    if (targetType === "USER") {
      delete clean.customerId;
      delete clean.customerPhone;
      delete clean.customerEmail;
    }

    return clean;
  });
};

/**
 * 🔥 GENERATE EXPORT
 */
exports.generateExport = async (requestId) => {
  const request = await prisma.dataRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.type !== "EXPORT") {
    throw new Error("Invalid export request");
  }

  // 🔥 BUILD PERSONAL DATA
  const exportData = await buildPersonalDataExport(request);

  if (Object.keys(exportData).length === 0) {
    throw new Error("No personal data found for export");
  }

  const fileContent = JSON.stringify(exportData, null, 2);
  const buffer = Buffer.from(fileContent);

  // 🔥 STORAGE (EXISTING IMPLEMENTATION)
  const key = `exports/${request.id}.json`;

  const { key: storedKey, provider } = await uploadFile({
    key,
    body: buffer,
    contentType: "application/json",
  });

  // 🔥 UPDATE REQUEST
  await prisma.dataRequest.update({
    where: { id: request.id },
    data: {
      exportFilePath: storedKey,
      storageProvider: provider,
      status: "COMPLETED",
      downloadStatus: "PENDING",
      processedAt: new Date(),
    },
  });

  // 🔥 AUDIT
  await auditHelper.logAudit({
    userId: request.requestedByUserId || null,
    entityType: "DATA_REQUEST",
    entityId: request.id,
    action: "EXPORT_COMPLETED",
    module: "COMPLIANCE",
  });

  return true;
};

/**
 * 🔥 DOWNLOAD EXPORT
 */
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

  // 🔥 ACCESS CONTROL
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

  // 🔥 TRACK DOWNLOAD
  if (isOwner) {
    await prisma.dataRequest.update({
      where: { id: request.id },
      data: {
        downloadStatus: "DOWNLOADED",
        downloadedByUserAt: new Date(),
      },
    });
  }

  if (isAdmin) {
    await prisma.dataRequest.update({
      where: { id: request.id },
      data: {
        downloadedByAdminAt: new Date(),
      },
    });
  }

  // 🔥 AUDIT
  await auditHelper.logAudit({
    userId: user.id,
    entityType: "DATA_REQUEST",
    entityId: request.id,
    action: "DATA_EXPORT_DOWNLOADED",
    module: "COMPLIANCE",
  });

  return result;
};
