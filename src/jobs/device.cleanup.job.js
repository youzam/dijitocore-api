const prisma = require("../config/prisma");
const jobService = require("../modules/system/system.job.service");

module.exports.start = () => {
  setInterval(
    async () => {
      const startedAt = new Date();

      try {
        const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        await prisma.deviceToken.deleteMany({
          where: { createdAt: { lt: threshold } },
        });

        // ✅ SUCCESS LOG
        await jobService.logJobExecution({
          jobName: "device_cleanup_job",
          status: "success",
          startedAt,
          finishedAt: new Date(),
        });
      } catch (error) {
        // ❌ FAILURE LOG
        await jobService.logJobExecution({
          jobName: "device_cleanup_job",
          status: "failed",
          startedAt,
          finishedAt: new Date(),
          errorMessage: error.message,
        });

        console.error("Device cleanup job failed:", error);
        // Do NOT throw — prevent interval crash
      }
    },
    24 * 60 * 60 * 1000,
  );
};
