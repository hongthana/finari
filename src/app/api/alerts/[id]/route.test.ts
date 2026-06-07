import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const getCurrentUserId = vi.hoisted(() => vi.fn());
const getAlertPreference = vi.hoisted(() => vi.fn());
const patchAlertPreference = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  getCurrentUserId,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
}));

vi.mock("@/lib/research-store", () => ({
  getAlertPreference,
  patchAlertPreference,
}));

describe("alert update API route", () => {
  beforeEach(() => {
    getCurrentUserId.mockReset();
    getAlertPreference.mockReset();
    patchAlertPreference.mockReset();
  });

  it("rejects unauthenticated users", async () => {
    getCurrentUserId.mockResolvedValueOnce(null);

    const response = await PATCH(new Request("http://localhost/api/alerts/alert_1", { method: "PATCH" }), {
      params: Promise.resolve({ id: "alert_1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  it("returns 404 when alert is missing", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    getAlertPreference.mockResolvedValueOnce(null);

    const response = await PATCH(
      new Request("http://localhost/api/alerts/alert_1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      {
        params: Promise.resolve({ id: "alert_1" }),
      },
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("Alert not found");
  });

  it("updates an existing alert", async () => {
    getCurrentUserId.mockResolvedValueOnce("user_1");
    getAlertPreference.mockResolvedValueOnce({
      id: "alert_1",
      userId: "user_1",
      ticker: "AAPL",
      alertType: "revenue",
      config: { threshold: 8, condition: "above", notes: "" },
      enabled: true,
      lastTriggeredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    patchAlertPreference.mockResolvedValueOnce({
      id: "alert_1",
      userId: "user_1",
      ticker: "AAPL",
      alertType: "revenue",
      config: { threshold: 8, condition: "below", notes: "test" },
      enabled: true,
      lastTriggeredAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await PATCH(
      new Request("http://localhost/api/alerts/alert_1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, condition: "below", threshold: 8, notes: "test" }),
      }),
      {
        params: Promise.resolve({ id: "alert_1" }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { alert?: { id: string } };
    expect(body.alert?.id).toBe("alert_1");
    expect(patchAlertPreference).toHaveBeenCalled();
  });
});
