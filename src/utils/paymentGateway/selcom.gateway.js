const axios = require("axios");
const crypto = require("crypto");
const AppError = require("../AppError");
const health = require("./gateway.health");

/**
 * =====================================================
 * SELCOM GATEWAY
 * =====================================================
 */

const {
  SELCOM_BASE_URL,
  SELCOM_API_KEY,
  SELCOM_API_SECRET,
  SELCOM_VENDOR_ID,
  SELCOM_CALLBACK_URL,
} = process.env;

/**
 * Validate config only when used
 */
const validateConfig = () => {
  const required = [
    SELCOM_BASE_URL,
    SELCOM_API_KEY,
    SELCOM_API_SECRET,
    SELCOM_VENDOR_ID,
    SELCOM_CALLBACK_URL,
  ];

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
    .createHmac("sha256", SELCOM_API_SECRET)
    .update(dataString)
    .digest("hex");
};

/**
 * Initiate Payment
 */
exports.initiate = async ({ amount, reference, businessId }) => {
  validateConfig();

  const payload = {
    vendor: SELCOM_VENDOR_ID,
    order_id: reference,
    buyer_email: "no-reply@yourapp.com",
    buyer_name: `Business-${businessId}`,
    buyer_phone: "0000000000",
    amount,
    currency: "TZS",
    callback_url: SELCOM_CALLBACK_URL,
  };

  const checksum = generateChecksum(payload);

  try {
    const response = await axios.post(
      `${SELCOM_BASE_URL}/checkout/create-order`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${SELCOM_API_KEY}`,
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
  } catch (error) {
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
  if (!SELCOM_API_SECRET) return false;

  const checksum = generateChecksum(payload);
  return checksum === signature;
};
