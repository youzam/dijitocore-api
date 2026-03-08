const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");

const scopeRank = {
  SELF: 0,
  USER: 1,
  BUSINESS: 2,
  SYSTEM: 3,
  GLOBAL: 4,
};

module.exports = function requirePermission(required) {
  return async (req, res, next) => {
    try {
      const admin = req.user;

      if (!admin) {
        return next(new AppError("auth.notAuthenticated", 401));
      }

      // SUPER_ADMIN bypass
      if (admin.role === "SUPER_ADMIN") {
        return next();
      }

      const { module, action, scope } = required;

      const permissions = await prisma.rolePermission.findMany({
        where: { role: admin.role },
        include: {
          permission: true,
        },
      });

      const allowed = permissions.some((rp) => {
        const perm = rp.permission;

        if (perm.module !== module) return false;
        if (perm.action !== action) return false;

        const permScopeRank = scopeRank[perm.scope];
        const requiredScopeRank = scopeRank[scope];

        return permScopeRank >= requiredScopeRank;
      });

      if (!allowed) {
        return next(new AppError("auth.permissionDenied", 403));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
