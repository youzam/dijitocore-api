const storageManager = require("./storage/storage.manager");

exports.getFileDownload = async ({ fileKey, provider }) => {
  const result = await storageManager.getDownload({
    key: fileKey,
    provider,
  });

  return result;
};
