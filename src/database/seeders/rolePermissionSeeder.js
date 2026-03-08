/*
|--------------------------------------------------------------------------
| Role Permission Seeder
|--------------------------------------------------------------------------
*/

exports.assignPermissionsToRoles = async (db) => {
  const permissions = await db.permission.findMany();

  const map = {};

  permissions.forEach((p) => {
    const key = `${p.module}_${p.action}_${p.scope}`;
    map[key] = p.id;
  });

  const rolePermissions = [
    /*
    |--------------------------------------------------------------------------
    | FINANCE ADMIN
    |--------------------------------------------------------------------------
    */

    { role: "FINANCE_ADMIN", permissionId: map["ACCESS_READ_SYSTEM"] },

    { role: "FINANCE_ADMIN", permissionId: map["COMMERCE_READ_SYSTEM"] },
    { role: "FINANCE_ADMIN", permissionId: map["COMMERCE_UPDATE_SYSTEM"] },
    { role: "FINANCE_ADMIN", permissionId: map["COMMERCE_EXECUTE_SYSTEM"] },

    { role: "FINANCE_ADMIN", permissionId: map["ANALYTICS_READ_SYSTEM"] },

    { role: "FINANCE_ADMIN", permissionId: map["REPORTING_READ_SYSTEM"] },
    { role: "FINANCE_ADMIN", permissionId: map["REPORTING_EXECUTE_SYSTEM"] },

    { role: "FINANCE_ADMIN", permissionId: map["SECURITY_READ_SYSTEM"] },

    { role: "FINANCE_ADMIN", permissionId: map["COMPLIANCE_READ_SYSTEM"] },

    /*
    |--------------------------------------------------------------------------
    | SUPPORT ADMIN
    |--------------------------------------------------------------------------
    */

    { role: "SUPPORT_ADMIN", permissionId: map["SUPPORT_CREATE_SYSTEM"] },
    { role: "SUPPORT_ADMIN", permissionId: map["SUPPORT_READ_SYSTEM"] },
    { role: "SUPPORT_ADMIN", permissionId: map["SUPPORT_UPDATE_SYSTEM"] },
    { role: "SUPPORT_ADMIN", permissionId: map["SUPPORT_EXECUTE_SYSTEM"] },

    { role: "SUPPORT_ADMIN", permissionId: map["COMMUNICATION_READ_SYSTEM"] },

    { role: "SUPPORT_ADMIN", permissionId: map["REPORTING_READ_SYSTEM"] },

    /*
    |--------------------------------------------------------------------------
    | SECURITY ADMIN
    |--------------------------------------------------------------------------
    */

    { role: "SECURITY_ADMIN", permissionId: map["SECURITY_READ_SYSTEM"] },
    { role: "SECURITY_ADMIN", permissionId: map["SECURITY_EXECUTE_SYSTEM"] },

    { role: "SECURITY_ADMIN", permissionId: map["COMPLIANCE_READ_SYSTEM"] },
    { role: "SECURITY_ADMIN", permissionId: map["COMPLIANCE_EXECUTE_SYSTEM"] },

    { role: "SECURITY_ADMIN", permissionId: map["ANALYTICS_READ_SYSTEM"] },

    /*
    |--------------------------------------------------------------------------
    | OPERATIONS ADMIN
    |--------------------------------------------------------------------------
    */

    { role: "OPERATIONS_ADMIN", permissionId: map["OPERATIONS_READ_SYSTEM"] },
    {
      role: "OPERATIONS_ADMIN",
      permissionId: map["OPERATIONS_EXECUTE_SYSTEM"],
    },

    { role: "OPERATIONS_ADMIN", permissionId: map["SETTINGS_UPDATE_SYSTEM"] },

    { role: "OPERATIONS_ADMIN", permissionId: map["ANALYTICS_READ_SYSTEM"] },

    /*
    |--------------------------------------------------------------------------
    | READ ONLY AUDITOR
    |--------------------------------------------------------------------------
    */

    { role: "READ_ONLY_AUDITOR", permissionId: map["GOVERNANCE_READ_SYSTEM"] },
    { role: "READ_ONLY_AUDITOR", permissionId: map["COMMERCE_READ_SYSTEM"] },
    { role: "READ_ONLY_AUDITOR", permissionId: map["ANALYTICS_READ_SYSTEM"] },
    { role: "READ_ONLY_AUDITOR", permissionId: map["REPORTING_READ_SYSTEM"] },
    {
      role: "READ_ONLY_AUDITOR",
      permissionId: map["COMMUNICATION_READ_SYSTEM"],
    },
    { role: "READ_ONLY_AUDITOR", permissionId: map["SUPPORT_READ_SYSTEM"] },
    { role: "READ_ONLY_AUDITOR", permissionId: map["SECURITY_READ_SYSTEM"] },
    { role: "READ_ONLY_AUDITOR", permissionId: map["COMPLIANCE_READ_SYSTEM"] },
    { role: "READ_ONLY_AUDITOR", permissionId: map["OPERATIONS_READ_SYSTEM"] },
    { role: "READ_ONLY_AUDITOR", permissionId: map["SETTINGS_READ_SYSTEM"] },
  ];

  await db.rolePermission.createMany({
    data: rolePermissions,
    skipDuplicates: true,
  });
};
