const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "../../../uploads");

/* ================= UPLOAD ================= */
exports.upload = async ({ key, body }) => {
  const filePath = path.join(BASE, key);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);

  return {
    key,
    provider: "local",
    url: `/uploads/${key}`,
  };
};

/* ================= DOWNLOAD ================= */
exports.getDownloadUrl = async (key) => {
  return `/uploads/${key}`;
};

/* ================= DELETE ================= */
exports.deleteFile = async (key) => {
  const filePath = path.join(BASE, key);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return true;
};
