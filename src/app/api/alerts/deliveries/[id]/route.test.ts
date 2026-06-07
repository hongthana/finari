import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const getCurrentUserId = vi.hoisted(() => vi.fn());
const getAlertDelivery = vi.hoisted(() => vi.fn());
const markAlertDeliveryRead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUserId,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
}));

vi.mock("@/lib/research-store", () => ({
  getAlertDelivery,
  markAlertDeliveryRead,
}));

describe("alert delivery update route", () => {
  beforeEach(() => {
    getCurrentUserId.mockReset();
    getAlertDelivery.mockReset();
    markAlertDeliveryRead.mockReset();
  });

  it("marks an unread delivery as read", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    getAlertDelivery.mockResolvedValueOnce({
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
    });
    markAlertDeliveryRead.mockResolvedValueOnce({
      id: "delivery_1",
      userId: "user_1",
      alertPreferenceId: "alert_1",
      companyName: "Apple Inc.",
      ticker: "AAPL",
      alertType: "revenue",
      channel: "in-app",
      status: "read",
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
      readAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await PATCH(
      new Request("http://localhost/api/alerts/deliveries/delivery_1", { method: "PATCH", body: JSON.stringify({ read: true }) }),
      {
        params: Promise.resolve({ id: "delivery_1" }),
      },
    );
    const body = (await response.json()) as { delivery?: { id: string; status: string } };

    expect(response.status).toBe(200);
    expect(body.delivery?.id).toBe("delivery_1");
    expect(body.delivery?.status).toBe("read");
    expect(markAlertDeliveryRead).toHaveBeenCalledTimes(1);
  });
});
