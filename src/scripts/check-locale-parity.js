const fs = require("fs");
const path = require("path");

const en = require("../locales/en.json");
const sw = require("../locales/sw.json");

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

const enKeys = flatten(en);
const swKeys = flatten(sw);

const missingInSw = Object.keys(enKeys).filter((k) => !swKeys[k]);
const missingInEn = Object.keys(swKeys).filter((k) => !enKeys[k]);

if (missingInSw.length || missingInEn.length) {
  console.error("❌ Locale parity mismatch detected");

  if (missingInSw.length) {
    console.error("Missing in sw.json:");
    console.error(missingInSw);
  }

  if (missingInEn.length) {
    console.error("Missing in en.json:");
    console.error(missingInEn);
  }

  process.exit(1);
}

console.log("✅ Locale parity OK");
process.exit(0);
