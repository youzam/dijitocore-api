const Redis = require("ioredis");
const env = require("../config/env");

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

const isProduction = env.NODE_ENV !== "development";

if (isProduction) {
  /**
   * ===================================================
   * PRODUCTION (Managed Redis: Redis Cloud, Upstash, etc.)
   * ===================================================
   */
  if (!env.redis.url) {
    throw new Error("REDIS_URL is required in production");
  }

  const isTLS = env.redis.url.startsWith("rediss://");

  redis = new Redis(env.redis.url, {
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
    host: env.redis.host || "127.0.0.1",
    port: env.redis.port ? Number(env.redis.port) : 6379,
    password: env.redis.password || undefined,
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
