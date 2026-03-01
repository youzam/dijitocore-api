const fs = require("fs");
const path = require("path");

const en = require("../locales/en.json");

function flatten(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, key) => {
    const p = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === "object" && obj[key] !== null) {
      Object.assign(acc, flatten(obj[key], p));
    } else {
      acc[p] = true;
    }

    return acc;
  }, {});
}

const localeKeys = Object.keys(flatten(en));

function scanDir(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      scanDir(full);
    } else if (file.endsWith(".js")) {
      const content = fs.readFileSync(full, "utf8");

      localeKeys.forEach((key) => {
        if (content.includes(`"${key}"`) || content.includes(`'${key}'`)) {
          localeKeys.splice(localeKeys.indexOf(key), 1);
        }
      });
    }
  }
}

scanDir(path.join(__dirname, ".."));

if (localeKeys.length) {
  console.log("⚠ Unused locale keys:");
  console.log(localeKeys);
} else {
  console.log("✅ No unused keys");
}
