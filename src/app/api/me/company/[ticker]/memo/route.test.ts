import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureIdentity } from "@/test/fixtures";

import { POST } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const getPrivateResearchMemoForTicker = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUser,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
}));

vi.mock("@/lib/research-service", () => ({
  companyLookupError: vi.fn(() => null),
  getPrivateResearchMemoForTicker,
}));

function context(ticker: string) {
  return {
    params: Promise.resolve({ ticker }),
  };
}

describe("private company memo API route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getPrivateResearchMemoForTicker.mockReset();
  });

  it("requires authentication", async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/me/company/AAPL/memo?locale=en", {
        method: "POST",
      }),
      context("AAPL"),
    );

    expect(response.status).toBe(401);
    expect(getPrivateResearchMemoForTicker).not.toHaveBeenCalled();
  });

  it("generates a private memo for the signed-in user", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "user_1",
      email: "investor@example.com",
      isAdmin: false,
    });
    getPrivateResearchMemoForTicker.mockResolvedValueOnce({
      memo: {
        company: fixtureIdentity,
        generatedAt: new Date().toISOString(),
        mode: "fallback",
        visibility: "private",
        disclaimer: "Educational research only.",
        sections: [],
        citations: [],
      },
      memoId: "private-memo",
      snapshotId: "snapshot",
    });

    const response = await POST(
      new Request("http://localhost/api/me/company/AAPL/memo?locale=th", {
        method: "POST",
      }),
      context("AAPL"),
    );

    expect(response.status).toBe(200);
    expect(getPrivateResearchMemoForTicker).toHaveBeenCalledWith("user_1", "AAPL", "th");
  });
});
