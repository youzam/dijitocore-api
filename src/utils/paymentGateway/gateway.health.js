const prisma = require("../../config/prisma");

exports.markHealthy = async (code) => {
  await prisma.gatewayHealth.upsert({
    where: { code },
    update: {
      status: "HEALTHY",
      lastCheck: new Date(),
    },
    create: {
      code,
      status: "HEALTHY",
      lastCheck: new Date(),
    },
  });
};

exports.markDown = async (code) => {
  await prisma.gatewayHealth.upsert({
    where: { code },
    update: {
      status: "DOWN",
      lastCheck: new Date(),
    },
    create: {
      code,
      status: "DOWN",
      lastCheck: new Date(),
    },
  });
};

exports.getStatus = async (code) => {
  const record = await prisma.gatewayHealth.findUnique({
    where: { code },
  });

  return record ? record.status : "UNKNOWN";
};
