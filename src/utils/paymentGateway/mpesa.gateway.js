const axios = require("axios");
const AppError = require("../AppError");
const health = require("./gateway.health");

/**
 * =====================================================
 * MPESA STK PUSH GATEWAY
 * =====================================================
 */

const {
  MPESA_BASE_URL,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
} = process.env;

/**
 * Validate config only when used
 */
const validateConfig = () => {
  const required = [
    MPESA_BASE_URL,
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_SHORTCODE,
    MPESA_PASSKEY,
    MPESA_CALLBACK_URL,
  ];

  if (required.some((v) => !v)) {
    throw new AppError("payment.mpesa_config_missing", 500);
  }
};

/**
 * Generate Mpesa Access Token
 */
const getAccessToken = async () => {
  const auth = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`,
  ).toString("base64");

  try {
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        timeout: 10000,
      },
    );

    return response.data.access_token;
  } catch (error) {
    await health.markDown("MPESA");
    throw new AppError("payment.mpesa_auth_failed", 502);
  }
};

/**
 * Generate timestamp
 */
const getTimestamp = () => {
  const date = new Date();

  return (
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0") +
    String(date.getHours()).padStart(2, "0") +
    String(date.getMinutes()).padStart(2, "0") +
    String(date.getSeconds()).padStart(2, "0")
  );
};

/**
 * Generate password
 */
const generatePassword = (timestamp) => {
  return Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString(
    "base64",
  );
};

/**
 * Initiate STK Push
 */
exports.initiate = async ({ amount, reference, businessId }) => {
  validateConfig();

  try {
    const accessToken = await getAccessToken();

    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: MPESA_SHORTCODE,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: MPESA_SHORTCODE,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: reference,
      TransactionDesc: `Subscription-${businessId}`,
    };

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      },
    );

    await health.markHealthy("MPESA");

    return {
      provider: "MPESA",
      message: "STK Push initiated",
      reference,
      amount,
      raw: response.data,
    };
  } catch (error) {
    await health.markDown("MPESA");

    if (error.response) {
      throw new AppError("payment.mpesa_request_failed", 502);
    }

    throw new AppError("payment.mpesa_unreachable", 503);
  }
};
