import crypto from "node:crypto";

import { and, asc, count, desc, eq, gte, ilike, lt, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { getDb, hasDatabase } from "@/db/client";
import { userActivityEvents, users } from "@/db/schema";
import { getRedis } from "@/lib/cache";
import { getActivityLogRetentionDays } from "@/lib/env";

export type ActivityCategory =
  | "auth"
  | "api"
  | "client"
  | "admin"
  | "workspace"
  | "research";

export type ActivityStatus = "ok" | "error" | "blocked";

export type ActivityEventInput = {
  userId?: string | null;
  email?: string | null;
  emailHash?: string | null;
  category: ActivityCategory;
  eventName: string;
  path?: string | null;
  method?: string | null;
  status?: number | ActivityStatus | null;
  locale?: string | null;
  ticker?: string | null;
  durationMs?: number | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ActivityRequestContext = {
  path?: string | null;
  method?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
};

export type ActivityFilters = {
  userId?: string;
  email?: string;
  category?: string;
  eventName?: string;
  path?: string;
  ticker?: string;
  status?: number;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

const HASH_PREFIX = "sha256:";
const MAX_METADATA_KEYS = 24;
const MAX_STRING_LENGTH = 180;
const MAX_ARRAY_ITEMS = 12;
const MAX_DEPTH = 3;
const SENSITIVE_KEY_PATTERN =
  /(authorization|body|cookie|csrf|email|input|link|magic|password|path|raw|secret|session|text|token|url|value)/i;
const TOKEN_LIKE_PATTERN =
  /(?:bearer\s+)?[a-z0-9_-]{24,}\.[a-z0-9_-]{10,}|[a-f0-9]{32,}|[A-Za-z0-9_-]{48,}/;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6_PATTERN = /\b(?:[a-f0-9]{0,4}:){2,}[a-f0-9]{0,4}\b/i;

function sha256(value: string): string {
  return `${HASH_PREFIX}${crypto.createHash("sha256").update(value).digest("hex")}`;
}

export function hashActivityValue(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? sha256(normalized) : null;
}

export function normalizeEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}

function normalizeStatus(value: ActivityEventInput["status"]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (value === "ok") {
    return 200;
  }

  if (value === "blocked") {
    return 429;
  }

  if (value === "error") {
    return 500;
  }

  return null;
}

function safeString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    TOKEN_LIKE_PATTERN.test(trimmed) ||
    /(?:\/api\/auth|token=|callback)/i.test(trimmed) ||
    IPV4_PATTERN.test(trimmed) ||
    IPV6_PATTERN.test(trimmed) ||
    trimmed.includes("@")
  ) {
    return "[redacted]";
  }

  return trimmed.slice(0, MAX_STRING_LENGTH);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    return "[truncated]";
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return safeString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue;
      }
      const sanitized = sanitizeValue(raw, depth + 1);
      if (sanitized !== undefined) {
        output[key.slice(0, 80)] = sanitized;
      }
    }
    return output;
  }

  return null;
}

export function sanitizeActivityMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!metadata) {
    return {};
  }
  const sanitized = sanitizeValue(metadata, 0);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
}

function forwardedIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

export function activityRequestContext(
  request: Request | { headers: Headers; url?: string; method?: string },
): ActivityRequestContext {
  const url = request.url ? new URL(request.url, "https://www.finari.co") : null;
  return {
    path: url ? `${url.pathname}${url.search ? url.search.slice(0, 160) : ""}` : null,
    method: request.method?.toUpperCase() ?? null,
    ipHash: hashActivityValue(forwardedIp(request.headers)),
    userAgentHash: hashActivityValue(request.headers.get("user-agent")),
  };
}

export async function recordActivityEvent(input: ActivityEventInput): Promise<void> {
  if (!hasDatabase()) {
    return;
  }

  try {
    const emailHash = input.emailHash ?? hashActivityValue(normalizeEmail(input.email));
    await getDb().insert(userActivityEvents).values({
      userId: input.userId ?? null,
      emailHash,
      category: input.category,
      eventName: input.eventName.slice(0, 120),
      path: input.path?.slice(0, 240) ?? null,
      method: input.method?.slice(0, 16).toUpperCase() ?? null,
      status: normalizeStatus(input.status),
      locale: input.locale?.slice(0, 12) ?? null,
      ticker: input.ticker?.trim().toUpperCase().slice(0, 12) ?? null,
      durationMs:
        typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
          ? Math.max(0, Math.trunc(input.durationMs))
          : null,
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
      metadataJson: sanitizeActivityMetadata(input.metadata),
    });
  } catch {
    return;
  }
}

