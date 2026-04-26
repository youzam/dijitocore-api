const prisma = require("../config/prisma");
const { logAudit } = require("../utils/audit.helper");

exports.run = async () => {
  const now = new Date();

  // 🔓 Find users whose lock has expired
  const users = await prisma.user.findMany({
    where: {
      lockUntil: {
        not: null,
        lte: now,
      },
    },
    select: { id: true },
  });

  if (!users.length) {
    return;
  }

  // 🔓 Unlock all expired users
  const ids = users.map((u) => u.id);

  await prisma.user.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      lockUntil: null,
    },
  });

  for (const user of users) {
    await logAudit({
      userId: null, // system
      entityType: "USER",
      entityId: user.id,
      action: "USER_AUTO_UNLOCKED",
      module: "SYSTEM",
      actorType: "ADMIN", // system-level
      metadata: {
        reason: "LOCK_EXPIRED",
      },
    });
  }
};
