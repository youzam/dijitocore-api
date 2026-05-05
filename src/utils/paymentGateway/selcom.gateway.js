const axios = require("axios");
const crypto = require("crypto");
const AppError = require("../AppError");
const health = require("./gateway.health");
const env = require("../../config/env");

/**
 * =====================================================
 * SELCOM GATEWAY
 * =====================================================
 */

const { baseUrl, apiKey, apiSecret, vendorId, callbackUrl } =
  env.payments.selcom;
/**
 * Validate config only when used
 */
const validateConfig = () => {
  const required = [baseUrl, apiKey, apiSecret, vendorId, callbackUrl];

  if (required.some((v) => !v)) {
    throw new AppError("payment.selcom_config_missing", 500);
  }
};

/**
 * Generate HMAC checksum
 */
const generateChecksum = (payload) => {
  const sortedKeys = Object.keys(payload).sort();

  const dataString = sortedKeys
    .map((key) => `${key}=${payload[key]}`)
    .join("&");

  return crypto
    .createHmac("sha256", apiSecret)
    .update(dataString)
    .digest("hex");
};

/**
 * Initiate Payment
 */
exports.initiate = async ({ amount, reference, businessId }) => {
  validateConfig();

  const payload = {
    vendor: vendorId,
    order_id: reference,
    buyer_email: "no-reply@yourapp.com",
    buyer_name: `Business-${businessId}`,
    buyer_phone: "0000000000",
    amount,
    currency: "TZS",
    callback_url: callbackUrl,
  };

  const checksum = generateChecksum(payload);

  try {
    const response = await axios.post(
      `${baseUrl}/checkout/create-order`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Checksum": checksum,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    if (!response.data || !response.data.checkout_url) {
      await health.markDown("SELCOM");
      throw new AppError("payment.selcom_invalid_response", 502);
    }

    await health.markHealthy("SELCOM");

    return {
      provider: "SELCOM",
      checkoutUrl: response.data.checkout_url,
      reference,
      amount,
    };
  } catch (error)  {
    await health.markDown("SELCOM");

    if (error.response) {
      throw new AppError("payment.selcom_request_failed", 502);
    }

    throw new AppError("payment.selcom_unreachable", 503);
  }
};

/**
 * Verify Webhook Signature
 */
exports.verifyWebhook = (payload, signature) => {
  if (!apiSecret) return false;

  const checksum = generateChecksum(payload);
  return checksum === signature;
};
