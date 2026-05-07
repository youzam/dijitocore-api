const db = require('../config/prisma');
const {
  assignPermissionsToRoles,
} = require('../database/seeders/rolePermissionSeeder');
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
    const dbPermissions = await db.permission.findMany();
    const dbNames = dbPermissions.map((p) => p.name);

    const constantNames = Object.values(PERMISSIONS);

    // =============================
    // 3. FIND NEW PERMISSIONS
    // =============================
    const missing = constantNames.filter((p) => !dbNames.includes(p));

    if (missing.length === 0) {
      console.log('✅ No new permissions found');
      return;
    }

    console.log(`⚡ Found ${missing.length} new permissions`);

    // =============================
    // 4. SEED NEW PERMISSIONS
    // =============================
    await db.permission.createMany({
      data: missing.map((name) => ({ name })),
      skipDuplicates: true,
    });

    console.log('✅ New permissions seeded');

    // =============================
    // 5. RE-ASSIGN USING SEEDER
    // =============================
    await assignPermissionsToRoles(db);

    console.log('🔁 Roles re-synced with new permissions');
  } catch (err) {
    console.error('❌ Permission integrity failed:', err.message);
  }
};
