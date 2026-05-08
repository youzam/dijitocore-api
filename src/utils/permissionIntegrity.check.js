const db = require('../config/prisma');
const PERMISSIONS = require('../utils/permission.constants');

module.exports = async function checkPermissionIntegrity() {
  try {
    console.log('\n🔍 Checking permission integrity...\n');

    // =============================
    // 1. CHECK DB CONNECTION
    // =============================
    try {
      await db.$queryRaw`SELECT 1`;
    } catch (err) {
      console.warn(err, '⚠️ DB not ready, skipping permission integrity check');
      return;
    }

    // =============================
    // 2. GET DB PERMISSIONS
    // =============================
    const dbPermissions = await db.permission.findMany({
      select: {
        name: true,
      },
    });

    const dbNames = dbPermissions.map((p) => p.name);

    const constantNames = Object.values(PERMISSIONS);

    // =============================
    // 3. FIND MISSING
    // =============================
    const missing = constantNames.filter((p) => !dbNames.includes(p));

    // =============================
    // 4. REPORT ONLY
    // =============================
    if (missing.length === 0) {
      console.log('✅ Permission integrity OK');
      return;
    }

    console.log(`⚠️ Found ${missing.length} missing permissions\n`);

    missing.forEach((permission, index) => {
      console.log(`${index + 1}. ${permission}`);
    });

    console.log('\n🛑 No permissions were inserted automatically');

    return {
      missingCount: missing.length,
      missingPermissions: missing,
    };
  } catch (err) {
    console.error('❌ Permission integrity failed:', err.message);
  }
};
