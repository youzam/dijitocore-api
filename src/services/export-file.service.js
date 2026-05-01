const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

// 🔐 S3 CLIENT
const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

/**
 * Upload file to S3
 */
const uploadToS3 = async (filePath, key) => {
  const fileStream = fs.createReadStream(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Body: fileStream,
      ContentType: "application/json",
    }),
  );

  return key;
};

/**
 * Generate export file and upload to S3
 */
const generateFiles = async (data, exportId) => {
  const tempDir = path.join(__dirname, "../../tmp");

  // ensure tmp folder exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const tempPath = path.join(tempDir, `${exportId}.json`);

  // 1. write JSON locally
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));

  // 2. upload to S3
  const key = `exports/${exportId}.json`;

  await uploadToS3(tempPath, key);

  // 3. cleanup local file
  fs.unlinkSync(tempPath);

  return {
    s3Key: key,
  };
};

module.exports = {
  generateFiles,
};
