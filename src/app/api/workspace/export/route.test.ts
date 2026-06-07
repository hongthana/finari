import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const getStoredSnapshotForTicker = vi.hoisted(() => vi.fn());
const getPrivateResearchMemoForTicker = vi.hoisted(() => vi.fn());
const buildWorkspaceExportPayload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/research-service", () => ({
  getPrivateResearchMemoForTicker,
  getStoredSnapshotForTicker,
}));

vi.mock("@/lib/research-store", () => ({
  buildWorkspaceExportPayload,
}));

function request(url: string) {
  return new Request(url);
}

describe("workspace export API route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getStoredSnapshotForTicker.mockReset();
    getPrivateResearchMemoForTicker.mockReset();
    buildWorkspaceExportPayload.mockReset();
  });

  it("denies unauthenticated users", async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    const response = await GET(request("http://localhost/api/workspace/export?ticker=AAPL&scope=memo"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  it("returns memo export payload as json", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user_1", email: "user@example.com" });
    getStoredSnapshotForTicker.mockResolvedValueOnce({
      snapshotId: "snap_1",
      companyId: "comp_1",
      sourceHash: "hash",
      snapshot: {
        identity: { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." },
        filings: [],
        periods: [],
        quarterlyPeriods: [],
        metrics: [],
        changeAnalysis: { quarterly: [], annual: [] },
        caveatChangeAnalysis: { status: "baseline", newCaveats: [], resolvedCaveats: [], unchangedCaveats: [] },
        businessDrivers: [],
        balanceSheetAnalysis: { cash: 0, debt: 0, netCash: 0, currentAssets: 0, currentLiabilities: 0, workingCapital: 0, cashToDebt: 0, debtToEquity: 0, liabilitiesToAssets: 0, signal: "neutral" },
        peerComparison: { status: "limited", peerCount: 0, metrics: [], caveats: [] },
        dataQuality: { score: 60, label: "Medium", signal: "neutral", summary: "ok", checks: [] },
        decisionFramework: { signal: "neutral", takeaway: "constructive", strongestEvidence: "Revenue growth", mainRisk: "valuation", watchMetric: "FCF" },
        caveats: [],
        citations: [],
        generatedAt: new Date().toISOString(),
      },
    });
    getPrivateResearchMemoForTicker.mockResolvedValueOnce({
      memo: {
        company: { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." },
        generatedAt: new Date().toISOString(),
        mode: "fallback",
        disclaimer: "Educational",
        sections: [{ title: "Summary", body: "Works", signal: "neutral" }],
      },
      memoId: "memo_1",
      snapshotId: "snap_1",
    });

    const expectedPayload = {
      scope: "memo",
      ticker: "AAPL",
      companyName: "Apple Inc.",
      generatedAt: new Date().toISOString(),
      snapshotSummary: {
        latestFiling: null,
        latestFinancialFiling: null,
        latestAnnualFiling: null,
        latestQuarterlyFiling: null,
        latestRevenue: null,
        latestNetIncome: null,
        latestFreeCashFlow: null,
        latestDebt: 0,
        balanceSheetSignal: "neutral",
      },
      memo: {
        company: { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." },
        disclaimer: "Educational",
        mode: "fallback",
        sections: [{ title: "Summary", body: "Works", signal: "neutral" }],
      },
    };
    buildWorkspaceExportPayload.mockResolvedValueOnce(expectedPayload);

    const response = await GET(request("http://localhost/api/workspace/export?ticker=AAPL&scope=memo&locale=en"));
    const body = (await response.json()) as { payload?: unknown };

    expect(response.status).toBe(200);
    expect(body.payload).toEqual(expectedPayload);
    expect(buildWorkspaceExportPayload).toHaveBeenCalled();
  });

  it("returns csv payload when requested", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user_1", email: "user@example.com" });
    getStoredSnapshotForTicker.mockResolvedValueOnce({
      snapshotId: "snap_1",
      companyId: "comp_1",
      sourceHash: "hash",
      snapshot: {
        identity: { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." },
        filings: [],
        periods: [],
        quarterlyPeriods: [],
        metrics: [],
        changeAnalysis: { quarterly: [], annual: [] },
        caveatChangeAnalysis: { status: "baseline", newCaveats: [], resolvedCaveats: [], unchangedCaveats: [] },
        businessDrivers: [],
        balanceSheetAnalysis: { cash: 0, debt: 0, netCash: 0, currentAssets: 0, currentLiabilities: 0, workingCapital: 0, cashToDebt: 0, debtToEquity: 0, liabilitiesToAssets: 0, signal: "neutral" },
        peerComparison: { status: "limited", peerCount: 0, metrics: [], caveats: [] },
        dataQuality: { score: 60, label: "Medium", signal: "neutral", summary: "ok", checks: [] },
        decisionFramework: { signal: "neutral", takeaway: "constructive", strongestEvidence: "Revenue growth", mainRisk: "valuation", watchMetric: "FCF" },
        caveats: [],
        citations: [],
        generatedAt: new Date().toISOString(),
      },
    });
    buildWorkspaceExportPayload.mockResolvedValueOnce({
      scope: "snapshot",
      ticker: "AAPL",
      companyName: "Apple Inc.",
      generatedAt: new Date().toISOString(),
      snapshotSummary: {
        latestFiling: null,
        latestFinancialFiling: null,
        latestAnnualFiling: null,
        latestQuarterlyFiling: null,
        latestRevenue: null,
        latestNetIncome: null,
        latestFreeCashFlow: null,
        latestDebt: 0,
        balanceSheetSignal: "neutral",
      },
    });

    const response = await GET(request("http://localhost/api/workspace/export?ticker=AAPL&scope=snapshot&format=csv&locale=en"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const text = await response.text();
    expect(text).toContain('"field","value"');
    expect(text).toContain('"ticker","AAPL"');
  });
});
