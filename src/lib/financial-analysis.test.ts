import { describe, expect, it } from "vitest";

import { normalizeCompanySnapshot } from "@/lib/financial-analysis";
import {
  fixtureFacts,
  fixtureIdentity,
  fixtureSubmissions,
} from "@/test/fixtures";

describe("financial analysis", () => {
  it("normalizes annual facts and computes core ratios", () => {
    const snapshot = normalizeCompanySnapshot(
      fixtureIdentity,
      fixtureSubmissions,
      fixtureFacts,
    );

    expect(snapshot.identity.exchange).toBe("Nasdaq");
    expect(snapshot.periods).toHaveLength(2);
    expect(snapshot.periods[0]).toMatchObject({
      fiscalYear: 2025,
      revenue: 410_000_000_000,
      freeCashFlow: 106_000_000_000,
      debt: 100_000_000_000,
    });
    expect(snapshot.metrics.find((metric) => metric.id === "revenue-growth")?.value)
      .toBeCloseTo(0.051, 3);
    expect(snapshot.citations[0].url).toContain("Archives/edgar/data/320193");
  });

  it("surfaces caveats when required facts are missing", () => {
    const snapshot = normalizeCompanySnapshot(fixtureIdentity, fixtureSubmissions, {
      cik: 320193,
      entityName: "Apple Inc.",
      facts: { "us-gaap": {} },
    });

    expect(snapshot.caveats).toContain(
      "No annual financial-statement facts were found for this company.",
    );
  });
});
