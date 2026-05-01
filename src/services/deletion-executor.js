const prisma = require("../config/prisma");
const { getDeletionMode } = require("./deletion-policy.service");

/**
 * MODEL-SPECIFIC ANONYMIZATION MAP
 */
const MODEL_ANONYMIZE_MAP = {
  user: {
    email: null,
    phone: null,
    firstName: "Deleted",
    lastName: "User",
    password: null,
  },

  customer: {
    name: "Deleted Customer",
    phone: null,
    email: null,
  },

  installmentPayment: {
    payerName: "REDACTED",
    payerPhone: null,
  },

  auditLog: {
    actorName: "REDACTED",
    actorEmail: null,
  },

  loginActivity: {
    ip: null,
    device: null,
  },

  notification: {
    message: "REDACTED",
  },
};

/**
 * Build anonymization payload per model
 */
const buildAnonymizePayload = (modelName) => {
  return {
    updatedAt: new Date(),
    ...(MODEL_ANONYMIZE_MAP[modelName] || {}),
  };
};

/**
 * Execute deletion (HARD / ANONYMIZE / RETAIN)
 */
const executeDeletion = async (scope) => {
  const results = [];

  await prisma.$transaction(async (tx) => {
    for (const modelName of Object.keys(scope)) {
      const ids = scope[modelName];
      if (!ids || ids.length === 0) continue;

      const mode = getDeletionMode(modelName);

      // RETAIN
      if (mode === "RETAIN") {
        results.push({ model: modelName, action: "SKIPPED" });
        continue;
      }

      // HARD DELETE
      if (mode === "HARD") {
        const res = await tx[modelName].deleteMany({
          where: {
            id: { in: ids },
          },
        });

        results.push({
          model: modelName,
          action: "HARD_DELETE",
          count: res.count,
        });

        continue;
      }

      // ANONYMIZE
      if (mode === "ANONYMIZE") {
        const data = buildAnonymizePayload(modelName);

        const res = await tx[modelName].updateMany({
          where: {
            id: { in: ids },
          },
          data,
        });

        results.push({
          model: modelName,
          action: "ANONYMIZE",
          count: res.count,
        });

        continue;
      }
    }
  });

  return results;
};

module.exports = {
  executeDeletion,
};
