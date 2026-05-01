const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

/**
 * Generate a signed URL for downloading export
 * @param {string} key - S3 object key (e.g., exports/xxx.json)
 */
const getDownloadUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
  });

  // link valid for 10 minutes
  const url = await getSignedUrl(s3, command, {
    expiresIn: 60 * 10,
  });

  return url;
};

module.exports = {
  getDownloadUrl,
};
