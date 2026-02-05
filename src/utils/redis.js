const Redis = require("ioredis");

let redis = null;

const isEnabled = process.env.REDIS_ENABLED === "true";

if (isEnabled) {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      tls: process.env.REDIS_TLS === "true" ? {} : undefined,
      maxRetriesPerRequest: 1,
    });

    redis.on("connect", () => {
      console.log(`Redis connected (${process.env.NODE_ENV})`);
    });

    redis.on("error", (err) => {
      console.warn("Redis error – fallback to DB", err.message);
    });
  } catch (err) {
    console.warn("Redis init failed – fallback to DB");
    redis = null;
  }
} else {
  console.log("Redis disabled by env");
}

module.exports = redis;
