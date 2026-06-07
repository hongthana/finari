import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const runAlertDeliveryJob = vi.hoisted(() => vi.fn());
const getAlertsCronSecret = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({
  getAlertsCronSecret,
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser,
  unauthorized: () => Response.json({ error: "Authentication required" }, { status: 401 }),
  forbidden: () => Response.json({ error: "Admin access required" }, { status: 403 }),
}));

vi.mock("@/lib/alert-delivery", () => ({
  runAlertDeliveryJob,
}));

describe("admin alert delivery route", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    runAlertDeliveryJob.mockReset();
    getAlertsCronSecret.mockReset();
    getAlertsCronSecret.mockReturnValue("");
  });

  it("rejects unauthenticated users", async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new Request("http://localhost/api/admin/alerts/deliver", { method: "POST" }));

    expect(response.status).toBe(401);
  });

  it("runs the delivery job for admins", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "user_1", email: "admin@example.com", isAdmin: true });
    runAlertDeliveryJob.mockResolvedValueOnce({
      scanned: 1,
      triggered: 1,
      queued: 1,
      emailSent: 1,
      emailFailed: 0,
      skipped: 0,
      deduped: 0,
    });

    const response = await POST(new Request("http://localhost/api/admin/alerts/deliver", { method: "POST" }));
    const body = (await response.json()) as { summary?: { triggered: number } };

    expect(response.status).toBe(200);
    expect(body.summary?.triggered).toBe(1);
    expect(runAlertDeliveryJob).toHaveBeenCalledTimes(1);
  });

  it("runs the delivery job for the scheduled cron secret", async () => {
    getAlertsCronSecret.mockReturnValueOnce("cron-secret");
    runAlertDeliveryJob.mockResolvedValueOnce({
      scanned: 1,
      triggered: 1,
      queued: 1,
      emailSent: 0,
      emailFailed: 0,
      skipped: 0,
      deduped: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/alerts/deliver", {
        method: "POST",
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );
    const body = (await response.json()) as { summary?: { queued: number } };

    expect(response.status).toBe(200);
    expect(body.summary?.queued).toBe(1);
    expect(runAlertDeliveryJob).toHaveBeenCalledTimes(1);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});
