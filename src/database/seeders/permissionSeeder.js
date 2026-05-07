/*
|--------------------------------------------------------------------------
| Permission Seeder (FINAL - CONSTANT DRIVEN)
|--------------------------------------------------------------------------
*/

const PERMISSIONS = require('../../utils/permission.constants');

exports.seedPermissions = async (db) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | BUILD DATA FROM CONSTANTS
    |--------------------------------------------------------------------------
    */

    const data = Object.values(PERMISSIONS).map((name) => ({
      name,
    }));

    /*
    |--------------------------------------------------------------------------
    | INSERT (SKIP DUPLICATES)
    |--------------------------------------------------------------------------
    */

    await db.permission.createMany({
      data,
      skipDuplicates: true,
    });

    console.log(`✅ Permissions seeded: ${data.length}`);
  } catch (error) {
    console.error('❌ Permission seeding failed:', error.message);
    throw error;
  }
};
