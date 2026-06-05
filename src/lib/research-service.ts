import { jsonError } from "@/lib/api";
import { cacheKey, getJsonCache, setJsonCache, withRedisLock } from "@/lib/cache";
import {
  buildPeerComparisonFromSnapshots,
  normalizeCompanySnapshot,
} from "@/lib/financial-analysis";
import { getCompanyEventImpacts } from "@/lib/event-impact";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import {
  generateFallbackResearchMemo,
  generateResearchMemoWithUsage,
} from "@/lib/memo";
import {
  findCompanyByTicker,
  getCompanyFacts,
  getSubmissions,
  searchCompanies,
} from "@/lib/sec";
import {
  getFreshStoredSnapshot,
  getLatestStoredSnapshot,
  getStoredMemo,
  recordAiUsageEvent,
  computeMemoPromptHash,
  persistCompanyIdentities,
  persistMemo,
  persistSnapshot,
} from "@/lib/research-store";
import type { CompanyIdentity, CompanySnapshot, ResearchMemo } from "@/lib/types";

const SEARCH_CACHE_TTL_SECONDS = 15 * 60;
const COMPANY_CACHE_TTL_SECONDS = 6 * 60 * 60;
const MAX_PEER_SEED_FETCHES = 4;

const PEER_SEED_TICKERS_BY_SIC: Record<string, string[]> = {
  "3571": ["AAPL", "DELL", "HPQ", "HPE", "SMCI", "NTAP", "STX", "WDC"],
  "3674": ["NVDA", "AMD", "INTC", "QCOM", "AVGO", "TXN", "MU"],
  "7372": ["MSFT", "ORCL", "CRM", "ADBE", "INTU", "NOW"],
  "7370": ["GOOGL", "META", "AMZN", "NFLX", "UBER", "ABNB"],
  "6021": ["JPM", "BAC", "WFC", "C", "USB", "PNC", "TFC"],
  "1311": ["XOM", "CVX", "COP", "EOG", "OXY", "MPC"],
  "2834": ["JNJ", "PFE", "MRK", "LLY", "ABBV", "BMY"],
  "3841": ["ABT", "TMO", "SYK", "BSX", "MDT", "ISRG"],
  "5812": ["MCD", "SBUX", "YUM", "CMG", "DRI"],
  "5411": ["WMT", "COST", "KR", "TGT", "DG"],
};

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

async function fetchPeerSnapshots(baseSnapshot: CompanySnapshot): Promise<CompanySnapshot[]> {
  const sic = baseSnapshot.identity.sic;
  if (!sic) {
    return [];
  }

  const seedTickers = (PEER_SEED_TICKERS_BY_SIC[sic] ?? [])
    .filter((ticker) => ticker !== baseSnapshot.identity.ticker)
    .slice(0, MAX_PEER_SEED_FETCHES);
  if (!seedTickers.length) {
    return [];
  }

  const peerSnapshots: CompanySnapshot[] = [];

  for (const ticker of seedTickers) {
    try {
      const identity = await findCompanyByTicker(ticker);
      if (!identity || identity.cik === baseSnapshot.identity.cik) {
        continue;
      }

      const [submissions, facts] = await Promise.all([
        getSubmissions(identity.cik),
        getCompanyFacts(identity.cik),
      ]);
      const peerSnapshot = normalizeCompanySnapshot(identity, submissions, facts);

      if (peerSnapshot.identity.sic === sic) {
        peerSnapshots.push(peerSnapshot);
      }
    } catch {
      // Peer coverage is best-effort and must not block primary company research.
    }
  }

  return peerSnapshots;
}

