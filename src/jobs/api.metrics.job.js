const operationService = require("../modules/admin/operation/operation.service");

async function run() {
  try {
    await operationService.storeApiMetricsSnapshot();
  } catch (error)  {
    throw error; // muhimu: jobRunner ashughulikie logging
  }
}

module.exports = { run };
