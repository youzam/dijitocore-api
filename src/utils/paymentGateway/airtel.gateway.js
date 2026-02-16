const axios = require("axios");
const crypto = require("crypto");
const AppError = require("../AppError");
const health = require("./gateway.health");

/**
 * =====================================================
 * AIRTEL MONEY GATEWAY
 * =====================================================
 */

const {
  AIRTEL_BASE_URL,
  AIRTEL_CLIENT_ID,
  AIRTEL_CLIENT_SECRET,
  AIRTEL_MERCHANT_ID,
  AIRTEL_CALLBACK_URL,
} = process.env;

/**
 * Validate config when used
 */
const validateConfig = () => {
  const required = [
    AIRTEL_BASE_URL,
    AIRTEL_CLIENT_ID,
    AIRTEL_CLIENT_SECRET,
    AIRTEL_MERCHANT_ID,
    AIRTEL_CALLBACK_URL,
  ];

  if (required.some((v) => !v)) {
    throw new AppError("payment.airtel_config_missing", 500);
  }
};

/**
 * Generate Airtel access token
 */
const getAccessToken = async () => {
  try {
    const response = await axios.post(
      `${AIRTEL_BASE_URL}/auth/oauth2/token`,
      {
        client_id: AIRTEL_CLIENT_ID,
        client_secret: AIRTEL_CLIENT_SECRET,
        grant_type: "client_credentials",
      },
      { timeout: 10000 },
    );

    return response.data.access_token;
  } catch (error) {
    await health.markDown("AIRTEL");
    throw new AppError("payment.airtel_auth_failed", 502);
  }
};

/**
 * Initiate Airtel Payment
 */
exports.initiate = async ({ amount, reference, businessId }) => {
  validateConfig();

  try {
    const token = await getAccessToken();

    const payload = {
      reference,
      subscriber: {
        country: "TZ",
        currency: "TZS",
        msisdn: AIRTEL_MERCHANT_ID,
      },
      transaction: {
        amount,
        country: "TZ",
        currency: "TZS",
        id: reference,
      },
      callback_url: AIRTEL_CALLBACK_URL,
    };

    const response = await axios.post(
      `${AIRTEL_BASE_URL}/merchant/v1/payments`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    await health.markHealthy("AIRTEL");

    return {
      provider: "AIRTEL",
      message: "Airtel payment initiated",
      reference,
      amount,
      raw: response.data,
    };
  } catch (error) {
    await health.markDown("AIRTEL");

    if (error.response) {
      throw new AppError("payment.airtel_request_failed", 502);
    }

    throw new AppError("payment.airtel_unreachable", 503);
  }
};
