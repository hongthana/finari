import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const recordActivityEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getCurrentUser,
  };
});

vi.mock("@/lib/activity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/activity")>();
  return {
    ...actual,
    recordActivityEvent,
  };
});

import { POST } from "./route";

afterEach(() => {
  getCurrentUser.mockReset();
  recordActivityEvent.mockReset();
});

describe("POST /api/activity/client", () => {
  it("rejects anonymous clients", async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("https://www.finari.co/api/activity/client", {
        method: "POST",
        body: JSON.stringify({ events: [{ eventName: "client.page_view" }] }),
      }),
    );

    expect(response.status).toBe(401);
    expect(recordActivityEvent).not.toHaveBeenCalled();
  });

  it("accepts a bounded authenticated event batch", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "user_1",
      email: "investor@example.com",
      isAdmin: false,
    });

    const response = await POST(
      new Request("https://www.finari.co/api/activity/client", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Test Agent",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({
          events: [
            {
              eventName: "workspace.save_research",
              path: "/en?ticker=AAPL",
              locale: "en",
              ticker: "AAPL",
              metadata: {
                buttonId: "save",
                clickX: 120,
                clickY: 240,
                clickPercentX: 12,
                clickPercentY: 30,
                heatmapZone: "middle-left",
              },
            },
          ],
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, accepted: 1 });
    expect(recordActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        email: "investor@example.com",
        category: "client",
        eventName: "workspace.save_research",
        path: "/en?ticker=AAPL",
        locale: "en",
        ticker: "AAPL",
        metadata: expect.objectContaining({
          heatmapZone: "middle-left",
          clickX: 120,
          clickY: 240,
        }),
      }),
    );
  });
});
