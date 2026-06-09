import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const voteForTileFeedback = vi.hoisted(() => vi.fn());
const recordActivityEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/activity", () => ({
  activityRequestContext: () => ({
    path: "/api/feedback/feedback_1/vote",
    method: "POST",
    ipHash: "ip_hash",
    userAgentHash: "ua_hash",
  }),
  recordActivityEvent,
}));

vi.mock("@/lib/tile-feedback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tile-feedback")>();
  return {
    ...actual,
    voteForTileFeedback,
  };
});

describe("feedback vote API route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    voteForTileFeedback.mockReset();
    recordActivityEvent.mockReset();
  });

  it("omits captured snapshots and request context from public vote responses", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    voteForTileFeedback.mockResolvedValueOnce({
      voted: true,
      feedback: {
        id: "feedback_1",
        ticker: "AAPL",
        locale: "en",
        tileId: "revenue-card",
        tileLabel: "Revenue",
        pagePath: "/en?ticker=AAPL",
        feedback: "Show more revenue context",
        screenshot: {
          html: "<section>private captured card html</section>",
          text: "private captured card text",
        },
        status: "new",
        votes: 4,
        createdAt: new Date("2026-06-09T08:00:00.000Z"),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/feedback/feedback_1/vote", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "feedback_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      voted: true,
      feedback: {
        id: "feedback_1",
        tileId: "revenue-card",
        tileLabel: "Revenue",
        feedback: "Show more revenue context",
        votes: 4,
        createdAt: "2026-06-09T08:00:00.000Z",
      },
    });
    expect(JSON.stringify(body)).not.toContain("screenshot");
    expect(JSON.stringify(body)).not.toContain("pagePath");
    expect(JSON.stringify(body)).not.toContain("private captured card");
  });
});
