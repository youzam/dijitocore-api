// src/utils/graph-validator.js

const prisma = require("../config/prisma");
const { DATA_GRAPH, SYSTEM_MODELS } = require("../config/data-graph");

/**
 * Get all Prisma models safely (no internal APIs)
 */
const getAllModels = () => {
  return Object.keys(prisma).filter((key) => {
    return (
      typeof prisma[key] === "object" &&
      prisma[key] !== null &&
      typeof prisma[key].findMany === "function"
    );
  });
};

/**
 * Extract all models used in DATA_GRAPH
 */
const getGraphModels = () => {
  const models = new Set();

  for (const parent in DATA_GRAPH) {
    models.add(parent);

    const children = DATA_GRAPH[parent] || [];

    for (const child of children) {
      if (child && child.model) {
        models.add(child.model);
      }
    }
  }

  return Array.from(models);
};

/**
 * STRICT VALIDATION (Enterprise Safe)
 *
 * Rule:
 * - ALL user-relevant models MUST be in graph
 * - SYSTEM_MODELS are excluded
 */
const validateGraphCoverage = () => {
  const allModels = getAllModels();
  const graphModels = getGraphModels();

  // Remove system models (they are intentionally excluded)
  const relevantModels = allModels.filter(
    (model) => !SYSTEM_MODELS.includes(model),
  );

  const missing = relevantModels.filter(
    (model) => !graphModels.includes(model),
  );

  if (missing.length) {
    console.error("❌ DATA_GRAPH is INCOMPLETE");
    console.error("Missing USER-RELATED models:");
    console.error(missing);

    throw new Error(
      `Graph validation failed. Missing models: ${missing.join(", ")}`,
    );
  }

  console.log("✅ DATA_GRAPH validated (STRICT MODE)");
};

module.exports = {
  validateGraphCoverage,
};
