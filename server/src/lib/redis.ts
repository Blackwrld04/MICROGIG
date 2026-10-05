import { Redis } from "ioredis";
import { env } from "../env.js";

let redisClient: Redis | null = null;
let redisInitialized = false;

export function getRedisClient(): Redis | null {
  if (redisInitialized) {
    return redisClient;
  }
  redisInitialized = true;

  if (!env.REDIS_URL) {
    return null;
  }

  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying if Redis is unreachable
        }
        return Math.min(times * 200, 1000);
      },
    });

    client.on("error", (err) => {
      console.warn(`[Redis] Connection warning: ${err.message}`);
    });

    client.connect().catch((err) => {
      console.warn(`[Redis] Failed initial connection (${err.message}). Falling back to memory store.`);
    });

    redisClient = client;
    return redisClient;
  } catch (err: any) {
    console.warn(`[Redis] Initialization failed (${err?.message}). Falling back to memory store.`);
    redisClient = null;
    return null;
  }
}
