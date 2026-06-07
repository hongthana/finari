import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAlertDeliveryJob } from "./alert-delivery";

const getLatestStoredSnapshot = vi.hoisted(() => vi.fn());
const listEnabledAlertPreferencesForDelivery = vi.hoisted(() => vi.fn());
const markAlertPreferenceTriggered = vi.hoisted(() => vi.fn());
const recordAlertDelivery = vi.hoisted(() => vi.fn());
const updateAlertDeliveryEmailStatus = vi.hoisted(() => vi.fn());
const sendAlertDeliveryEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/research-store", () => ({
  getLatestStoredSnapshot,
  listEnabledAlertPreferencesForDelivery,
  markAlertPreferenceTriggered,
  recordAlertDelivery,
  updateAlertDeliveryEmailStatus,
}));

vi.mock("@/lib/alert-email", () => ({
  sendAlertDeliveryEmail,
}));

describe("alert delivery job", () => {
  beforeEach(() => {
    getLatestStoredSnapshot.mockReset();
    listEnabledAlertPreferencesForDelivery.mockReset();
    markAlertPreferenceTriggered.mockReset();
    recordAlertDelivery.mockReset();
    updateAlertDeliveryEmailStatus.mockReset();
    sendAlertDeliveryEmail.mockReset();
  });

  it("queues and emails a triggered alert", async () => {
    listEnabledAlertPreferencesForDelivery.mockResolvedValueOnce([
      {
        id: "alert_1",
        userId: "user_1",
        ticker: "AAPL",
        alertType: "revenue",
        config: { threshold: 100_000_000_000, condition: "above", notes: "watch revenue" },
        enabled: true,
        lastTriggeredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        companyName: "Apple Inc.",
        email: "investor@example.com",
      },
    ]);
    getLatestStoredSnapshot.mockResolvedValueOnce({
      snapshotId: "snapshot_1",
      companyId: "company_1",
      sourceHash: "source_hash_1",
      snapshot: {
        identity: { ticker: "AAPL", name: "Apple Inc.", cik: "0000320193" },
        periods: [
          {
            revenue: 120_000_000_000,
            netIncome: 40_000_000_000,
            freeCashFlow: 30_000_000_000,
            cash: 32_000_000_000,
            debt: 100_000_000_000,
            workingCapital: 5_000_000_000,
            equity: 200_000_000_000,
          },
          {
            revenue: 100_000_000_000,
            netIncome: 35_000_000_000,
            freeCashFlow: 28_000_000_000,
            cash: 30_000_000_000,
            debt: 104_000_000_000,
            workingCapital: 4_500_000_000,
            equity: 190_000_000_000,
          },
        ],
      },
    });
    recordAlertDelivery.mockResolvedValueOnce({
      id: "delivery_1",
      userId: "user_1",
      alertPreferenceId: "alert_1",
      companyName: "Apple Inc.",
      ticker: "AAPL",
      alertType: "revenue",
      channel: "in-app",
      status: "queued",
      emailStatus: "queued",
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
    sendAlertDeliveryEmail.mockResolvedValueOnce({ status: "sent" });
    markAlertPreferenceTriggered.mockResolvedValueOnce(undefined);
    updateAlertDeliveryEmailStatus.mockResolvedValueOnce({
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

    const summary = await runAlertDeliveryJob();

    expect(summary).toEqual({
      scanned: 1,
      triggered: 1,
      queued: 1,
      emailSent: 1,
      emailFailed: 0,
      skipped: 0,
      deduped: 0,
    });
    expect(recordAlertDelivery).toHaveBeenCalledTimes(1);
    expect(sendAlertDeliveryEmail).toHaveBeenCalledTimes(1);
    expect(markAlertPreferenceTriggered).toHaveBeenCalledWith(
      expect.objectContaining({ alertId: "alert_1", userId: "user_1" }),
    );
    expect(updateAlertDeliveryEmailStatus).toHaveBeenCalledWith(
      expect.objectContaining({ alertDeliveryId: "delivery_1", emailStatus: "sent" }),
    );
  });
});
