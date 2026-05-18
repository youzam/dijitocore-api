const required = (key) => {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required env variable: ${key}`);
  }
  return process.env[key];
};

const optional = (key, defaultValue = null) => {
  return process.env[key] || defaultValue;
};

const isProd = optional('NODE_ENV', 'development') === 'production';

/* ========================
   CORE
======================== */
const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),

  server: {
    port: optional('PORT', 5000),
  },

  database: {
    url: required('DATABASE_URL'),
  },

  /* ========================
     AUTH
  ======================== */
  auth: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  /* ========================
     FRONTEND
  ======================== */
  frontend: {
    url: optional('FRONTEND_URL'),
    baseDomainCom: optional('BASE_DOMAIN_COM'),
    baseDomainTz: optional('BASE_DOMAIN_TZ'),
  },

  /* ========================
     EMAIL
  ======================== */
  email: {
    provider: optional('EMAIL_PROVIDER', 'console'),
    from: optional('EMAIL_FROM'),
    sendgridKey: optional('SENDGRID_API_KEY'),
  },

  /* ========================
     SMS
  ======================== */
  sms: {
    provider: optional('SMS_PROVIDER', 'console'),
    from: optional('SMS_FROM'),
    beemKey: optional('BEEM_API_KEY'),
    beemSecret: optional('BEEM_SECRET'),
  },

  /* ========================
     REDIS
  ======================== */
  redis: {
    host: optional('REDIS_HOST'),
    port: optional('REDIS_PORT'),
    password: optional('REDIS_PASSWORD'),
    db: optional('REDIS_DB'),
    tls: optional('REDIS_TLS') === 'true',
    url: optional('REDIS_URL'),
  },

  /* ========================
     FIREBASE
  ======================== */
  firebase: {
    projectId: optional('FIREBASE_PROJECT_ID'),
    clientEmail: optional('FIREBASE_CLIENT_EMAIL'),
    privateKey: optional('FIREBASE_PRIVATE_KEY')
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null,
  },

  /* ========================
     TWILIO
  ======================== */
  twilio: {
    accountSid: optional('TWILIO_ACCOUNT_SID'),
    authToken: optional('TWILIO_AUTH_TOKEN'),
    whatsappFrom: optional('TWILIO_WHATSAPP_FROM'),
  },

  /* ========================
     WEBHOOKS
  ======================== */
  webhooks: {
    payment: {
      ipMode: optional('PAYMENT_WEBHOOK_IP_MODE', 'DISABLED'),
      ips: optional('PAYMENT_WEBHOOK_IPS'),
      secret: optional('PAYMENT_WEBHOOK_SECRET'),
    },
    gatewaySecret: optional('GATEWAY_WEBHOOK_SECRET'),
  },

  /* ========================
     JOBS
  ======================== */
  jobs: {
    instanceId: optional('INSTANCE_ID'),
    alertWebhook: optional('JOB_ALERT_WEBHOOK'),
  },

  /* ========================
     PAYMENTS
  ======================== */
  payments: {
    mpesa: {
      baseUrl: optional('MPESA_BASE_URL'),
      consumerKey: optional('MPESA_CONSUMER_KEY'),
      consumerSecret: optional('MPESA_CONSUMER_SECRET'),
      shortcode: optional('MPESA_SHORTCODE'),
      passkey: optional('MPESA_PASSKEY'),
      callbackUrl: optional('MPESA_CALLBACK_URL'),
    },

    selcom: {
      apiKey: required('SELCOM_API_KEY'),
      apiSecret: required('SELCOM_API_SECRET'),
      vendorId: required('SELCOM_VENDOR_ID'),
      isLive: optional('SELCOM_IS_LIVE', 'false') === 'true',
      sandboxBaseUrl: optional(
        'SELCOM_SANDBOX_BASE_URL',
        'https://apigw.selcommobile.com/v1',
      ),

      liveBaseUrl: optional(
        'SELCOM_LIVE_BASE_URL',
        'https://apigw.selcommobile.com/v1',
      ),

      callbackUrl: required('SELCOM_CALLBACK_URL'),
    },

    airtel: {
      baseUrl: optional('AIRTEL_BASE_URL'),
      clientId: optional('AIRTEL_CLIENT_ID'),
      clientSecret: optional('AIRTEL_CLIENT_SECRET'),
      merchantId: optional('AIRTEL_MERCHANT_ID'),
      callbackUrl: optional('AIRTEL_CALLBACK_URL'),
    },
  },

  /* ========================
     STORAGE
  ======================== */
  storage: {
    provider: optional('STORAGE_PROVIDER', 'local'),
    path: optional('STORAGE_PATH', 'uploads'),

    aws: {
      region: optional('AWS_REGION'),
      accessKeyId: optional('AWS_ACCESS_KEY_ID'),
      secretAccessKey: optional('AWS_SECRET_ACCESS_KEY'),
      bucketDev: optional('AWS_S3_BUCKET_DEV'),
      bucketProd: optional('AWS_S3_BUCKET_PROD'),
    },
  },
};

/* ========================
   HELPERS
======================== */
env.getS3Bucket = () => {
  return isProd ? env.storage.aws.bucketProd : env.storage.aws.bucketDev;
};

if (!env.database.url) {
  throw new Error('❌ DATABASE_URL missing');
}

if (!env.auth.accessSecret) {
  throw new Error('❌ JWT_ACCESS_SECRET missing');
}

module.exports = env;
