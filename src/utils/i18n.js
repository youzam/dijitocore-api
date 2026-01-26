const fs = require("fs");
const path = require("path");

const locales = {};

const loadLocales = () => {
  const dir = path.join(__dirname, "../locales");

  fs.readdirSync(dir).forEach((file) => {
    if (file.endsWith(".json")) {
      const locale = file.replace(".json", "");
      locales[locale] = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf8"),
      );
    }
  });
};

loadLocales();

const getNestedValue = (obj, key) => {
  return key.split(".").reduce((o, k) => (o ? o[k] : null), obj);
};

const interpolate = (text, vars = {}) => {
  return text.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? "");
};

const translate = (key, locale = "en", vars = {}) => {
  const data = locales[locale] || locales.en;

  let value = getNestedValue(data, key);

  if (!value) return key;

  if (typeof value === "string") {
    return interpolate(value, vars);
  }

  return value;
};

module.exports = { translate };