export async function recordRouteActivity<T>(
  request: Request,
  input: Omit<ActivityEventInput, "path" | "method" | "ipHash" | "userAgentHash">,
  work: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  const context = activityRequestContext(request);

  try {
    const result = await work();
    const responseStatus =
      result instanceof Response ? result.status : normalizeStatus(input.status) ?? 200;
    void recordActivityEvent({
      ...input,
      ...context,
      status: responseStatus,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    void recordActivityEvent({
      ...input,
      ...context,
      status: "error",
      durationMs: Date.now() - started,
      metadata: {
        ...input.metadata,
        error: error instanceof Error ? error.message : "unknown",
      },
    });
    throw error;
  }
}

export async function checkMagicLinkRateLimit(params: {
  email: string;
  ipHash?: string | null;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const emailHash = hashActivityValue(params.email);
  const ipHash = params.ipHash;
  const windowSeconds = 60 * 60;
  const emailLimit = 5;
  const ipLimit = 20;
  const keys = [
    `finari:magic-link:email:${emailHash}`,
    ipHash ? `finari:magic-link:ip:${ipHash}` : null,
  ].filter((key): key is string => Boolean(key));

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    const values = await Promise.all(
      keys.map(async (key) => {
        const value = await redis.incr(key);
        if (value === 1) {
          await redis.expire(key, windowSeconds);
        }
        return value;
      }),
    );

    const emailCount = values[0] ?? 0;
    const ipCount = values[1] ?? 0;
    const allowed = emailCount <= emailLimit && ipCount <= ipLimit;
    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : windowSeconds,
    };
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

function filterConditions(filters: ActivityFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.userId) {
    conditions.push(eq(userActivityEvents.userId, filters.userId));
  }
  if (filters.email) {
    conditions.push(eq(userActivityEvents.emailHash, hashActivityValue(filters.email) ?? ""));
  }
  if (filters.category) {
    conditions.push(eq(userActivityEvents.category, filters.category));
  }
  if (filters.eventName) {
    conditions.push(ilike(userActivityEvents.eventName, `%${filters.eventName}%`));
  }
  if (filters.path) {
    conditions.push(ilike(userActivityEvents.path, `%${filters.path}%`));
  }
  if (filters.ticker) {
    conditions.push(eq(userActivityEvents.ticker, filters.ticker.trim().toUpperCase()));
  }
  if (typeof filters.status === "number") {
    conditions.push(eq(userActivityEvents.status, filters.status));
  }
  if (filters.from) {
    conditions.push(gte(userActivityEvents.createdAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(userActivityEvents.createdAt, filters.to));
  }
  return conditions;
}

function whereClause(filters: ActivityFilters): SQL | undefined {
  const conditions = filterConditions(filters);
  return conditions.length ? and(...conditions) : undefined;
}

export async function listActivityEvents(filters: ActivityFilters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = whereClause(filters);

  return getDb()
    .select({
      id: userActivityEvents.id,
      userId: userActivityEvents.userId,
      userEmail: users.email,
      emailHash: userActivityEvents.emailHash,
      category: userActivityEvents.category,
      eventName: userActivityEvents.eventName,
      path: userActivityEvents.path,
      method: userActivityEvents.method,
      status: userActivityEvents.status,
      locale: userActivityEvents.locale,
      ticker: userActivityEvents.ticker,
      durationMs: userActivityEvents.durationMs,
      metadataJson: userActivityEvents.metadataJson,
      createdAt: userActivityEvents.createdAt,
    })
    .from(userActivityEvents)
    .leftJoin(users, eq(userActivityEvents.userId, users.id))
    .where(where)
    .orderBy(desc(userActivityEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countActivityEvents(filters: ActivityFilters = {}): Promise<number> {
  const result = await getDb()
    .select({ total: count() })
    .from(userActivityEvents)
    .where(whereClause(filters));
  return result[0]?.total ?? 0;
}

export async function summarizeActivityEvents(filters: ActivityFilters = {}) {
  const where = whereClause(filters);
  const byCategory = await getDb()
    .select({
      category: userActivityEvents.category,
      total: count(),
    })
    .from(userActivityEvents)
    .where(where)
    .groupBy(userActivityEvents.category)
    .orderBy(desc(count()));

  const recentFailures = await getDb()
    .select({
      id: userActivityEvents.id,
      userId: userActivityEvents.userId,
      userEmail: users.email,
      category: userActivityEvents.category,
      eventName: userActivityEvents.eventName,
      status: userActivityEvents.status,
      path: userActivityEvents.path,
      createdAt: userActivityEvents.createdAt,
    })
    .from(userActivityEvents)
    .leftJoin(users, eq(userActivityEvents.userId, users.id))
    .where(
      and(
        ...(where ? [where] : []),
        sql`${userActivityEvents.status} >= 400`,
      ),
    )
    .orderBy(desc(userActivityEvents.createdAt))
    .limit(10);

  return { byCategory, recentFailures };
}

export async function exportActivityEvents(filters: ActivityFilters = {}) {
  return getDb()
    .select({
      id: userActivityEvents.id,
      createdAt: userActivityEvents.createdAt,
      userId: userActivityEvents.userId,
      userEmail: users.email,
      category: userActivityEvents.category,
      eventName: userActivityEvents.eventName,
      method: userActivityEvents.method,
      path: userActivityEvents.path,
      status: userActivityEvents.status,
      locale: userActivityEvents.locale,
      ticker: userActivityEvents.ticker,
      durationMs: userActivityEvents.durationMs,
    })
    .from(userActivityEvents)
    .leftJoin(users, eq(userActivityEvents.userId, users.id))
    .where(whereClause(filters))
    .orderBy(asc(userActivityEvents.createdAt))
    .limit(5_000);
}

export async function pruneOldActivityEvents(days = getActivityLogRetentionDays()) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await getDb()
    .delete(userActivityEvents)
    .where(lt(userActivityEvents.createdAt, cutoff))
    .returning({ id: userActivityEvents.id });
  return { cutoff, deleted: deleted.length };
}
