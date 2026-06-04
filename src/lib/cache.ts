import crypto from "node:crypto";
import Redis from "ioredis";

const cacheState = globalThis as typeof globalThis & {
  __finariRedis?: Redis;
};

function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

export function hasRedis(): boolean {
  return Boolean(getRedisUrl());
}

export function getRedis(): Redis | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  if (!cacheState.__finariRedis) {
    cacheState.__finariRedis = new Redis(redisUrl, {
      connectTimeout: 5_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    cacheState.__finariRedis.on("error", () => {
      // Redis is an optimization. Route handlers should keep serving from Postgres/SEC.
    });
  }

  return cacheState.__finariRedis;
}

export function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function cacheKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map((part) => String(part).replace(/[^a-zA-Z0-9:_-]/g, "_"))
    .join(":");
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function setJsonCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    return;
  }
}

export async function withRedisLock<T>(
  key: string,
  ttlSeconds: number,
  work: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis) {
    return work();
  }

  const token = crypto.randomUUID();
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const acquired = await redis.set(key, token, "EX", ttlSeconds, "NX");
    if (!acquired) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return work();
    }

    try {
      return await work();
    } finally {
      const current = await redis.get(key);
      if (current === token) {
        await redis.del(key);
      }
    }
  } catch {
    return work();
  }
}
