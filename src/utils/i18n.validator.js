const en = require("../locales/en.json");
const sw = require("../locales/sw.json");

function flatten(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, key) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === "object" && obj[key] !== null) {
      Object.assign(acc, flatten(obj[key], path));
    } else {
      acc[path] = true;
    }

    return acc;
  }, {});
}

const EN_KEYS = flatten(en);
const SW_KEYS = flatten(sw);

function validateLocaleKey(key) {
  const existsInEn = EN_KEYS[key];
  const existsInSw = SW_KEYS[key];

  if (!existsInEn || !existsInSw) {
    const message = `[I18N_MISSING_KEY] ${key} | en:${!!existsInEn} sw:${!!existsInSw}`;

    if (process.env.NODE_ENV === "development") {
      throw new Error(message);
    } else {
      console.error(message);
    }
  }
}

module.exports = {
  validateLocaleKey,
};
