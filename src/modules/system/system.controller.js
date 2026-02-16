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

exports.updateActiveGateway = catchAsync(async (req, res) => {
  const { activePaymentGateway } = req.body;

  const allowed = ["SELCOM", "MPESA", "AIRTEL"];

  if (!allowed.includes(activePaymentGateway)) {
    throw new AppError("payment.invalid_gateway", 400);
  }

  await prisma.systemSetting.updateMany({
    data: { activePaymentGateway },
  });

  return res.status(200).json({
    message: "Gateway updated",
  });
});
