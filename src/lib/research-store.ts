import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb, hasDatabase } from "@/db/client";
import {
  companies,
  companyTickers,
  filings,
  financialFacts,
  financialPeriods,
  researchMemos,
  researchSnapshots,
  savedResearch,
  users,
  watchlistItems,
  watchlists,
} from "@/db/schema";
import { stableHash } from "@/lib/cache";
import { getOpenAiModel } from "@/lib/env";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import type {
  CompanyIdentity,
  CompanySnapshot,
  FinancialPeriod,
  ResearchMemo,
  SourceCitation,
} from "@/lib/types";

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const MEMO_PROMPT_VERSION = "finari_memo_v2";

type StoredSnapshot = {
  snapshotId: string;
  companyId: string;
  sourceHash: string;
  snapshot: CompanySnapshot;
};

type StoredMemo = {
  memoId: string;
  memo: ResearchMemo;
};

type SaveResearchInput = {
  userId: string;
  snapshot: StoredSnapshot;
  memo?: StoredMemo | null;
  title?: string;
  notes?: string;
};

type WatchlistInput = {
  userId: string;
  name?: string;
};

const memoryState = globalThis as typeof globalThis & {
  __finariSnapshots?: Map<string, StoredSnapshot>;
  __finariMemos?: Map<string, StoredMemo>;
  __finariSavedResearch?: Array<Record<string, unknown>>;
  __finariWatchlists?: Array<Record<string, unknown>>;
  __finariWatchlistItems?: Array<Record<string, unknown>>;
};

function getSnapshotMemory() {
  memoryState.__finariSnapshots ??= new Map();
  return memoryState.__finariSnapshots;
}

function getMemoMemory() {
  memoryState.__finariMemos ??= new Map();
  return memoryState.__finariMemos;
}

function getSavedResearchMemory() {
  memoryState.__finariSavedResearch ??= [];
  return memoryState.__finariSavedResearch;
}

function getWatchlistMemory() {
  memoryState.__finariWatchlists ??= [];
  return memoryState.__finariWatchlists;
}

