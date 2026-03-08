const prisma = require("../../../config/prisma");
const AppError = require("../../../utils/AppError");

exports.updateBusinessStatus = async (businessId, status) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError("business.notFound", 404);
  }

  if (business.status === "TERMINATED") {
    throw new AppError("business.alreadyTerminated", 400);
  }

  const allowedTransitions = {
    PENDING: ["ACTIVE", "TERMINATED"],
    ACTIVE: ["GRACE", "TERMINATED"],
    GRACE: ["ACTIVE", "SUSPENDED"],
    SUSPENDED: ["ACTIVE", "TERMINATED"],
    TERMINATED: [],
  };

  if (!allowedTransitions[business.status]?.includes(status)) {
    throw new AppError("business.invalidTransition", 400);
  }

  return prisma.business.update({
    where: { id: businessId },
    data: { status },
  });
};
