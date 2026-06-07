import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const getValuationForTicker = vi.hoisted(() => vi.fn());

vi.mock("@/lib/valuation", () => ({
  getValuationForTicker,
}));

function context(ticker: string) {
  return {
    params: Promise.resolve({ ticker }),
  };
}

describe("valuation API route", () => {
  beforeEach(() => {
    getValuationForTicker.mockReset();
  });

  it("returns 503 when FMP key is missing", async () => {
    getValuationForTicker.mockRejectedValueOnce(new Error("FMP_API_KEY is not configured"));

    const response = await GET(new Request("http://localhost/api/valuation/AAPL"), context("AAPL"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "FMP API key is not configured" });
  });

  it("returns valuation for valid ticker", async () => {
    getValuationForTicker.mockResolvedValueOnce({
      ticker: "AAPL",
      asOf: "2026-06-07T00:00:00.000Z",
      marketCap: 2_000_000_000_000,
      priceToEarnings: 30,
      priceToBook: 40,
      enterpriseValueToEbitda: 20,
      debtToEquity: 1.2,
      returnOnEquity: 32,
      currency: "USD",
      source: "financialmodelingprep.com",
    });

    const response = await GET(new Request("http://localhost/api/valuation/AAPL"), context("AAPL"));
    const body = (await response.json()) as { valuation?: { ticker: string } };

    expect(response.status).toBe(200);
    expect(body.valuation?.ticker).toBe("AAPL");
    expect(getValuationForTicker).toHaveBeenCalledWith("AAPL");
  });

  it("returns 400 for malformed ticker", async () => {
    getValuationForTicker.mockRejectedValueOnce(new Error("Invalid ticker: !!!"));

    const response = await GET(new Request("http://localhost/api/valuation/!!!"), context("!!!"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid ticker: !!!" });
  });

  it("returns 502 for upstream request errors", async () => {
    getValuationForTicker.mockRejectedValueOnce(new Error("network down"));

    const response = await GET(new Request("http://localhost/api/valuation/AAPL"), context("AAPL"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "network down" });
  });
});
