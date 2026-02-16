const { PrismaClient } = require("@prisma/client");

/**
 * Centralized Prisma Client
 * - Single DB connection
 * - Full logging enabled
 * - No process lifecycle ownership
 */

const basePrisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

/**
 * 🔒 Prevent audit log modification (append-only enforcement)
 * Prisma v5+ compatible using $extends
 */
const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      async update() {
        throw new Error("Audit logs are immutable and cannot be modified.");
      },
      async updateMany() {
        throw new Error("Audit logs are immutable and cannot be modified.");
      },
      async delete() {
        throw new Error("Audit logs are immutable and cannot be modified.");
      },
      async deleteMany() {
        throw new Error("Audit logs are immutable and cannot be modified.");
      },
    },
  },
});

/**
 * =========================
 * DATABASE OBSERVABILITY
 * =========================
 */

basePrisma.$on("query", (e) => {
  console.log("[DB QUERY]", {
    query: e.query,
    params: e.params,
    durationMs: e.duration,
  });
});

basePrisma.$on("warn", (e) => {
  console.warn("[DB WARN]", e.message);
});

basePrisma.$on("error", (e) => {
  console.error("[DB ERROR]", e.message);
});

module.exports = prisma;
