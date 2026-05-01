// src/services/export-formatter.service.js

const { getExportMode } = require("./export-policy.service");

const SENSITIVE_FIELDS = ["password", "deletedAt", "deletedBy"];

const formatData = (rawData) => {
  const formatted = {};

  for (const model in rawData) {
    const mode = getExportMode(model);

    if (mode === "NONE") continue;

    formatted[model] = rawData[model].map((record) => {
      if (mode === "FULL") return record;

      if (mode === "PARTIAL") {
        const clean = { ...record };

        SENSITIVE_FIELDS.forEach((field) => {
          if (field in clean) {
            delete clean[field];
          }
        });

        return clean;
      }
    });
  }

  return formatted;
};

module.exports = {
  formatData,
};
