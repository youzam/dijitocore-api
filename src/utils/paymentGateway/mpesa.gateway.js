const axios = require('axios');
const AppError = require('../AppError');
const health = require('./gateway.health');
const env = require('../../config/env');

/**
 * =====================================================
 * MPESA STK PUSH GATEWAY
 * =====================================================
 */

const {
  baseUrl,
  consumerKey,
  consumerSecret,
  shortcode,
  passkey,
  callbackUrl,
} = env.payments.mpesa;
/**
 * Validate config only when used
 */
const validateConfig = () => {
  const required = [
    baseUrl,
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    callbackUrl,
  ];

  if (required.some((v) => !v)) {
    throw new AppError('payment.mpesa_config_missing', 500);
  }
};

/**
 * Generate Mpesa Access Token
 */
const getAccessToken = async () => {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    'base64',
  );

  try {
    const response = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        timeout: 10000,
      },
    );

    return response.data.access_token;
  } catch {
    await health.markDown('MPESA');
    throw new AppError('payment.mpesa_auth_failed', 502);
  }
};

/**
 * Generate timestamp
 */
const getTimestamp = () => {
  const date = new Date();

  return (
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0')
  );
};

/**
 * Generate password
 */
const generatePassword = (timestamp) => {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
};

/**
 * Initiate STK Push
 */
exports.initiate = async ({ amount, reference, businessId, phone }) => {
  validateConfig();

  try {
    const accessToken = await getAccessToken();

    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: reference,
      TransactionDesc: `Subscription-${businessId}`,
    };

    await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });

    await health.markHealthy('MPESA');

    return {
      type: 'STK_PUSH',
      provider: 'MPESA',
      message: 'Check your phone',
    };
  } catch (error) {
    await health.markDown('MPESA');

    if (error.response) {
      throw new AppError('payment.mpesa_request_failed', 502);
    }

    throw new AppError('payment.mpesa_unreachable', 503);
  }
};
