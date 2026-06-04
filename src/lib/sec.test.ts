import { afterEach, describe, expect, it, vi } from "vitest";

import { clearSecCache, getTickerDirectory, padCik, searchCompanies } from "@/lib/sec";

afterEach(() => {
  vi.restoreAllMocks();
  clearSecCache();
});

describe("SEC client helpers", () => {
  it("pads CIK values to the SEC ten-digit format", () => {
    expect(padCik(320193)).toBe("0000320193");
    expect(padCik("CIK 789019")).toBe("0000789019");
  });

  it("loads and searches the SEC ticker directory", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          0: { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
          1: { cik_str: 789019, ticker: "MSFT", title: "Microsoft Corporation" },
        }),
      ),
    );

    await expect(getTickerDirectory()).resolves.toHaveLength(2);
    await expect(searchCompanies("micro")).resolves.toMatchObject([
      { ticker: "MSFT", cik: "0000789019" },
    ]);
  });
});
