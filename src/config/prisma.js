const { PrismaClient } = require("@prisma/client");
const { getContext } = require("../utils/requestContext");

// ======================================================
// 🔧 BASE CLIENT (KEEP YOUR EXISTING CONFIG)
// ======================================================
const basePrisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

// ======================================================
// 🔍 OBSERVABILITY (KEEP)
// ======================================================
basePrisma.$on("warn", (e) => {
  console.warn("⚠️ Prisma warning:", e);
});

basePrisma.$on("error", (e) => {
  console.error("❌ Prisma error:", e);
});

// ======================================================
// 🔒 AUDIT LOG IMMUTABILITY (KEEP)
// ======================================================
const prismaWithAuditProtection = basePrisma.$extends({
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

// ======================================================
// 🔐 CONTEXT-BASED SECURITY LAYER (NEW)
// ======================================================
const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "SECURITY_ADMIN",
  "SUPPORT_ADMIN",
  "OPERATIONS_ADMIN",
  "READ_ONLY_AUDITOR",
];

const prisma = prismaWithAuditProtection.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = getContext();
        const user = context?.user;

        // 🔴 No user → skip filtering
        if (!user) {
          return query(args);
        }

        const isAdmin = ADMIN_ROLES.includes(user.role);
        const businessId = user.businessId;

        const READ_ACTIONS = ["findMany", "findFirst", "count"];

        // =========================
        // 🔍 READ FILTERING
        // =========================
        if (READ_ACTIONS.includes(operation)) {
          args = args || {};
          args.where = args.where || {};

          if (!isAdmin) {
            args.where = {
              ...args.where,
              isDeleted: false,
              ...(businessId && !args.where.businessId ? { businessId } : {}),
            };
          }
        }

        // =========================
        // ✏️ WRITE PROTECTION
        // =========================
        if (!isAdmin && ["update", "delete"].includes(operation)) {
          const where = args?.where;

          if (where?.id) {
            const record = await prismaWithAuditProtection[model].findFirst({
              where: {
                id: where.id,
                isDeleted: false,
                ...(businessId ? { businessId } : {}),
              },
              select: { id: true },
            });

            if (!record) {
              throw new Error("Access denied or resource not found");
            }
          }
        }

        // =========================
        // BULK OPERATIONS
        // =========================
        if (!isAdmin && ["updateMany", "deleteMany"].includes(operation)) {
          args = args || {};
          args.where = args.where || {};

          args.where = {
            ...args.where,
            isDeleted: false,
            ...(businessId ? { businessId } : {}),
          };
        }

        return query(args);
      },
    },
  },
});

module.exports = prisma;
