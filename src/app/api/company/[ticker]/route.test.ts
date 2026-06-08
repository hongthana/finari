import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCompanyFacts } from "@/lib/sec";

import { GET } from "./route";

const requireInvitationAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sec", async () => {
  const fixtures = await import("@/test/fixtures");
  const actual = await vi.importActual<typeof import("@/lib/sec")>("@/lib/sec");

  return {
    ...actual,
    findCompanyByTicker: vi.fn(async (ticker: string) =>
      ["AAPL", "MSFT"].includes(ticker.toUpperCase())
        ? { ...fixtures.fixtureIdentity, ticker: ticker.toUpperCase() }
        : null,
    ),
    getSubmissions: vi.fn(async () => fixtures.fixtureSubmissions),
    getCompanyFacts: vi.fn(async () => fixtures.fixtureFacts),
  };
});

vi.mock("@/lib/site-access", () => ({
  requireInvitationAccess,
}));

beforeEach(() => {
  requireInvitationAccess.mockClear();
  requireInvitationAccess.mockResolvedValue(null);
  process.env.REFRESH_CRON_SECRET = "";
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

  it("bypasses a fresh stored snapshot when refresh is requested", async () => {
    const getCompanyFactsMock = vi.mocked(getCompanyFacts);

    getCompanyFactsMock.mockClear();
    await GET(new Request("http://localhost/api/company/MSFT"), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });
    expect(getCompanyFactsMock).toHaveBeenCalledTimes(1);

    getCompanyFactsMock.mockClear();
    await GET(new Request("http://localhost/api/company/MSFT"), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });
    expect(getCompanyFactsMock).not.toHaveBeenCalled();

    getCompanyFactsMock.mockClear();
    await GET(new Request("http://localhost/api/company/MSFT?refresh=1"), {
      params: Promise.resolve({ ticker: "MSFT" }),
    });
    expect(getCompanyFactsMock).toHaveBeenCalledTimes(1);
  });

  it("allows the refresh cron secret to bypass invitation gating", async () => {
    process.env.REFRESH_CRON_SECRET = "refresh-secret";

    const response = await GET(
      new Request("http://localhost/api/company/MSFT", {
        headers: {
          authorization: "Bearer refresh-secret",
        },
      }),
      {
        params: Promise.resolve({ ticker: "MSFT" }),
      },
    );

    expect(response.status).toBe(200);
    expect(requireInvitationAccess).not.toHaveBeenCalled();
  });
});
