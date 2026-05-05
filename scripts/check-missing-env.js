const fs = require("fs");
const path = require("path");

const ENV_FILE = path.join(__dirname, "../.env");
const ENV_CONFIG = path.join(__dirname, "../src/config/env.js");

/* ================= LOAD .env ================= */
const envContent = fs.readFileSync(ENV_FILE, "utf-8");

const envKeys = envContent
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split("=")[0]);

/* ================= LOAD env.js ================= */
const envJsContent = fs.readFileSync(ENV_CONFIG, "utf-8");

/* ================= EXTRACT KEYS ================= */

// match optional("X") & required("X")
const matches = envJsContent.match(/(optional|required)\("([A-Z0-9_]+)"/g);

const usedKeys = new Set();

if (matches) {
  matches.forEach((m) => {
    const keyMatch = m.match(/"([A-Z0-9_]+)"/);
    if (keyMatch) {
      usedKeys.add(keyMatch[1]);
    }
  });
}

/* ================= COMPARE ================= */

// 🔴 missing in .env
const missing = [...usedKeys].filter((k) => !envKeys.includes(k));

// 🟡 unused in env.js
const unused = envKeys.filter((k) => !usedKeys.has(k));

console.log("\n🔴 MISSING ENV (used in env.js but not in .env):");
console.log(missing);

console.log("\n🟡 UNUSED ENV (in .env but not used in env.js):");
console.log(unused);
