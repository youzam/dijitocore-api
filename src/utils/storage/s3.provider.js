const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const env = require("../../config/env");

const client = new S3Client({
  region: env.storage.aws.region,
  credentials: {
    accessKeyId: env.storage.aws.accessKeyId,
    secretAccessKey: env.storage.aws.secretAccessKey,
  },
});

const getBucket = () =>
  env.NODE_ENV === "production"
    ? env.storage.aws.bucketProd
    : env.storage.aws.bucketDev;

/* ================= UPLOAD ================= */
exports.upload = async ({ key, body, contentType }) => {
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return {
    key,
    provider: "s3",
    url: `https://${bucket}.s3.amazonaws.com/${key}`,
  };
};

/* ================= DOWNLOAD (SIGNED URL) ================= */
exports.getSignedDownloadUrl = async (key) => {
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: 60 * 5 }); // 5 mins
};

/* ================= DELETE ================= */
exports.deleteFile = async (key) => {
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return true;
};
