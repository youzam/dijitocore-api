const { PrismaClient } = require("@prisma/client");

/**
 * Centralized Prisma Client
 * - Single DB connection
 * - Full logging enabled
 * - No process lifecycle ownership
 */

const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

/**
 * =========================
 * DATABASE OBSERVABILITY
 * =========================
 */

prisma.$on("query", (e) => {
  console.log("[DB QUERY]", {
    query: e.query,
    params: e.params,
    durationMs: e.duration,
  });
});

prisma.$on("warn", (e) => {
  console.warn("[DB WARN]", e.message);
});

prisma.$on("error", (e) => {
  console.error("[DB ERROR]", e.message);
});

module.exports = prisma;
