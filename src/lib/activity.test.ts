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
  checkMagicLinkRateLimit,
  hashActivityValue,
  sanitizeActivityMetadata,
} from "@/lib/activity";

afterEach(() => {
  getRedis.mockReset();
});

describe("sanitizeActivityMetadata", () => {
  it("removes sensitive fields and redacts raw identifiers", () => {
    const sanitized = sanitizeActivityMetadata({
      buttonId: "save-research",
      email: "investor@example.com",
      token: "a".repeat(64),
      nested: {
        path: "/api/auth/callback/email?token=secret",
        count: 2,
        ip: "127.0.0.1",
      },
      value: "typed search text",
    });

    expect(sanitized).toEqual({
      buttonId: "save-research",
      nested: {
        count: 2,
        ip: "[redacted]",
      },
    });
  });

  it("hashes activity values with a stable non-raw prefix", () => {
    expect(hashActivityValue("User@Example.com")).toMatch(/^sha256:/);
    expect(hashActivityValue("User@Example.com")).toBe(
      hashActivityValue(" user@example.com "),
    );
  });
});

describe("checkMagicLinkRateLimit", () => {
  it("allows requests when Redis is not configured", async () => {
    getRedis.mockReturnValueOnce(null);

    await expect(
      checkMagicLinkRateLimit({ email: "user@example.com" }),
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("blocks after the per-email hourly limit", async () => {
    const redis = {
      status: "ready",
      incr: vi.fn().mockResolvedValueOnce(6),
      expire: vi.fn(),
    };
    getRedis.mockReturnValueOnce(redis);

    await expect(
      checkMagicLinkRateLimit({ email: "user@example.com" }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 3600 });
    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining("finari:magic-link:email:sha256:"),
    );
  });
});
