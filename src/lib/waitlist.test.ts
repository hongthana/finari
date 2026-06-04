import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeWaitlistDatabase, saveWaitlistLead } from "@/lib/waitlist";

beforeEach(() => {
  process.env.FINARI_DB_PATH = ":memory:";
});

afterEach(() => {
  closeWaitlistDatabase();
  delete process.env.FINARI_DB_PATH;
});

describe("waitlist storage", () => {
  it("saves a normalized waitlist lead", () => {
    const lead = saveWaitlistLead({
      email: "Investor@Example.com",
      investorProfile: "Long-term investor",
      interestArea: "Saved research",
      sourceTicker: "aapl",
    });

    expect(lead).toMatchObject({
      email: "investor@example.com",
      investorProfile: "Long-term investor",
      interestArea: "Saved research",
      sourceTicker: "AAPL",
    });
    expect(lead.id).toBeGreaterThan(0);
  });

  it("rejects invalid emails", () => {
    expect(() =>
      saveWaitlistLead({
        email: "not-an-email",
        investorProfile: "Retail investor",
        interestArea: "Alerts",
      }),
    ).toThrow();
  });
});
