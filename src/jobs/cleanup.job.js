const prisma = require("../config/prisma");

const run = async () => {
  const oldRequests = await prisma.dataRequest.findMany({
    where: {
      type: "EXPORT",
      processedAt: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      exportFilePath: { not: null },
    },
  });

  for (const req of oldRequests) {
    await prisma.dataRequest.update({
      where: { id: req.id },
      data: {
        exportFilePath: null,
      },
    });
  }
};

module.exports = {
  run,
};
