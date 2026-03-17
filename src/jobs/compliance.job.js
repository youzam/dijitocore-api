const prisma = require("../config/prisma");
const { Parser } = require("json2csv");
const fs = require("fs");
const path = require("path");

/*
|--------------------------------------------------------------------------
| INTERNAL: PROCESS PURGE QUEUE
|--------------------------------------------------------------------------
*/

const processPurgeQueue = async () => {
  const jobs = await prisma.purgeQueue.findMany({
    where: { status: "PENDING" },
    take: 10,
  });

  for (const job of jobs) {
    try {
      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: "PROCESSING",
          startedAt: new Date(),
        },
      });

      const request = await prisma.dataRequest.findUnique({
        where: { id: job.dataRequestId },
      });

      if (!request) continue;

      // 👉 PLACEHOLDER: Replace with real deletion logic
      await new Promise((resolve) => setTimeout(resolve, 200));

      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await prisma.dataRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
        },
      });

      await sendWebhook("PURGE_COMPLETED", request);
    } catch (error) {
      await prisma.purgeQueue.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: error.message,
          attempts: { increment: 1 },
        },
      });
    }
  }
};

/*
|--------------------------------------------------------------------------
| INTERNAL: PROCESS EXPORT REQUESTS
|--------------------------------------------------------------------------
*/

const processExportRequests = async () => {
  const requests = await prisma.dataRequest.findMany({
    where: {
      type: "EXPORT",
      status: "APPROVED",
    },
    take: 10,
  });

  for (const req of requests) {
    try {
      const modelName = req.targetType.toLowerCase();

      if (!prisma[modelName]) continue;

      const data = await prisma[modelName].findMany({
        where: { id: req.targetId },
      });

      const parser = new Parser();
      const csv = parser.parse(data);

      const exportDir = path.join(__dirname, "../../exports");

      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir);
      }

      const filePath = path.join(exportDir, `${req.id}.csv`);

      fs.writeFileSync(filePath, csv);

      await prisma.dataRequest.update({
        where: { id: req.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
        },
      });

      await sendWebhook("EXPORT_COMPLETED", req);
    } catch (error) {
      await prisma.dataRequest.update({
        where: { id: req.id },
        data: {
          status: "FAILED",
        },
      });
    }
  }
};

/*
|--------------------------------------------------------------------------
| INTERNAL: WEBHOOK HANDLER
|--------------------------------------------------------------------------
*/

const sendWebhook = async (event, payload) => {
  // 👉 Integrate with your notification/webhook system
  console.log(`[WEBHOOK] ${event}`, payload.id);
};

/*
|--------------------------------------------------------------------------
| MAIN JOB ENTRY (REQUIRED PATTERN)
|--------------------------------------------------------------------------
*/

module.exports = {
  run: async () => {
    await processPurgeQueue();
    await processExportRequests();
  },
};
