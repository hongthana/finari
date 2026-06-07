import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

import { fixtureSnapshot } from "@/test/fixtures";
import { persistSnapshot } from "@/lib/research-store";

const getCurrentUserId = vi.hoisted(() => vi.fn());
const listWatchlistItems = vi.hoisted(() => vi.fn());
const addCompanyToWatchlist = vi.hoisted(() => vi.fn());
const getStoredSnapshotForTicker = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUserId,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
}));

vi.mock("@/lib/research-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/research-store")>(
    "@/lib/research-store",
  );

  return {
    ...actual,
    listWatchlistItems,
    addCompanyToWatchlist,
    getStoredSnapshotForTicker,
  };
});

function context(watchlistId: string) {
  return {
    params: Promise.resolve({ id: watchlistId }),
  };
}

describe("watchlist items API route", () => {
  beforeEach(() => {
    getCurrentUserId.mockReset();
    listWatchlistItems.mockReset();
    addCompanyToWatchlist.mockReset();
    getStoredSnapshotForTicker.mockReset();
  });

  it("requires authentication for listing items", async () => {
    getCurrentUserId.mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/watchlists/wl_1/items"), context("wl_1"));

    expect(response.status).toBe(401);
    expect(listWatchlistItems).not.toHaveBeenCalled();
  });

  it("requires authentication for adding items", async () => {
    getCurrentUserId.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/watchlists/wl_1/items", {
        method: "POST",
        body: JSON.stringify({ ticker: "AAPL" }),
      }),
      context("wl_1"),
    );

    expect(response.status).toBe(401);
    expect(addCompanyToWatchlist).not.toHaveBeenCalled();
  });

  it("adds an item and reports duplicate state", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    const snapshot = await persistSnapshot(fixtureSnapshot);
    getStoredSnapshotForTicker.mockResolvedValueOnce(snapshot);
    addCompanyToWatchlist.mockResolvedValueOnce({
      id: "item_1",
      watchlistId: "wl_1",
      companyId: snapshot.companyId,
      notes: null,
      addedAt: new Date().toISOString(),
      company: snapshot.snapshot.identity,
      isDuplicate: false,
    });

    const response = await POST(
      new Request("http://localhost/api/watchlists/wl_1/items", {
        method: "POST",
        body: JSON.stringify({ ticker: "AAPL" }),
      }),
      context("wl_1"),
    );
    const body = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(201);
    expect(body.item?.id).toBe("item_1");
  });

  it("returns duplicate result with 200 status", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    const snapshot = await persistSnapshot(fixtureSnapshot);
    getStoredSnapshotForTicker.mockResolvedValueOnce(snapshot);
    addCompanyToWatchlist.mockResolvedValueOnce({
      id: "item_1",
      watchlistId: "wl_1",
      companyId: snapshot.companyId,
      notes: null,
      addedAt: new Date().toISOString(),
      company: snapshot.snapshot.identity,
      isDuplicate: true,
    });

    const response = await POST(
      new Request("http://localhost/api/watchlists/wl_1/items", {
        method: "POST",
        body: JSON.stringify({ ticker: "AAPL" }),
      }),
      context("wl_1"),
    );
    const body = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(body.item?.id).toBe("item_1");
  });

  it("lists watchlist items for a valid watchlist", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    listWatchlistItems.mockResolvedValueOnce([
      {
        id: "item_1",
        companyId: "comp_1",
        watchlistId: "wl_1",
        notes: null,
        addedAt: new Date().toISOString(),
        company: { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." },
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/watchlists/wl_1/items"),
      context("wl_1"),
    );
    const body = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect((body.items[0] as { company: { ticker: string } }).company.ticker).toBe("AAPL");
  });
});
