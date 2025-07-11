// src/redis.ts
import Redis, { RedisOptions } from "ioredis"
import config from "../conf/conf"

// Use the configured ping timeout (fallback to 10s)
const RETRY_INTERVAL = config.redis.pingTimeout ?? 10_000

const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  // Delay actual TCP connect until we call .connect()
  lazyConnect: true,
  // Queue commands while not connected
  enableOfflineQueue: true,
  // Never fail individual commands; we handle errors in our retry logic
  maxRetriesPerRequest: null,
  // Retry connecting every RETRY_INTERVAL milliseconds
  retryStrategy() {
    return RETRY_INTERVAL
  },
}

let redisClient: Redis | undefined

/**
 * Factory that only creates the Redis instance when first needed.
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    console.log("🔥 Instantiating Redis client")
    redisClient = new Redis(redisOptions)

    // attach your handlers
    redisClient.on("error", (err) => {
      console.warn("⚠️ Redis error:", err.message)
    })
    redisClient.on("connect", () => {
      console.log(
        "✅ Connected to Redis:",
        config.redis.host,
        config.redis.port,
      )
    })
    redisClient.on("end", () => {
      console.warn(
        `⚠️ Redis connection closed, will retry in ${RETRY_INTERVAL / 1000}s`,
      )
    })
  }
  return redisClient
}

/**
 * Attempt to connect if not already connecting/connected.
 * On failure, schedule another retry in RETRY_INTERVAL ms.
 */
export async function connectToRedis(): Promise<void> {
  let attempts = 0

  const pingRetryDelay = config.redis.pingRetryDelay ?? RETRY_INTERVAL
  const pingRetries = config.redis.pingRetries ?? 5

  while (attempts < pingRetries) {
    attempts++
    try {
      await getRedisClient().connect()
      return // success!
    } catch {
      console.warn(`⚠️ Redis not ready (attempt ${attempts}/${pingRetries})`)
      await new Promise((r) => setTimeout(r, pingRetryDelay))
    }
  }

  // if we get here, Redis is still unreachable
  throw new Error(
    `❌ Unable to connect to Redis after ${pingRetries} attempts`,
  )
}

// Export only the factory and the explicit connect()
// Code that uses Redis must call connectToRedis() first!
export { getRedisClient as redisClient }
export const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
}
