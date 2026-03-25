const prisma = require("../config/prisma");

const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "SECURITY_ADMIN",
  "SUPPORT_ADMIN",
  "OPERATIONS_ADMIN",
  "READ_ONLY_AUDITOR",
];

module.exports = (req, res, next) => {
  const user = req.user || null;

  // no user → no filtering
  if (!user) {
    req.prisma = prisma;
    return next();
  }

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const businessId = user.businessId;

  req.prisma = prisma.$extends({
    query: {
      $allModels: {
        // =========================
        // 🔍 READ OPERATIONS
        // =========================
        async findMany({ args, query }) {
          args = args || {};
          args.where = args.where || {};

          if (!isAdmin) {
            args.where = {
              ...args.where,
              isDeleted: false,
              ...(businessId && !args.where.businessId ? { businessId } : {}),
            };
          }

          return query(args);
        },

        async findFirst({ args, query }) {
          args = args || {};
          args.where = args.where || {};

          if (!isAdmin) {
            args.where = {
              ...args.where,
              isDeleted: false,
              ...(businessId && !args.where.businessId ? { businessId } : {}),
            };
          }

          return query(args);
        },

        async count({ args, query }) {
          args = args || {};
          args.where = args.where || {};

          if (!isAdmin) {
            args.where = {
              ...args.where,
              isDeleted: false,
              ...(businessId && !args.where.businessId ? { businessId } : {}),
            };
          }

          return query(args);
        },

        // =========================
        // ✏️ WRITE PROTECTION
        // =========================
        async update({ model, args, query }) {
          if (!isAdmin) {
            await enforceOwnership(model, args.where, businessId);
          }
          return query(args);
        },

        async delete({ model, args, query }) {
          if (!isAdmin) {
            await enforceOwnership(model, args.where, businessId);
          }
          return query(args);
        },

        async updateMany({ model, args, query }) {
          if (!isAdmin) {
            args.where = {
              ...args.where,
              isDeleted: false,
              ...(businessId ? { businessId } : {}),
            };
          }
          return query(args);
        },

        async deleteMany({ model, args, query }) {
          if (!isAdmin) {
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

  next();
};

// =========================
// 🔒 OWNERSHIP CHECK
// =========================
async function enforceOwnership(model, where, businessId) {
  if (!where || !where.id) return;

  const record = await prisma[model].findFirst({
    where: {
      id: where.id,
      isDeleted: false,
      ...(businessId ? { businessId } : {}),
    },
    select: { id: true },
  });

  if (!record) {
    throw new Error("Resource not found or access denied");
  }
}
