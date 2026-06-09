import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const listTileFeedback = vi.hoisted(() => vi.fn());
const createTileFeedback = vi.hoisted(() => vi.fn());
const recordActivityEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/activity", () => ({
  activityRequestContext: () => ({
    path: "/api/feedback",
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
    createTileFeedback,
    listTileFeedback,
  };
});

const privateFeedback = {
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
  votes: 3,
  createdAt: new Date("2026-06-09T08:00:00.000Z"),
};

describe("feedback API route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    listTileFeedback.mockReset();
    createTileFeedback.mockReset();
    recordActivityEvent.mockReset();
  });

  it("omits captured snapshots and request context from public list responses", async () => {
    listTileFeedback.mockResolvedValueOnce([privateFeedback]);

    const response = await GET(
      new Request("http://localhost/api/feedback?ticker=AAPL&tileId=revenue-card"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.feedback).toEqual([
      {
        id: "feedback_1",
        tileId: "revenue-card",
        tileLabel: "Revenue",
        feedback: "Show more revenue context",
        votes: 3,
        createdAt: "2026-06-09T08:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(body)).not.toContain("screenshot");
    expect(JSON.stringify(body)).not.toContain("pagePath");
    expect(JSON.stringify(body)).not.toContain("private captured card");
  });

  it("omits captured snapshots from create responses", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user_1", email: "user@example.com" });
    createTileFeedback.mockResolvedValueOnce(privateFeedback);

    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          ticker: "AAPL",
          locale: "en",
          tileId: "revenue-card",
          tileLabel: "Revenue",
          pagePath: "/en?ticker=AAPL",
          feedback: "Show more revenue context",
          screenshot: { html: "<section>private captured card html</section>" },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.feedback).toEqual({
      id: "feedback_1",
      tileId: "revenue-card",
      tileLabel: "Revenue",
      feedback: "Show more revenue context",
      votes: 3,
      createdAt: "2026-06-09T08:00:00.000Z",
    });
    expect(JSON.stringify(body)).not.toContain("screenshot");
    expect(JSON.stringify(body)).not.toContain("pagePath");
    expect(JSON.stringify(body)).not.toContain("private captured card");
  });
});
