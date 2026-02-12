const prisma = require("../config/prisma");

module.exports.start = () => {
  setInterval(
    async () => {
      const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      await prisma.deviceToken.deleteMany({
        where: { createdAt: { lt: threshold } },
      });
    },
    24 * 60 * 60 * 1000,
  );
};
