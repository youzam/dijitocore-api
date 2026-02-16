const AppError = require("../AppError");

const selcomGateway = require("./selcom.gateway");
const mpesaGateway = require("./mpesa.gateway");
const airtelGateway = require("./airtel.gateway");

/**
 * =====================================================
 * GATEWAY MANAGER
 * Manual provider routing only
 * =====================================================
 */
exports.initiate = async ({ provider, amount, reference, businessId }) => {
  if (!provider) {
    throw new AppError("payment.no_provider", 500);
  }

  switch (provider) {
    case "SELCOM":
      return selcomGateway.initiate({
        amount,
        reference,
        businessId,
      });

    case "MPESA":
      return mpesaGateway.initiate({
        amount,
        reference,
        businessId,
      });

    case "AIRTEL":
      return airtelGateway.initiate({
        amount,
        reference,
        businessId,
      });

    default:
      throw new AppError("payment.invalid_gateway", 500);
  }
};
