const en = require("../locales/en.json");
const sw = require("../locales/sw.json");

function structure(obj) {
  return Object.keys(obj).reduce((acc, key) => {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      acc[key] = structure(obj[key]);
    } else {
      acc[key] = "string";
    }
    return acc;
  }, {});
}

const enStructure = JSON.stringify(structure(en));
const swStructure = JSON.stringify(structure(sw));

if (enStructure !== swStructure) {
  console.error("❌ Locale structure mismatch detected");
  process.exit(1);
}

console.log("✅ Locale structure frozen & valid");
