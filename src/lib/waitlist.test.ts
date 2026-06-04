import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeWaitlistDatabase, saveWaitlistLead } from "@/lib/waitlist";

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  closeWaitlistDatabase();
});

describe("waitlist storage", () => {
  it("saves a normalized waitlist lead", async () => {
    const lead = await saveWaitlistLead({
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
    expect(lead.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects invalid emails", async () => {
    await expect(
      saveWaitlistLead({
        email: "not-an-email",
        investorProfile: "Retail investor",
        interestArea: "Alerts",
      }),
    ).rejects.toThrow();
  });
});
