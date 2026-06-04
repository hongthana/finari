import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureIdentity } from "@/test/fixtures";

import { POST } from "./route";

const getResearchMemoForTicker = vi.hoisted(() => vi.fn());

vi.mock("@/lib/research-service", () => ({
  companyLookupError: vi.fn(() => null),
  getResearchMemoForTicker,
}));

function context(ticker: string) {
  return {
    params: Promise.resolve({ ticker }),
  };
}

describe("company memo API route", () => {
  beforeEach(() => {
    getResearchMemoForTicker.mockReset();
  });

  it("passes Thai locale through to memo generation", async () => {
    getResearchMemoForTicker.mockResolvedValueOnce({
      memo: {
        company: fixtureIdentity,
        generatedAt: new Date().toISOString(),
        mode: "fallback",
        disclaimer: "เพื่อการศึกษาเท่านั้น",
        sections: [],
        citations: [],
      },
      memoId: "memo-th",
      snapshotId: "snapshot",
    });

    const response = await POST(
      new Request("http://localhost/api/company/AAPL/memo?locale=th", {
        method: "POST",
      }),
      context("AAPL"),
    );

    expect(response.status).toBe(200);
    expect(getResearchMemoForTicker).toHaveBeenCalledWith("AAPL", "th");
  });

  it("falls back to English for invalid locale values", async () => {
    getResearchMemoForTicker.mockResolvedValueOnce({
      memo: {
        company: fixtureIdentity,
        generatedAt: new Date().toISOString(),
        mode: "fallback",
        disclaimer: "Educational research only.",
        sections: [],
        citations: [],
      },
      memoId: "memo-en",
      snapshotId: "snapshot",
    });

    const response = await POST(
      new Request("http://localhost/api/company/AAPL/memo?locale=fr", {
        method: "POST",
      }),
      context("AAPL"),
    );

    expect(response.status).toBe(200);
    expect(getResearchMemoForTicker).toHaveBeenCalledWith("AAPL", "en");
  });
});
