const prisma = require('../../config/prisma');

const { seedLegalPolicies } = require('./legalPolicySeeder');
const { seedPermissions } = require('./permissionSeeder');
const { assignPermissionsToRoles } = require('./rolePermissionSeeder');

exports.seedRegistry = [
  {
    key: 'legal_policies',
    handler: () => seedLegalPolicies(prisma),
  },
  {
    key: 'permissions',
    handler: () => seedPermissions(prisma),
  },
  {
    key: 'role_permissions',
    handler: () => assignPermissionsToRoles(prisma),
  },
];
