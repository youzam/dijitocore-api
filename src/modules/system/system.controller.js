const catchAsync = require("../../utils/catchAsync");
const { bootstrapSystemService } = require("./system.service");

exports.bootstrapSystem = catchAsync(async (req, res) => {
  const { email, password, currency = "TZS", trialDays = 14 } = req.body;

  await bootstrapSystemService({
    email,
    password,
    currency,
    trialDays,
  });

  res.status(201).json({
    success: true,
    message: "System bootstrapped successfully",
  });
});
