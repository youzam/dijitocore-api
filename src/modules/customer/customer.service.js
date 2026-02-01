const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");

exports.createCustomer = async (businessId, payload) => {
  const exists = await prisma.customer.findFirst({
    where: {
      phone: payload.phone,
      businessId,
    },
  });

  if (exists) {
    throw new AppError("customers.already_exists", 409);
  }

  const customer = await prisma.customer.create({
    data: {
      ...payload,
      businessId,
      status: "ACTIVE",
    },
  });

  return customer;
};
