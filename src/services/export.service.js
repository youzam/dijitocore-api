// src/services/data-export.service.js

const { buildScope } = require("./deletion-scope.service");
const { collectData } = require("./export-collector.service");
const { formatData } = require("./export-formatter.service");
const { generateFiles } = require("./export-file.service");

const executeExport = async ({ rootModel, rootId }) => {
  console.log(`📦 Starting export for ${rootModel}:${rootId}`);

  // 1. Build scope
  const scope = await buildScope({ rootModel, rootId });

  // 2. Collect raw data
  const rawData = await collectData(scope);

  // 3. Format data
  const formatted = formatData(rawData);

  // 4. Generate files
  const exportId = `${rootModel}-${rootId}-${Date.now()}`;
  const files = await generateFiles(formatted, exportId);

  console.log("✅ Export completed");

  return {
    success: true,
    files,
  };
};

module.exports = {
  executeExport,
};
