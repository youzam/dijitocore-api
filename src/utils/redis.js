const Redis = require("ioredis");

/**
 * =====================================================
 * REDIS CLIENT (ENV-AWARE, SAFE)
 * =====================================================
 *
 * Rules:
 * - NODE_ENV === "production"  → use REDIS_URL (managed Redis)
 * - NODE_ENV !== "production"  → use local Redis (host/port)
 *
 * This prevents accidental connection to PROD Redis
 * while developing locally with a shared .env file.
 */

let redis;

const isProduction = process.env.NODE_ENV !== "development";

if (isProduction) {
  /**
   * ===================================================
   * PRODUCTION (Managed Redis: Redis Cloud, Upstash, etc.)
   * ===================================================
   */
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required in production");
  }

  const isTLS = process.env.REDIS_URL.startsWith("rediss://");

  redis = new Redis(process.env.REDIS_URL, {
    tls: isTLS ? {} : undefined,
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
} else {
  /**
   * ===================================================
   * DEVELOPMENT / STAGING (Local Redis)
   * ===================================================
   */
  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
  });
}

/**
 * =====================================================
 * EVENTS (VISIBILITY, NOT NOISE)
 * =====================================================
 */

redis.on("connect", () => {
  console.log(
    isProduction
      ? "✅ Redis connected (production)"
      : "✅ Redis connected (development)",
  );
});

redis.on("ready", () => {
  console.log("🚀 Redis ready");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

module.exports = redis;
