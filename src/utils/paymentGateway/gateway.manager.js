const AppError = require('../AppError');

const selcomGateway = require('./selcom.gateway');
const mpesaGateway = require('./mpesa.gateway');
const airtelGateway = require('./airtel.gateway');

/**
 * =====================================================
 * GATEWAY MANAGER
 * Manual provider routing only
 * =====================================================
 */
exports.initiate = async ({
  gateway,
  amount,
  reference,
  business,
  user,
  phone,
}) => {
  if (!gateway) {
    throw new AppError('payment.no_gateway', 500);
  }

  const payload = {
    gateway,
    amount,
    reference,
    business,
    user,
    phone,
  };

  switch (gateway) {
    case 'SELCOM':
      return selcomGateway.initiate(payload);

    case 'MPESA':
      return mpesaGateway.initiate(payload);

    case 'AIRTEL':
      return airtelGateway.initiate(payload);

    default:
      throw new AppError('payment.invalid_gateway', 500);
  }
};