function getWatchlistItemsMemory() {
  memoryState.__finariWatchlistItems ??= [];
  return memoryState.__finariWatchlistItems;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function dateOrNull(value?: string): string | null {
  return value && value.trim() ? value : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function computeSnapshotSourceHash(snapshot: CompanySnapshot): string {
  return stableHash({
    cik: snapshot.identity.cik,
    latestFiling: snapshot.latestFiling?.accessionNumber,
    filings: snapshot.filings.map((filing) => ({
      accessionNumber: filing.accessionNumber,
      form: filing.form,
      filingDate: filing.filingDate,
      reportDate: filing.reportDate,
    })),
    periods: snapshot.periods,
    caveats: snapshot.caveats,
  });
}

export function computeMemoPromptHash(
  snapshot: CompanySnapshot,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return stableHash({
    version: MEMO_PROMPT_VERSION,
    locale,
    model: getOpenAiModel(),
    sourceHash: computeSnapshotSourceHash(snapshot),
    identity: snapshot.identity,
    periods: snapshot.periods,
    metrics: snapshot.metrics,
    caveats: snapshot.caveats,
    citations: snapshot.citations,
  });
}

export function isSnapshotExpired(snapshot: CompanySnapshot, now = new Date()): boolean {
  return new Date(snapshot.generatedAt).getTime() + SNAPSHOT_TTL_MS <= now.getTime();
}

function metricFactsFromPeriod(
  companyId: string,
  filingId: string | null,
  period: FinancialPeriod,
  sourceHash: string,
) {
  const metricEntries: Array<[keyof FinancialPeriod, string, string]> = [
    ["revenue", "Revenue", "USD"],
    ["grossProfit", "GrossProfit", "USD"],
    ["operatingIncome", "OperatingIncomeLoss", "USD"],
    ["netIncome", "NetIncomeLoss", "USD"],
    ["assets", "Assets", "USD"],
    ["liabilities", "Liabilities", "USD"],
    ["equity", "StockholdersEquity", "USD"],
    ["cash", "CashAndCashEquivalentsAtCarryingValue", "USD"],
    ["debt", "Debt", "USD"],
    ["operatingCashFlow", "NetCashProvidedByUsedInOperatingActivities", "USD"],
    ["capitalExpenditure", "PaymentsToAcquirePropertyPlantAndEquipment", "USD"],
    ["freeCashFlow", "FreeCashFlow", "USD"],
    ["epsDiluted", "EarningsPerShareDiluted", "shares"],
    ["sharesDiluted", "WeightedAverageNumberOfDilutedSharesOutstanding", "shares"],
  ];

  return metricEntries.flatMap(([metricKey, usGaapTag, unit]) => {
    const value = numberOrNull(period[metricKey] as number | null | undefined);
    if (value === null) {
      return [];
    }
    return {
      companyId,
      filingId,
      fiscalYear: period.fiscalYear,
      periodEndDate: dateOrNull(period.endDate),
      metricKey,
      usGaapTag,
      unit,
      valueNumeric: value,
      sourceFingerprint: stableHash({
        sourceHash,
        accessionNumber: period.accessionNumber,
        fiscalYear: period.fiscalYear,
        metricKey,
        value,
      }),
    };
  });
}

function citationJson(citations: SourceCitation[]) {
  return citations as unknown as Record<string, unknown>[];
}

async function upsertCompany(identity: CompanyIdentity): Promise<string | null> {
  if (!hasDatabase()) {
    return null;
  }

  const db = getDb();
  const [company] = await db
    .insert(companies)
    .values({
      cik: identity.cik,
      legalName: identity.name,
      sic: identity.sic,
      sicDescription: identity.sicDescription,
      fiscalYearEnd: identity.fiscalYearEnd,
    })
    .onConflictDoUpdate({
      target: companies.cik,
      set: {
        legalName: identity.name,
        sic: identity.sic,
        sicDescription: identity.sicDescription,
        fiscalYearEnd: identity.fiscalYearEnd,
        updatedAt: new Date(),
      },
    })
    .returning({ id: companies.id });

  await db
    .insert(companyTickers)
    .values({
      companyId: company.id,
      ticker: normalizeTicker(identity.ticker),
      exchange: identity.exchange,
      isActive: true,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [companyTickers.companyId, companyTickers.ticker],
      set: {
        exchange: identity.exchange,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

  return company.id;
}

export async function persistCompanyIdentities(identities: CompanyIdentity[]): Promise<void> {
  if (!hasDatabase()) {
    return;
  }

  await Promise.all(identities.map((identity) => upsertCompany(identity)));
}

export async function findCompanyIdByTicker(ticker: string): Promise<string | null> {
  if (!hasDatabase()) {
    const stored = getSnapshotMemory().get(normalizeTicker(ticker));
    return stored?.companyId ?? null;
  }

  const db = getDb();
  const [row] = await db
    .select({ companyId: companyTickers.companyId })
    .from(companyTickers)
    .where(and(eq(companyTickers.ticker, normalizeTicker(ticker)), eq(companyTickers.isActive, true)))
    .limit(1);

  return row?.companyId ?? null;
}

export async function getFreshStoredSnapshot(ticker: string): Promise<StoredSnapshot | null> {
  const normalized = normalizeTicker(ticker);
  if (!hasDatabase()) {
    const stored = getSnapshotMemory().get(normalized);
    if (!stored || isSnapshotExpired(stored.snapshot)) {
      return null;
    }
    return stored;
  }

  const db = getDb();
  const [row] = await db
    .select({
      snapshotId: researchSnapshots.id,
      companyId: researchSnapshots.companyId,
      sourceHash: researchSnapshots.sourceHash,
      snapshotJson: researchSnapshots.snapshotJson,
      expiresAt: researchSnapshots.expiresAt,
    })
    .from(companyTickers)
    .innerJoin(companies, eq(companyTickers.companyId, companies.id))
    .innerJoin(researchSnapshots, eq(researchSnapshots.companyId, companies.id))
    .where(and(eq(companyTickers.ticker, normalized), eq(companyTickers.isActive, true)))
    .orderBy(desc(researchSnapshots.generatedAt))
    .limit(1);

  if (!row || row.expiresAt <= new Date()) {
    return null;
  }

  return {
    snapshotId: row.snapshotId,
    companyId: row.companyId,
    sourceHash: row.sourceHash,
    snapshot: row.snapshotJson as unknown as CompanySnapshot,
  };
}

export async function persistSnapshot(snapshot: CompanySnapshot): Promise<StoredSnapshot> {
  const sourceHash = computeSnapshotSourceHash(snapshot);

  if (!hasDatabase()) {
    const stored = {
      snapshotId: stableHash({ ticker: snapshot.identity.ticker, sourceHash }),
      companyId: stableHash(snapshot.identity.cik),
      sourceHash,
      snapshot,
    };
    getSnapshotMemory().set(normalizeTicker(snapshot.identity.ticker), stored);
    return stored;
  }

  const db = getDb();
  const companyId = await upsertCompany(snapshot.identity);
  if (!companyId) {
    throw new Error("Unable to persist company");
  }

  const filingIds = new Map<string, string>();
  for (const filing of snapshot.filings) {
    const [row] = await db
      .insert(filings)
      .values({
        companyId,
        accessionNumber: filing.accessionNumber,
        form: filing.form,
        filingDate: dateOrNull(filing.filingDate),
        reportDate: dateOrNull(filing.reportDate),
        primaryDocumentUrl: filing.url,
        metadataJson: {
          primaryDocument: filing.primaryDocument,
        },
      })
      .onConflictDoUpdate({
        target: filings.accessionNumber,
        set: {
          companyId,
          form: filing.form,
          filingDate: dateOrNull(filing.filingDate),
          reportDate: dateOrNull(filing.reportDate),
          primaryDocumentUrl: filing.url,
          metadataJson: {
            primaryDocument: filing.primaryDocument,
          },
        },
      })
      .returning({ id: filings.id, accessionNumber: filings.accessionNumber });
    filingIds.set(row.accessionNumber, row.id);
  }

  for (const period of snapshot.periods) {
    await db
      .insert(financialPeriods)
      .values({
        companyId,
        fiscalYear: period.fiscalYear,
        periodEndDate: dateOrNull(period.endDate),
        sourceFilingId: period.accessionNumber ? filingIds.get(period.accessionNumber) : null,
        revenue: numberOrNull(period.revenue),
        grossProfit: numberOrNull(period.grossProfit),
        operatingIncome: numberOrNull(period.operatingIncome),
        netIncome: numberOrNull(period.netIncome),
        assets: numberOrNull(period.assets),
        liabilities: numberOrNull(period.liabilities),
        equity: numberOrNull(period.equity),
        cash: numberOrNull(period.cash),
        debt: numberOrNull(period.debt),
        operatingCashFlow: numberOrNull(period.operatingCashFlow),
        capitalExpenditure: numberOrNull(period.capitalExpenditure),
        freeCashFlow: numberOrNull(period.freeCashFlow),
        epsDiluted: numberOrNull(period.epsDiluted),
        sharesDiluted: numberOrNull(period.sharesDiluted),
        caveatsJson: snapshot.caveats,
        sourceHash,
      })
      .onConflictDoUpdate({
        target: [financialPeriods.companyId, financialPeriods.fiscalYear],
        set: {
          periodEndDate: dateOrNull(period.endDate),
          sourceFilingId: period.accessionNumber ? filingIds.get(period.accessionNumber) : null,
          revenue: numberOrNull(period.revenue),
          grossProfit: numberOrNull(period.grossProfit),
          operatingIncome: numberOrNull(period.operatingIncome),
          netIncome: numberOrNull(period.netIncome),
          assets: numberOrNull(period.assets),
          liabilities: numberOrNull(period.liabilities),
          equity: numberOrNull(period.equity),
          cash: numberOrNull(period.cash),
          debt: numberOrNull(period.debt),
          operatingCashFlow: numberOrNull(period.operatingCashFlow),
          capitalExpenditure: numberOrNull(period.capitalExpenditure),
          freeCashFlow: numberOrNull(period.freeCashFlow),
          epsDiluted: numberOrNull(period.epsDiluted),
          sharesDiluted: numberOrNull(period.sharesDiluted),
          caveatsJson: snapshot.caveats,
          sourceHash,
          updatedAt: new Date(),
        },
      });
  }

  await db.delete(financialFacts).where(eq(financialFacts.companyId, companyId));
  const facts = snapshot.periods.flatMap((period) =>
    metricFactsFromPeriod(
      companyId,
      period.accessionNumber ? (filingIds.get(period.accessionNumber) ?? null) : null,
      period,
      sourceHash,
    ),
  );
  if (facts.length > 0) {
    await db.insert(financialFacts).values(facts);
  }

  const expiresAt = new Date(Date.now() + SNAPSHOT_TTL_MS);
  const [stored] = await db
    .insert(researchSnapshots)
    .values({
      companyId,
      sourceHash,
      generatedAt: new Date(snapshot.generatedAt),
      expiresAt,
      snapshotJson: snapshot as unknown as Record<string, unknown>,
      citationsJson: citationJson(snapshot.citations),
      caveatsJson: snapshot.caveats,
    })
    .onConflictDoUpdate({
      target: [researchSnapshots.companyId, researchSnapshots.sourceHash],
      set: {
        expiresAt,
        snapshotJson: snapshot as unknown as Record<string, unknown>,
        citationsJson: citationJson(snapshot.citations),
        caveatsJson: snapshot.caveats,
      },
    })
    .returning({
      snapshotId: researchSnapshots.id,
      companyId: researchSnapshots.companyId,
    });

  return {
    snapshotId: stored.snapshotId,
    companyId: stored.companyId,
    sourceHash,
    snapshot,
  };
}

export async function getStoredMemo(
  snapshot: StoredSnapshot,
  locale: Locale = DEFAULT_LOCALE,
  model = getOpenAiModel(),
): Promise<StoredMemo | null> {
  const promptHash = computeMemoPromptHash(snapshot.snapshot, locale);
  if (!hasDatabase()) {
    return (
      getMemoMemory().get(`${snapshot.snapshotId}:${locale}:${model}:${promptHash}`) ??
      null
    );
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: researchMemos.id,
      mode: researchMemos.mode,
      disclaimer: researchMemos.disclaimer,
      sectionsJson: researchMemos.sectionsJson,
      generatedAt: researchMemos.generatedAt,
    })
    .from(researchMemos)
    .where(
      and(
        eq(researchMemos.snapshotId, snapshot.snapshotId),
        eq(researchMemos.model, model),
        eq(researchMemos.promptHash, promptHash),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    memoId: row.id,
    memo: {
      company: snapshot.snapshot.identity,
      generatedAt: row.generatedAt.toISOString(),
      mode: row.mode === "ai" ? "ai" : "fallback",
      disclaimer: row.disclaimer,
      sections: row.sectionsJson as unknown as ResearchMemo["sections"],
      citations: snapshot.snapshot.citations,
    },
  };
}

export async function persistMemo(
  snapshot: StoredSnapshot,
  memo: ResearchMemo,
  locale: Locale = DEFAULT_LOCALE,
  model = getOpenAiModel(),
): Promise<StoredMemo> {
  const promptHash = computeMemoPromptHash(snapshot.snapshot, locale);

  if (!hasDatabase()) {
    const stored = {
      memoId: stableHash({ snapshotId: snapshot.snapshotId, locale, model, promptHash }),
      memo,
    };
    getMemoMemory().set(`${snapshot.snapshotId}:${locale}:${model}:${promptHash}`, stored);
    return stored;
  }

  const db = getDb();
  const [row] = await db
    .insert(researchMemos)
    .values({
      snapshotId: snapshot.snapshotId,
      companyId: snapshot.companyId,
      mode: memo.mode,
      model,
      promptHash,
      sectionsJson: memo.sections as unknown as Record<string, unknown>[],
      disclaimer: memo.disclaimer,
      generatedAt: new Date(memo.generatedAt),
    })
    .onConflictDoUpdate({
      target: [researchMemos.snapshotId, researchMemos.model, researchMemos.promptHash],
      set: {
        mode: memo.mode,
        sectionsJson: memo.sections as unknown as Record<string, unknown>[],
        disclaimer: memo.disclaimer,
      },
    })
    .returning({ id: researchMemos.id });

  return { memoId: row.id, memo };
}

export async function ensureUserProfile(userId: string, email?: string | null): Promise<void> {
  if (!hasDatabase()) {
    return;
  }

  if (email) {
    await getDb()
      .insert(users)
      .values({ id: userId, email })
      .onConflictDoNothing();
  }
}

export async function saveResearchForUser(input: SaveResearchInput) {
  const title =
    input.title?.trim() ||
    `${input.snapshot.snapshot.identity.ticker} research memo - ${new Date().toISOString().slice(0, 10)}`;

  if (!hasDatabase()) {
    const record = {
      id: crypto.randomUUID(),
      userId: input.userId,
      companyId: input.snapshot.companyId,
      snapshotId: input.snapshot.snapshotId,
      memoId: input.memo?.memoId ?? null,
      title,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      company: input.snapshot.snapshot.identity,
    };
    getSavedResearchMemory().push(record);
    return record;
  }

  const [row] = await getDb()
    .insert(savedResearch)
    .values({
      userId: input.userId,
      companyId: input.snapshot.companyId,
      snapshotId: input.snapshot.snapshotId,
      memoId: input.memo?.memoId,
      title,
      notes: input.notes,
    })
    .returning();
  return row;
}

export async function listSavedResearchForUser(userId: string) {
  if (!hasDatabase()) {
    return getSavedResearchMemory().filter((record) => record.userId === userId);
  }

  return getDb()
    .select({
      id: savedResearch.id,
      title: savedResearch.title,
      notes: savedResearch.notes,
      createdAt: savedResearch.createdAt,
      ticker: companyTickers.ticker,
      companyName: companies.legalName,
    })
    .from(savedResearch)
    .innerJoin(companies, eq(savedResearch.companyId, companies.id))
    .innerJoin(companyTickers, eq(companyTickers.companyId, companies.id))
    .where(and(eq(savedResearch.userId, userId), eq(companyTickers.isActive, true)))
    .orderBy(desc(savedResearch.createdAt));
}

export async function ensureDefaultWatchlist(userId: string) {
  if (!hasDatabase()) {
    const existing = getWatchlistMemory().find(
      (watchlist) => watchlist.userId === userId && watchlist.isDefault,
    );
    if (existing) {
      return existing;
    }
    const record = {
      id: crypto.randomUUID(),
      userId,
      name: "My watchlist",
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    getWatchlistMemory().push(record);
    return record;
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.userId, userId), eq(watchlists.isDefault, true)))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(watchlists)
    .values({ userId, name: "My watchlist", isDefault: true })
    .onConflictDoNothing()
    .returning();
  return created;
}

export async function createWatchlist(input: WatchlistInput) {
  const name = input.name?.trim() || "My watchlist";
  if (!hasDatabase()) {
    const record = {
      id: crypto.randomUUID(),
      userId: input.userId,
      name,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    getWatchlistMemory().push(record);
    return record;
  }

  const [created] = await getDb()
    .insert(watchlists)
    .values({ userId: input.userId, name, isDefault: false })
    .onConflictDoUpdate({
      target: [watchlists.userId, watchlists.name],
      set: { name },
    })
    .returning();
  return created;
}

export async function listWatchlistsForUser(userId: string) {
  if (!hasDatabase()) {
    return getWatchlistMemory().filter((watchlist) => watchlist.userId === userId);
  }

  return getDb()
    .select()
    .from(watchlists)
    .where(eq(watchlists.userId, userId))
    .orderBy(desc(watchlists.isDefault), desc(watchlists.createdAt));
}

export async function addCompanyToWatchlist(input: {
  userId: string;
  watchlistId?: string;
  snapshot: StoredSnapshot;
  notes?: string;
}) {
  const watchlist =
    input.watchlistId && hasDatabase()
      ? { id: input.watchlistId }
      : await ensureDefaultWatchlist(input.userId);

  if (!hasDatabase()) {
    const record = {
      id: crypto.randomUUID(),
      watchlistId: watchlist.id,
      companyId: input.snapshot.companyId,
      notes: input.notes ?? null,
      addedAt: new Date().toISOString(),
      company: input.snapshot.snapshot.identity,
    };
    getWatchlistItemsMemory().push(record);
    return record;
  }

  const [row] = await getDb()
    .insert(watchlistItems)
    .values({
      watchlistId: watchlist.id as string,
      companyId: input.snapshot.companyId,
      notes: input.notes,
    })
    .onConflictDoUpdate({
      target: [watchlistItems.watchlistId, watchlistItems.companyId],
      set: {
        notes: input.notes,
        addedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export function resetResearchStoreForTests(): void {
  memoryState.__finariSnapshots = new Map();
  memoryState.__finariMemos = new Map();
  memoryState.__finariSavedResearch = [];
  memoryState.__finariWatchlists = [];
  memoryState.__finariWatchlistItems = [];
}
