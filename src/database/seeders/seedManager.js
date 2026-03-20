const prisma = require("../../config/prisma");

const shouldSkip = async (key) => {
  const log = await prisma.systemSeedLog.findUnique({
    where: { key },
  });

  return log && log.status === "SUCCESS";
};

const markRunning = async (key) => {
  await prisma.systemSeedLog.upsert({
    where: { key },
    update: {
      status: "PENDING",
      lastRunAt: new Date(),
      error: null,
    },
    create: {
      key,
      status: "PENDING",
      lastRunAt: new Date(),
    },
  });
};

const markSuccess = async (key) => {
  await prisma.systemSeedLog.update({
    where: { key },
    data: {
      status: "SUCCESS",
      error: null,
      lastRunAt: new Date(),
    },
  });
};

const markFailed = async (key, error) => {
  await prisma.systemSeedLog.update({
    where: { key },
    data: {
      status: "FAILED",
      error: error.message,
      lastRunAt: new Date(),
    },
  });
};

exports.runSeeders = async (seeders) => {
  const results = [];

  for (const seeder of seeders) {
    const { key, handler } = seeder;

    // 🔥 SKIP IF ALREADY SUCCESS
    const skip = await shouldSkip(key);
    if (skip) {
      results.push({ key, status: "SKIPPED" });
      continue;
    }

    try {
      await markRunning(key);

      await handler();

      await markSuccess(key);

      results.push({ key, status: "SUCCESS" });
    } catch (err) {
      await markFailed(key, err);

      results.push({
        key,
        status: "FAILED",
        error: err.message,
      });

      // 🔥 STOP ON FAILURE (resume later)
      break;
    }
  }

  return results;
};
