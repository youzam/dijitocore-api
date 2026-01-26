module.exports = (req, res, next) => {
  const headerLang = req.headers["accept-language"];

  if (headerLang && headerLang.toLowerCase().startsWith("sw")) {
    req.locale = "sw";
  } else {
    req.locale = "en";
  }

  next();
};
