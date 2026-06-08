import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getValuationForTicker } from "@/lib/valuation";

describe("getValuationForTicker", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FMP_API_KEY;
    delete process.env.FMP_BASE_URL;
  });

  it("throws when API key is missing", async () => {
    await expect(getValuationForTicker("AAPL")).rejects.toThrow(
      "FMP_API_KEY is not configured",
    );
  });

  it("maps valuation payload from ratio and quote responses", async () => {
    process.env.FMP_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({ apikey: "test-key" });

        if (url.includes("key-metrics?symbol=AAPL")) {
          return Response.json({
            priceEarningsRatio: 34.7,
            priceToBookRatio: 47.2,
            enterpriseValueOverEBITDA: 20.4,
            debtToEquity: 1.2,
            returnOnEquity: 31.5,
            marketCap: 2_900_000_000_000,
          });
        }

        if (url.includes("ratios-ttm?symbol=AAPL")) {
          return Response.json([], { status: 200 });
        }

        if (url.includes("quote?symbol=AAPL")) {
          return Response.json([
            {
              marketCap: 2_905_000_000_000,
            },
          ]);
        }

        return Response.json({}, { status: 404 });
      }),
    );

    const valuation = await getValuationForTicker("AAPL");

    expect(valuation.ticker).toBe("AAPL");
    expect(valuation.priceToEarnings).toBe(34.7);
    expect(valuation.priceToBook).toBe(47.2);
    expect(valuation.marketCap).toBe(2_900_000_000_000);
    expect(valuation.returnOnEquity).toBe(31.5);
    expect(valuation.debtToEquity).toBe(1.2);
    expect(valuation.metrics.some((metric) => metric.id === "priceEarningsRatio")).toBe(true);
    expect(valuation.metrics.some((metric) => metric.id === "priceToBookRatio")).toBe(true);
    expect(valuation.metrics.some((metric) => metric.id === "marketCap")).toBe(true);
  });

  it("throws when SEC data payload is missing", async () => {
    process.env.FMP_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("quote?symbol=MSFT")
          ? Response.json([], { status: 200 })
          : Response.json([], { status: 200 }),
      ),
    );

    await expect(getValuationForTicker("MSFT")).rejects.toThrow(
      "No valuation data available for MSFT",
    );
  });

  it("falls back to quote data when metrics endpoints are unavailable", async () => {
    process.env.FMP_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("quote?symbol=AAPL")) {
          return Response.json([
            {
              marketCap: 2_905_000_000_000,
            },
          ]);
        }

        return Response.json({ error: "blocked" }, { status: 403 });
      }),
    );

    const valuation = await getValuationForTicker("AAPL");

    expect(valuation.ticker).toBe("AAPL");
    expect(valuation.marketCap).toBe(2_905_000_000_000);
    expect(valuation.priceToEarnings).toBeNull();
    expect(valuation.priceToBook).toBeNull();
    expect(valuation.enterpriseValueToEbitda).toBeNull();
    expect(valuation.debtToEquity).toBeNull();
    expect(valuation.returnOnEquity).toBeNull();
    expect(valuation.source).toContain("quote fallback");
    expect(valuation.metrics.some((metric) => metric.id === "marketCap")).toBe(true);
  });

  it("rejects invalid ticker format", async () => {
    process.env.FMP_API_KEY = "test-key";

    await expect(getValuationForTicker("!!!")).rejects.toThrow("Invalid ticker");
  });
});
