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

  // 🔴 IMPORTANT: if no user → skip filtering
  if (!user) {
    req.prisma = prisma;
    return next();
  }

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const businessId = user.businessId;

  req.prisma = prisma.$extends({
    query: {
      $allModels: {
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
      },
    },
  });

  next();
};
