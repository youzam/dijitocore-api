// src/services/deletion.service.js

const prisma = require("../config/prisma");
const { buildScope } = require("./deletion-scope.service");
const { executeDeletion } = require("./deletion-executor");

/**
 * Execute full deletion flow
 * @param {Object} options
 * @param {String} options.rootModel (user | customer | etc)
 * @param {String} options.rootId
 */
const executeFullDeletion = async ({ rootModel, rootId }) => {
  if (!rootModel || !rootId) {
    throw new Error("rootModel and rootId are required");
  }

  console.log(`🧹 Starting deletion for ${rootModel}:${rootId}`);

  // 1. Build scope
  const scope = await buildScope({
    rootModel,
    rootId,
  });

  // 🛑 EMPTY / ALREADY DELETED GUARD
  if (!scope || Object.keys(scope).length === 0) {
    return {
      skipped: true,
      reason: "No data found or already deleted",
    };
  }

  console.log("📦 Scope built:");
  console.log(
    Object.keys(scope).reduce((acc, key) => {
      acc[key] = scope[key].length;
      return acc;
    }, {}),
  );

  // 2. Execute deletion
  const results = await executeDeletion(scope);

  console.log("✅ Deletion completed");

  // 3. Save audit record (optional but recommended)
  await prisma.auditLog.create({
    data: {
      action: "DATA_DELETION",
      entityType: rootModel,
      entityId: rootId,
      metadata: {
        scopeSummary: Object.keys(scope).reduce((acc, key) => {
          acc[key] = scope[key].length;
          return acc;
        }, {}),
        results,
      },
    },
  });

  return {
    success: true,
    scope,
    results,
  };
};

module.exports = {
  executeFullDeletion,
};
