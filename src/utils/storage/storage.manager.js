const s3Provider = require("./s3.provider");
const localProvider = require("./local.provider");

exports.uploadFile = async (options) => {
  try {
    const result = await s3Provider.upload(options);
    return result;
  } catch (error) {
    const result = await localProvider.upload(options);
    return result;
  }
};

exports.getDownload = async ({ key, provider }) => {
  if (provider === "s3") {
    const url = await s3Provider.getSignedDownloadUrl(key);
    return { type: "url", value: url };
  }

  if (provider === "local") {
    const stream = localProvider.getFileStream(key);
    return { type: "stream", value: stream };
  }

  throw new Error("Unknown storage provider");
};
