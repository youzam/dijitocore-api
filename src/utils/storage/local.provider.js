const fs = require("fs");
const path = require("path");

exports.upload = async ({ key, body }) => {
  const baseDir = path.join(__dirname, "../../../uploads");
  const filePath = path.join(baseDir, key);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);

  return {
    key,
    provider: "local",
  };
};

exports.getFileStream = (key) => {
  const baseDir = path.join(__dirname, "../../../uploads");
  const filePath = path.join(baseDir, key);

  if (!fs.existsSync(filePath)) {
    throw new Error("File not found");
  }

  return fs.createReadStream(filePath);
};
