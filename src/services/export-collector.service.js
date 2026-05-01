// src/services/export-collector.service.js

const prisma = require("../config/prisma");

const collectData = async (scope) => {
  const data = {};

  for (const model of Object.keys(scope)) {
    const ids = scope[model];
    if (!ids.length) continue;

    try {
      const records = await prisma[model].findMany({
        where: {
          id: { in: ids },
        },
      });

      data[model] = records;
    } catch (err) {
      console.error(`Collect failed for ${model}:`, err.message);
    }
  }

  return data;
};

module.exports = {
  collectData,
};
