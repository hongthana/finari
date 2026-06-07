import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const getCurrentUserId = vi.hoisted(() => vi.fn());
const listAlertDeliveries = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUserId,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
}));

vi.mock("@/lib/research-store", () => ({
  listAlertDeliveries,
}));

describe("alert deliveries route", () => {
  beforeEach(() => {
    getCurrentUserId.mockReset();
    listAlertDeliveries.mockReset();
  });

  it("returns deliveries for signed-in users", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    listAlertDeliveries.mockResolvedValueOnce([
      {
        id: "delivery_1",
        userId: "user_1",
        alertPreferenceId: "alert_1",
        companyName: "Apple Inc.",
        ticker: "AAPL",
        alertType: "revenue",
        channel: "in-app",
        status: "queued",
        emailStatus: "sent",
        emailError: null,
        title: "AAPL annual revenue above $100B",
        body: "body",
        payload: {},
        dedupeKey: "dedupe_1",
        currentValue: 120_000_000_000,
        previousValue: 100_000_000_000,
        threshold: 100_000_000_000,
        condition: "above",
        unit: "currency",
        deliveredAt: new Date().toISOString(),
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const body = (await response.json()) as { deliveries: unknown[]; unreadCount: number };

    expect(response.status).toBe(200);
    expect(body.deliveries).toHaveLength(1);
    expect(body.unreadCount).toBe(1);
    expect(listAlertDeliveries).toHaveBeenCalledWith("user_1");
  });
});
