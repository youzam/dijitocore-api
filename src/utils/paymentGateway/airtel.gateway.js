const axios = require("axios");
const crypto = require("crypto");
const AppError = require("../AppError");
const health = require("./gateway.health");
const env = require("../../config/env");

/**
 * =====================================================
 * AIRTEL MONEY GATEWAY
 * =====================================================
 */

const { baseUrl, clientId, clientSecret, merchantId, callbackUrl } =
  env.payments.airtel;
/**
 * Validate config when used
 */
const validateConfig = () => {
  const required = [baseUrl, clientId, clientSecret, merchantId, callbackUrl];

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
      `${baseUrl}/auth/oauth2/token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
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
exports.initiate = async ({ amount, reference, businessId, phone }) => {
  validateConfig();

  try {
    const token = await getAccessToken();

    const payload = {
      reference,
      subscriber: {
        country: "TZ",
        currency: "TZS",
        msisdn: phone,
      },
      transaction: {
        amount,
        country: "TZ",
        currency: "TZS",
        id: reference,
      },
      callback_url: callbackUrl,
    };

    const response = await axios.post(
      `${baseUrl}/merchant/v1/payments`,
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
      type: "STK_PUSH",
      provider: "AIRTEL",
      message: "Check your phone",
    };
  } catch (error) {
    await health.markDown("AIRTEL");

    if (error.response) {
      throw new AppError("payment.airtel_request_failed", 502);
    }

    throw new AppError("payment.airtel_unreachable", 503);
  }
};