async function fetchAndPersistSnapshot(ticker: string) {
  const identity = await findCompanyByTicker(ticker);
  if (!identity) {
    throw new UnknownTickerError(ticker);
  }

  return withRedisLock(cacheKey(["research", "lock", identity.cik]), 30, async () => {
    const previousStored = await getLatestStoredSnapshot(identity.ticker);
    const [submissions, facts] = await Promise.all([
      getSubmissions(identity.cik),
      getCompanyFacts(identity.cik),
    ]);
    const baseSnapshot = normalizeCompanySnapshot(identity, submissions, facts);
    const peerSnapshots = await fetchPeerSnapshots(baseSnapshot);
    const peerComparison = buildPeerComparisonFromSnapshots(
      baseSnapshot,
      peerSnapshots,
    );
    const snapshot = normalizeCompanySnapshot(
      identity,
      submissions,
      facts,
      peerComparison,
      previousStored?.snapshot.caveats,
    );
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
  const eventContext = (await getCompanyEventImpacts(ticker, locale)).events;
  const existing = await getStoredMemo(
    snapshot,
    locale,
    { visibility: "public" },
    undefined,
    eventContext,
  );
  if (existing) {
    return {
      memo: existing.memo,
      memoId: existing.memoId,
      snapshotId: snapshot.snapshotId,
    };
  }

  const memo = generateFallbackResearchMemo(
    snapshot.snapshot,
    locale,
    "public",
    eventContext,
  );
  return {
    memo,
    memoId: `fallback:${snapshot.snapshotId}:${locale}`,
    snapshotId: snapshot.snapshotId,
  };
}

export async function getPrivateResearchMemoForTicker(
  userId: string,
  ticker: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{
  memo: ResearchMemo;
  memoId: string;
  snapshotId: string;
}> {
  const snapshot = await getStoredSnapshotForTicker(ticker);
  const eventContext = (
    await getCompanyEventImpacts(ticker, locale, { ownerUserId: userId })
  ).events;
  const existing = await getStoredMemo(
    snapshot,
    locale,
    {
      visibility: "private",
      ownerUserId: userId,
    },
    undefined,
    eventContext,
  );
  if (existing) {
    return {
      memo: existing.memo,
      memoId: existing.memoId,
      snapshotId: snapshot.snapshotId,
    };
  }

  const generated = await generateResearchMemoWithUsage(
    snapshot.snapshot,
    locale,
    "private",
    eventContext,
  );
  const stored = await persistMemo(
    snapshot,
    generated.memo,
    locale,
    {
      visibility: "private",
      ownerUserId: userId,
    },
    undefined,
    eventContext,
  );
  await recordAiUsageEvent({
    userId,
    companyId: snapshot.companyId,
    snapshotId: snapshot.snapshotId,
    memoId: stored.memoId,
    model: generated.usage.model,
    requestId: generated.usage.requestId,
    promptHash: computeMemoPromptHash(snapshot.snapshot, locale, eventContext),
    locale,
    purpose: "private_memo",
    status: generated.usage.status,
    inputTokens: generated.usage.inputTokens,
    outputTokens: generated.usage.outputTokens,
    totalTokens: generated.usage.totalTokens,
    errorMessage: generated.usage.errorMessage,
  });

  return {
    memo: stored.memo,
    memoId: stored.memoId,
    snapshotId: snapshot.snapshotId,
  };
}

export async function publishPublicResearchMemoForTicker(
  adminUserId: string,
  ticker: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{
  memo: ResearchMemo;
  memoId: string;
  snapshotId: string;
}> {
  const snapshot = await getStoredSnapshotForTicker(ticker);
  const eventContext = (await getCompanyEventImpacts(ticker, locale)).events;
  const generated = await generateResearchMemoWithUsage(
    snapshot.snapshot,
    locale,
    "public",
    eventContext,
  );
  const stored = await persistMemo(
    snapshot,
    generated.memo,
    locale,
    {
      visibility: "public",
      publishedByUserId: adminUserId,
    },
    undefined,
    eventContext,
  );
  await recordAiUsageEvent({
    userId: adminUserId,
    companyId: snapshot.companyId,
    snapshotId: snapshot.snapshotId,
    memoId: stored.memoId,
    model: generated.usage.model,
    requestId: generated.usage.requestId,
    promptHash: computeMemoPromptHash(snapshot.snapshot, locale, eventContext),
    locale,
    purpose: "admin_public_memo",
    status: generated.usage.status,
    inputTokens: generated.usage.inputTokens,
    outputTokens: generated.usage.outputTokens,
    totalTokens: generated.usage.totalTokens,
    errorMessage: generated.usage.errorMessage,
  });

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
