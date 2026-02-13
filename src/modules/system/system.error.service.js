const prisma = require("../../config/prisma");
const crypto = require("crypto");

const generateSignature = (message, stack) => {
  return crypto
    .createHash("sha256")
    .update(message + (stack || ""))
    .digest("hex");
};

exports.logSystemError = async (error) => {
  const signature = generateSignature(error.message, error.stack);

  let group = await prisma.systemErrorGroup.findUnique({
    where: { signature },
  });

  if (!group) {
    group = await prisma.systemErrorGroup.create({
      data: {
        signature,
        message: error.message,
      },
    });
  } else {
    await prisma.systemErrorGroup.update({
      where: { id: group.id },
      data: {
        occurrence: { increment: 1 },
      },
    });
  }

  return prisma.systemError.create({
    data: {
      groupId: group.id,
      stack: error.stack,
      environment: process.env.NODE_ENV || "development",
    },
  });
};
