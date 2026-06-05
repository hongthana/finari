import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureIdentity } from "@/test/fixtures";

import { POST } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const publishPublicResearchMemoForTicker = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  forbidden: () => Response.json({ error: "Admin access required" }, { status: 403 }),
  getCurrentUser,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
}));

vi.mock("@/lib/research-service", () => ({
  companyLookupError: vi.fn(() => null),
  publishPublicResearchMemoForTicker,
}));

function context(ticker: string) {
  return {
    params: Promise.resolve({ ticker }),
  };
}

describe("admin public memo API route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    publishPublicResearchMemoForTicker.mockReset();
  });

  it("rejects signed-in non-admin users", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "user_1",
      email: "investor@example.com",
      isAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/company/AAPL/memo?locale=en", {
        method: "POST",
      }),
      context("AAPL"),
    );

    expect(response.status).toBe(403);
    expect(publishPublicResearchMemoForTicker).not.toHaveBeenCalled();
  });

  it("allows admins to publish the public memo", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "admin_1",
      email: "admin@example.com",
      isAdmin: true,
    });
    publishPublicResearchMemoForTicker.mockResolvedValueOnce({
      memo: {
        company: fixtureIdentity,
        generatedAt: new Date().toISOString(),
        mode: "fallback",
        visibility: "public",
        disclaimer: "Educational research only.",
        sections: [],
        citations: [],
      },
      memoId: "public-memo",
      snapshotId: "snapshot",
    });

    const response = await POST(
      new Request("http://localhost/api/admin/company/AAPL/memo?locale=th", {
        method: "POST",
      }),
      context("AAPL"),
    );

    expect(response.status).toBe(200);
    expect(publishPublicResearchMemoForTicker).toHaveBeenCalledWith(
      "admin_1",
      "AAPL",
      "th",
    );
  });
});
