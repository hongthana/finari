import { jsonError } from "@/lib/api";
import { cacheKey, getJsonCache, setJsonCache, withRedisLock } from "@/lib/cache";
import { normalizeCompanySnapshot } from "@/lib/financial-analysis";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { generateResearchMemo } from "@/lib/memo";
import {
  findCompanyByTicker,
  getCompanyFacts,
  getSubmissions,
  searchCompanies,
} from "@/lib/sec";
import {
  getFreshStoredSnapshot,
  getStoredMemo,
  persistCompanyIdentities,
  persistMemo,
  persistSnapshot,
} from "@/lib/research-store";
import type { CompanyIdentity, CompanySnapshot, ResearchMemo } from "@/lib/types";

const SEARCH_CACHE_TTL_SECONDS = 15 * 60;
const COMPANY_CACHE_TTL_SECONDS = 6 * 60 * 60;

export class UnknownTickerError extends Error {
  constructor(ticker: string) {
    super(`Unknown ticker: ${ticker.toUpperCase()}`);
  }
}

export async function searchCompaniesWithCache(query: string): Promise<CompanyIdentity[]> {
  const normalized = query.trim().toUpperCase();
  if (!normalized) {
    return [];
  }

  const key = cacheKey(["search", normalized]);
  const cached = await getJsonCache<CompanyIdentity[]>(key);
  if (cached) {
    return cached;
  }

  const results = await searchCompanies(normalized);
  await Promise.all([
    setJsonCache(key, results, SEARCH_CACHE_TTL_SECONDS),
    persistCompanyIdentities(results),
  ]);

  return results;
}

async function fetchAndPersistSnapshot(ticker: string) {
  const identity = await findCompanyByTicker(ticker);
  if (!identity) {
    throw new UnknownTickerError(ticker);
  }

  return withRedisLock(cacheKey(["research", "lock", identity.cik]), 30, async () => {
    const [submissions, facts] = await Promise.all([
      getSubmissions(identity.cik),
      getCompanyFacts(identity.cik),
    ]);
    const snapshot = normalizeCompanySnapshot(identity, submissions, facts);
    const stored = await persistSnapshot(snapshot);
    await setJsonCache(
      cacheKey(["company", identity.cik, "snapshot"]),
      stored,
      COMPANY_CACHE_TTL_SECONDS,
    );
    return stored;
  });
}

export async function getCompanySnapshotForTicker(ticker: string): Promise<CompanySnapshot> {
  const stored = await getFreshStoredSnapshot(ticker);
  if (stored) {
    return stored.snapshot;
  }

  const refreshed = await fetchAndPersistSnapshot(ticker);
  return refreshed.snapshot;
}

export async function getStoredSnapshotForTicker(ticker: string) {
  const stored = await getFreshStoredSnapshot(ticker);
  if (stored) {
    return stored;
  }
  return fetchAndPersistSnapshot(ticker);
}

export async function getResearchMemoForTicker(
  ticker: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{
  memo: ResearchMemo;
  memoId: string;
  snapshotId: string;
}> {
  const snapshot = await getStoredSnapshotForTicker(ticker);
  const existing = await getStoredMemo(snapshot, locale);
  if (existing) {
    return {
      memo: existing.memo,
      memoId: existing.memoId,
      snapshotId: snapshot.snapshotId,
    };
  }

  const memo = await generateResearchMemo(snapshot.snapshot, locale);
  const stored = await persistMemo(snapshot, memo, locale);
  return {
    memo: stored.memo,
    memoId: stored.memoId,
    snapshotId: snapshot.snapshotId,
  };
}

export function companyLookupError(error: unknown, ticker: string) {
  if (error instanceof UnknownTickerError) {
    return jsonError(`Unknown ticker: ${ticker.toUpperCase()}`, 404);
  }
  return null;
}
