const prisma = require('../../config/prisma');

const { seedPermissions } = require('./permissionSeeder');
const { assignPermissionsToRoles } = require('./rolePermissionSeeder');

exports.seedRegistry = [
  {
    key: 'permissions',
    handler: () => seedPermissions(prisma),
  },
  {
    key: 'role_permissions',
    handler: () => assignPermissionsToRoles(prisma),
  },
];
