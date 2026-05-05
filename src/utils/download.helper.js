const storageManager = require("./storage/storage.manager");

/**
 * Standardized download handler
 * ALWAYS returns URL (S3 signed or local)
 */
exports.downloadFile = async ({ fileKey, provider }) => {
  if (!fileKey) {
    throw new Error("file.key_required");
  }

  const url = await storageManager.getFileUrl({
    key: fileKey,
    provider,
  });

  return {
    type: "url",
    value: url,
  };
};
