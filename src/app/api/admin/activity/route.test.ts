import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const listActivityEvents = vi.hoisted(() => vi.fn());
const countActivityEvents = vi.hoisted(() => vi.fn());
const summarizeActivityEvents = vi.hoisted(() => vi.fn());
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
    listActivityEvents,
    countActivityEvents,
    summarizeActivityEvents,
    recordActivityEvent,
  };
});

import { GET } from "./route";

afterEach(() => {
  getCurrentUser.mockReset();
  listActivityEvents.mockReset();
  countActivityEvents.mockReset();
  summarizeActivityEvents.mockReset();
  recordActivityEvent.mockReset();
});

describe("GET /api/admin/activity", () => {
  it("rejects non-admin users", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "user_1",
      email: "user@example.com",
      isAdmin: false,
    });

    const response = await GET(new Request("https://www.finari.co/api/admin/activity"));

    expect(response.status).toBe(403);
    expect(listActivityEvents).not.toHaveBeenCalled();
  });

  it("returns filtered activity for admins", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "admin_1",
      email: "admin@example.com",
      isAdmin: true,
    });
    listActivityEvents.mockResolvedValueOnce([
      { id: "event_1", eventName: "client.page_view" },
    ]);
    countActivityEvents.mockResolvedValueOnce(1);
    summarizeActivityEvents.mockResolvedValueOnce({
      byCategory: [{ category: "client", total: 1 }],
      recentFailures: [],
    });

    const response = await GET(
      new Request(
        "https://www.finari.co/api/admin/activity?category=client&ticker=AAPL&limit=25",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      events: [{ id: "event_1", eventName: "client.page_view" }],
      total: 1,
      summary: {
        byCategory: [{ category: "client", total: 1 }],
        recentFailures: [],
      },
    });
    expect(listActivityEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "client",
        ticker: "AAPL",
        limit: 25,
      }),
    );
  });
});
