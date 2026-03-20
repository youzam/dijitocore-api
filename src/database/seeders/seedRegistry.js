const prisma = require("../../config/prisma");

const { seedPermissions } = require("./permissionSeeder");
const { assignPermissionsToRoles } = require("./rolePermissionSeeder");
const { seedSubscriptionPackages } = require("./subscriptionPackageSeeder");

exports.seedRegistry = [
  {
    key: "permissions",
    handler: () => seedPermissions(prisma),
  },
  {
    key: "role_permissions",
    handler: () => assignPermissionsToRoles(prisma),
  },
  {
    key: "subscription_packages",
    handler: () => seedSubscriptionPackages(),
  },
];
