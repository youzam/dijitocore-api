const axios = require('axios');
const crypto = require('crypto');
// const prisma = require('../../config/prisma');
const AppError = require('../AppError');
// const health = require('./gateway.health');
const env = require('../../config/env');

/**
 * =====================================================
 * SELCOM GATEWAY
 * =====================================================
 */

const {
  isLive,
  sandboxBaseUrl,
  liveBaseUrl,
  apiKey,
  apiSecret,
  vendorId,
  callbackUrl,
} = env.payments.selcom;

const baseUrl = isLive ? liveBaseUrl : sandboxBaseUrl;

/**
 * Validate config only when used
 */
const validateConfig = () => {
  const required = [baseUrl, apiKey, apiSecret, vendorId, callbackUrl];

  if (required.some((v) => !v)) {
    throw new AppError('payment.selcom_config_missing', 500);
  }
};

/**
 * Generate HMAC checksum
 */
const generateChecksum = (payload) => {
  const sortedKeys = Object.keys(payload).sort();

  const dataString = sortedKeys
    .map((key) => `${key}=${payload[key]}`)
    .join('&');

  return crypto
    .createHmac('sha256', apiSecret)
    .update(dataString)
    .digest('hex');
};

/**
 * Initiate Payment
 */
exports.initiate = async ({ amount, reference, business, phone }) => {
  try {
    const selcomConfig = env.payments.selcom;

    const baseUrl = selcomConfig.isLive
      ? selcomConfig.liveBaseUrl
      : selcomConfig.sandboxBaseUrl;

    const payload = {
      merchant_id: selcomConfig.vendorId,
      order_id: reference,
      amount: Number(amount),
      currency: 'TZS',
      customer_email: business?.email || 'no-reply@dijitopay.com',
      customer_phone: phone.startsWith('255')
        ? phone
        : `255${phone.replace(/^0/, '')}`,

      callback_url: selcomConfig.callbackUrl,
      cancel_url: 'https://dijitopay.com/payment-cancelled',
      success_url: 'https://dijitopay.com/payment-success',
    };

    const signature = crypto
      .createHmac('sha256', selcomConfig.apiSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    console.log('SELCOM PAYLOAD:', payload);

    const response = await axios.post(`${baseUrl}/checkout/create`, payload, {
      headers: {
        'Content-Type': 'application/json',

        Authorization: `Bearer ${selcomConfig.apiKey}`,

        Digest: signature,
      },

      timeout: 15000,
    });

    console.log('SELCOM RESPONSE:', response.data);

    return {
      success: true,
      gateway: 'SELCOM',
      reference,

      response: response.data,

      checkoutUrl:
        response.data?.data?.checkout_url ||
        response.data?.checkout_url ||
        null,

      raw: response.data,
    };
  } catch (error) {
    console.log('GATEWAY ERROR:', error.response?.data || error.message);

    throw new AppError('payment.gateway_request_failed', 500);
  }
};

/**
 * Verify Webhook Signature
 */
exports.verifyWebhook = (payload, signature) => {
  console.log(`[SELCOM ${isLive ? 'LIVE' : 'SANDBOX'} WEBHOOK]`);

  if (!apiSecret) return false;

  const checksum = generateChecksum(payload);
  return checksum === signature;
};
