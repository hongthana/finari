import { activityRequestContext } from "@/lib/activity";
import { cacheKey, getRedis, stableHash } from "@/lib/cache";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetSeconds: number;
};

export type RateLimitPolicy = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  userApi: { scope: "user-api", limit: 120, windowSeconds: 60 },
  userWrite: { scope: "user-write", limit: 40, windowSeconds: 60 },
  expensiveUser: { scope: "expensive-user", limit: 10, windowSeconds: 5 * 60 },
  anonymousRead: { scope: "anonymous-read", limit: 90, windowSeconds: 60 },
  anonymousWrite: { scope: "anonymous-write", limit: 20, windowSeconds: 60 },
} satisfies Record<string, RateLimitPolicy>;

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function bucketKey(policy: RateLimitPolicy, subject: string): string {
  const windowSeconds = positiveInteger(policy.windowSeconds, 60);
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  return cacheKey([
    "finari",
    "rate-limit",
    policy.scope,
    stableHash(subject),
    bucket,
  ]);
}

export async function checkRateLimit(
  subject: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const limit = positiveInteger(policy.limit, 1);
  const windowSeconds = positiveInteger(policy.windowSeconds, 60);
  const redis = getRedis();

  if (!redis) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      retryAfterSeconds: 0,
      resetSeconds: windowSeconds,
    };
  }

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    const key = bucketKey({ ...policy, limit, windowSeconds }, subject);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(limit - count, 0);
    const allowed = count <= limit;
    return {
      allowed,
      limit,
      remaining,
      retryAfterSeconds: allowed ? 0 : windowSeconds,
      resetSeconds: windowSeconds,
    };
  } catch {
    return {
      allowed: true,
      limit,
      remaining: limit,
      retryAfterSeconds: 0,
      resetSeconds: windowSeconds,
    };
  }
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: "Too many requests. Please try again shortly.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetSeconds),
      },
    },
  );
}

export async function requireUserRateLimit(
  userId: string,
  policy: RateLimitPolicy,
): Promise<Response | null> {
  const result = await checkRateLimit(`user:${userId}`, policy);
  return result.allowed ? null : rateLimitResponse(result);
}

export async function requireRequestRateLimit(
  request: Request,
  policy: RateLimitPolicy,
): Promise<Response | null> {
  const context = activityRequestContext(request);
  const subject =
    context.ipHash ?? context.userAgentHash ?? `anonymous:${new URL(request.url).pathname}`;
  const result = await checkRateLimit(subject, policy);
  return result.allowed ? null : rateLimitResponse(result);
}
