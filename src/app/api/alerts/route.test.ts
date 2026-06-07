import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const getCurrentUserId = vi.hoisted(() => vi.fn());
const listAlertPreferences = vi.hoisted(() => vi.fn());
const upsertAlertPreference = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUserId,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
}));

vi.mock("@/lib/research-store", () => ({
  listAlertPreferences,
  upsertAlertPreference,
}));

describe("alerts API route", () => {
  beforeEach(() => {
    getCurrentUserId.mockReset();
    listAlertPreferences.mockReset();
    upsertAlertPreference.mockReset();
  });

  it("rejects unauthenticated users for GET", async () => {
    getCurrentUserId.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(listAlertPreferences).not.toHaveBeenCalled();
  });

  it("returns alerts for signed-in users", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    listAlertPreferences.mockResolvedValueOnce([]);

    const response = await GET();
    const body = (await response.json()) as { alerts: unknown[] };

    expect(response.status).toBe(200);
    expect(body.alerts).toEqual([]);
    expect(listAlertPreferences).toHaveBeenCalledWith("user_1");
  });

  it("creates a new alert preference", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    upsertAlertPreference.mockResolvedValueOnce({
      id: "alert_1",
      userId: "user_1",
      ticker: "AAPL",
      alertType: "revenue",
      config: { threshold: 10, condition: "above" },
      enabled: true,
      lastTriggeredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isNew: true,
    });

    const response = await POST(
      new Request("http://localhost/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          ticker: "AAPL",
          alertType: "revenue",
          threshold: 10,
          condition: "above",
          enabled: true,
        }),
      }),
    );
    const body = (await response.json()) as { alert?: { id: string } };

    expect(response.status).toBe(201);
    expect(body.alert?.id).toBe("alert_1");
  });

  it("updates existing alert preference", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    upsertAlertPreference.mockResolvedValueOnce({
      id: "alert_1",
      userId: "user_1",
      ticker: "AAPL",
      alertType: "revenue",
      config: { threshold: 8, condition: "above" },
      enabled: true,
      lastTriggeredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isNew: false,
    });

    const response = await POST(
      new Request("http://localhost/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          ticker: "AAPL",
          alertType: "revenue",
          threshold: 8,
          condition: "above",
          enabled: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
  });
});
