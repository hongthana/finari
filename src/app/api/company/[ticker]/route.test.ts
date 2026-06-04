import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/sec", async () => {
  const fixtures = await import("@/test/fixtures");
  const actual = await vi.importActual<typeof import("@/lib/sec")>("@/lib/sec");

  return {
    ...actual,
    findCompanyByTicker: vi.fn(async (ticker: string) =>
      ticker.toUpperCase() === "AAPL" ? fixtures.fixtureIdentity : null,
    ),
    getSubmissions: vi.fn(async () => fixtures.fixtureSubmissions),
    getCompanyFacts: vi.fn(async () => fixtures.fixtureFacts),
  };
});

describe("company API route", () => {
  it("returns a normalized company snapshot", async () => {
    const response = await GET(new Request("http://localhost/api/company/AAPL"), {
      params: Promise.resolve({ ticker: "AAPL" }),
    });
    const body = (await response.json()) as { snapshot?: unknown };

    expect(response.status).toBe(200);
    expect(body.snapshot).toMatchObject({
      identity: { ticker: "AAPL" },
    });
    expect((body.snapshot as { periods: Array<{ fiscalYear: number }> }).periods[0])
      .toMatchObject({ fiscalYear: 2025 });
  });

  it("returns 404 for unknown tickers", async () => {
    const response = await GET(new Request("http://localhost/api/company/NOPE"), {
      params: Promise.resolve({ ticker: "NOPE" }),
    });

    expect(response.status).toBe(404);
  });
});
