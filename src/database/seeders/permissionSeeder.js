/*
|--------------------------------------------------------------------------
| Permission Seeder
|--------------------------------------------------------------------------
*/

const permissions = [
  /*
  |--------------------------------------------------------------------------
  | ACCESS
  |--------------------------------------------------------------------------
  */

  { module: "ACCESS", action: "CREATE", scope: "SYSTEM" },
  { module: "ACCESS", action: "READ", scope: "SYSTEM" },
  { module: "ACCESS", action: "UPDATE", scope: "SYSTEM" },
  { module: "ACCESS", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | GOVERNANCE
  |--------------------------------------------------------------------------
  */

  { module: "GOVERNANCE", action: "READ", scope: "SYSTEM" },
  { module: "GOVERNANCE", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | COMMERCE
  |--------------------------------------------------------------------------
  */

  { module: "COMMERCE", action: "READ", scope: "SYSTEM" },
  { module: "COMMERCE", action: "UPDATE", scope: "SYSTEM" },
  { module: "COMMERCE", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | ANALYTICS
  |--------------------------------------------------------------------------
  */

  { module: "ANALYTICS", action: "READ", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | REPORTING
  |--------------------------------------------------------------------------
  */

  { module: "REPORTING", action: "READ", scope: "SYSTEM" },
  { module: "REPORTING", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | COMMUNICATION
  |--------------------------------------------------------------------------
  */

  { module: "COMMUNICATION", action: "READ", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | SUPPORT
  |--------------------------------------------------------------------------
  */

  { module: "SUPPORT", action: "CREATE", scope: "SYSTEM" },
  { module: "SUPPORT", action: "READ", scope: "SYSTEM" },
  { module: "SUPPORT", action: "UPDATE", scope: "SYSTEM" },
  { module: "SUPPORT", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | SECURITY
  |--------------------------------------------------------------------------
  */

  { module: "SECURITY", action: "READ", scope: "SYSTEM" },
  { module: "SECURITY", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | COMPLIANCE
  |--------------------------------------------------------------------------
  */

  { module: "COMPLIANCE", action: "READ", scope: "SYSTEM" },
  { module: "COMPLIANCE", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | OPERATIONS
  |--------------------------------------------------------------------------
  */

  { module: "OPERATIONS", action: "READ", scope: "SYSTEM" },
  { module: "OPERATIONS", action: "EXECUTE", scope: "SYSTEM" },

  /*
  |--------------------------------------------------------------------------
  | SETTINGS
  |--------------------------------------------------------------------------
  */

  { module: "SETTINGS", action: "READ", scope: "SYSTEM" },
  { module: "SETTINGS", action: "UPDATE", scope: "SYSTEM" },
];

/*
|--------------------------------------------------------------------------
| Seeder Function
|--------------------------------------------------------------------------
*/

exports.seedPermissions = async (db) => {
  await db.permission.createMany({
    data: permissions,
    skipDuplicates: true,
  });
};
