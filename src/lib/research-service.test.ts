import { beforeEach, describe, expect, it, vi } from "vitest";

const getFreshStoredSnapshot = vi.hoisted(() => vi.fn());
const getLatestStoredSnapshot = vi.hoisted(() => vi.fn());
const getStoredMemo = vi.hoisted(() => vi.fn());
const recordAiUsageEvent = vi.hoisted(() => vi.fn());
const computeMemoPromptHash = vi.hoisted(() => vi.fn());
const persistCompanyIdentities = vi.hoisted(() => vi.fn());
const persistMemo = vi.hoisted(() => vi.fn());
const persistSnapshot = vi.hoisted(() => vi.fn());

const findCompanyByTicker = vi.hoisted(() => vi.fn());
const getSubmissions = vi.hoisted(() => vi.fn());
const getCompanyFacts = vi.hoisted(() => vi.fn());
const searchCompanies = vi.hoisted(() => vi.fn());

const buildPeerComparisonFromSnapshots = vi.hoisted(() => vi.fn());
const normalizeCompanySnapshot = vi.hoisted(() => vi.fn());

const cacheKey = vi.hoisted(() => vi.fn());
const getJsonCache = vi.hoisted(() => vi.fn());
const setJsonCache = vi.hoisted(() => vi.fn());
const withRedisLock = vi.hoisted(() =>
  vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
);

vi.mock("@/lib/research-store", () => ({
  getFreshStoredSnapshot,
  getLatestStoredSnapshot,
  getStoredMemo,
  recordAiUsageEvent,
  computeMemoPromptHash,
  persistCompanyIdentities,
  persistMemo,
  persistSnapshot,
}));

vi.mock("@/lib/sec", () => ({
  findCompanyByTicker,
  getSubmissions,
  getCompanyFacts,
  searchCompanies,
}));

vi.mock("@/lib/financial-analysis", () => ({
  buildPeerComparisonFromSnapshots,
  normalizeCompanySnapshot,
}));

vi.mock("@/lib/cache", () => ({
  cacheKey,
  getJsonCache,
  setJsonCache,
  withRedisLock,
}));

import { getCompanySnapshotForTicker } from "@/lib/research-service";

describe("research service refresh policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a fresh stored snapshot when the latest financial filing is unchanged", async () => {
    const snapshot = {
      identity: { ticker: "MSFT", cik: "0000789019", name: "Microsoft" },
      latestFinancialFiling: {
        accessionNumber: "0001",
        form: "10-Q",
        filingDate: "2026-03-01",
      },
      generatedAt: new Date().toISOString(),
    };

    getFreshStoredSnapshot.mockResolvedValueOnce({
      snapshotId: "snapshot-1",
      companyId: "company-1",
      sourceHash: "hash-1",
      snapshot,
    });
    getSubmissions.mockResolvedValueOnce({
      cik: "0000789019",
      name: "Microsoft",
      filings: {
        recent: {
          accessionNumber: ["0001"],
          filingDate: ["2026-03-01"],
          form: ["10-Q"],
          primaryDocument: ["a.htm"],
        },
      },
    });

    const result = await getCompanySnapshotForTicker("MSFT");

    expect(result).toBe(snapshot);
    expect(findCompanyByTicker).not.toHaveBeenCalled();
    expect(getCompanyFacts).not.toHaveBeenCalled();
    expect(persistSnapshot).not.toHaveBeenCalled();
  });

  it("refreshes immediately when a newer financial filing appears", async () => {
    const storedSnapshot = {
      identity: { ticker: "MSFT", cik: "0000789019", name: "Microsoft" },
      latestFinancialFiling: {
        accessionNumber: "0001",
        form: "10-Q",
        filingDate: "2026-03-01",
      },
      generatedAt: new Date().toISOString(),
    };
    const refreshedSnapshot = {
      ...storedSnapshot,
      latestFinancialFiling: {
        accessionNumber: "0002",
        form: "10-Q",
        filingDate: "2026-06-01",
      },
      generatedAt: new Date().toISOString(),
    };

    getFreshStoredSnapshot.mockResolvedValueOnce({
      snapshotId: "snapshot-1",
      companyId: "company-1",
      sourceHash: "hash-1",
      snapshot: storedSnapshot,
    });
    getSubmissions.mockResolvedValue({
      cik: "0000789019",
      name: "Microsoft",
      filings: {
        recent: {
          accessionNumber: ["0002"],
          filingDate: ["2026-06-01"],
          form: ["10-Q"],
          primaryDocument: ["b.htm"],
        },
      },
    });
    findCompanyByTicker.mockResolvedValue({
      cik: "0000789019",
      ticker: "MSFT",
      name: "Microsoft",
    });
    getCompanyFacts.mockResolvedValue({ facts: {} });
    normalizeCompanySnapshot.mockImplementation(() => refreshedSnapshot);
    buildPeerComparisonFromSnapshots.mockReturnValue({} as never);
    getLatestStoredSnapshot.mockResolvedValue({ snapshot: storedSnapshot } as never);
    persistSnapshot.mockResolvedValue({
      snapshotId: "snapshot-2",
      companyId: "company-1",
      sourceHash: "hash-2",
      snapshot: refreshedSnapshot,
    });

    const result = await getCompanySnapshotForTicker("MSFT");

    expect(result).toBe(refreshedSnapshot);
    expect(findCompanyByTicker).toHaveBeenCalledWith("MSFT");
    expect(getCompanyFacts).toHaveBeenCalledTimes(1);
    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });
});
