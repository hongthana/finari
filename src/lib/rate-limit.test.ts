import { afterEach, describe, expect, it, vi } from "vitest";

const getRedis = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cache")>();
  return {
    ...actual,
    getRedis,
  };
});

import {
  checkRateLimit,
  rateLimitResponse,
  requireRequestRateLimit,
  requireUserRateLimit,
} from "@/lib/rate-limit";

afterEach(() => {
  getRedis.mockReset();
});

describe("checkRateLimit", () => {
  it("allows requests when Redis is not configured", async () => {
    getRedis.mockReturnValueOnce(null);

    await expect(
      checkRateLimit("user:user_1", {
        scope: "test",
        limit: 2,
        windowSeconds: 60,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 2,
      retryAfterSeconds: 0,
    });
  });

  it("blocks when the subject exceeds the configured window limit", async () => {
    const redis = {
      status: "ready",
      incr: vi.fn().mockResolvedValueOnce(3),
      expire: vi.fn(),
    };
    getRedis.mockReturnValueOnce(redis);

    const result = await checkRateLimit("user:user_1", {
      scope: "test",
      limit: 2,
      windowSeconds: 60,
    });

    expect(result).toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining("finari:rate-limit:test:"),
    );
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it("sets the window ttl for a new counter", async () => {
    const redis = {
      status: "ready",
      incr: vi.fn().mockResolvedValueOnce(1),
      expire: vi.fn().mockResolvedValueOnce(1),
    };
    getRedis.mockReturnValueOnce(redis);

    await checkRateLimit("user:user_1", {
      scope: "test",
      limit: 2,
      windowSeconds: 60,
    });

    expect(redis.expire).toHaveBeenCalledWith(
      expect.stringContaining("finari:rate-limit:test:"),
      60,
    );
  });
});

describe("rate limit guards", () => {
  it("returns a 429 response with retry headers", async () => {
    const response = rateLimitResponse({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 60,
      resetSeconds: 60,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    await expect(response.json()).resolves.toEqual({
      error: "Too many requests. Please try again shortly.",
      retryAfterSeconds: 60,
    });
  });

  it("uses signed-in user ids as rate-limit subjects", async () => {
    const redis = {
      status: "ready",
      incr: vi.fn().mockResolvedValueOnce(2),
      expire: vi.fn(),
    };
    getRedis.mockReturnValueOnce(redis);

    await expect(
      requireUserRateLimit("user_1", {
        scope: "test",
        limit: 1,
        windowSeconds: 60,
      }),
    ).resolves.toBeInstanceOf(Response);
  });

  it("uses request context as the anonymous fallback subject", async () => {
    const redis = {
      status: "ready",
      incr: vi.fn().mockResolvedValueOnce(1),
      expire: vi.fn(),
    };
    getRedis.mockReturnValueOnce(redis);

    await expect(
      requireRequestRateLimit(
        new Request("https://www.finari.co/api/search?q=AAPL", {
          headers: { "x-forwarded-for": "203.0.113.10" },
        }),
        {
          scope: "test",
          limit: 1,
          windowSeconds: 60,
        },
      ),
    ).resolves.toBeNull();
  });
});
