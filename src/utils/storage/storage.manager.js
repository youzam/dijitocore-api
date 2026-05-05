const s3 = require("./s3.provider");
const local = require("./local.provider");
const env = require("../../config/env");

const provider = env.storage.provider || "s3";

/* ================= UPLOAD ================= */
exports.uploadFile = async (params) => {
  if (provider === "local") {
    return local.upload(params);
  }

  try {
    return await s3.upload(params);
  } catch (error) {
    console.error("S3 FAILED → fallback local", error.message);

    if (env.NODE_ENV === "production") {
      throw error; // 🚨 NO SILENT FAIL IN PROD
    }

    return local.upload(params);
  }
};

/* ================= DOWNLOAD ================= */
exports.getFileUrl = async ({ key, provider }) => {
  if (provider === "s3") {
    return s3.getSignedDownloadUrl(key);
  }

  return local.getDownloadUrl(key);
};

/* ================= DELETE ================= */
exports.deleteFile = async ({ key, provider }) => {
  if (provider === "s3") {
    return s3.deleteFile(key);
  }

  return local.deleteFile(key);
};
