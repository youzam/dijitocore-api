const prisma = require("../config/prisma");

const BATCH_SIZE = 200;
const MAX_LOOPS = 1000;

async function run() {
  let cursor = null;
  let loopGuard = 0;

  try {
    while (loopGuard < MAX_LOOPS) {
      loopGuard++;

      const devices = await prisma.deviceToken.findMany({
        where: {
          userId: null,
          customerId: null,
        },
        take: BATCH_SIZE,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor },
        }),
        orderBy: { id: "asc" },
        select: { id: true },
      });

      if (!devices.length) break;

      const ids = devices.map((d) => d.id);

      cursor = ids[ids.length - 1];

      // Efficient atomic batch delete
      await prisma.deviceToken.deleteMany({
        where: {
          id: { in: ids },
        },
      });
    }
  } catch (error) {
    console.error("Device cleanup cron failed:", error);
    throw error;
  }
}

module.exports = { run };
