const AppError = require("../utils/AppError");

module.exports = (req, res, next) => {
  next(new AppError("general.not_found", 404));
};
