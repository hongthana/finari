import { describe, expect, it } from "vitest";

import {
  buildPeerComparisonFromSnapshots,
  normalizeCompanySnapshot,
} from "@/lib/financial-analysis";
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
    expect(snapshot.latestFiling?.form).toBe("4");
    expect(snapshot.latestFinancialFiling?.form).toBe("10-K");
    expect(snapshot.latestAnnualFiling?.form).toBe("10-K");
    expect(snapshot.latestQuarterlyFiling?.form).toBe("10-Q");
    expect(snapshot.periods).toHaveLength(2);
    expect(snapshot.periods[0]).toMatchObject({
      fiscalYear: 2025,
      revenue: 410_000_000_000,
      freeCashFlow: 106_000_000_000,
      debt: 100_000_000_000,
      workingCapital: -5_000_000_000,
    });
    expect(snapshot.quarterlyPeriods).toHaveLength(4);
    expect(snapshot.quarterlyPeriods[0]).toMatchObject({
      periodType: "quarterly",
      fiscalPeriod: "Q4",
      revenue: 112_000_000_000,
      freeCashFlow: 29_500_000_000,
    });
    expect(snapshot.ttmPeriod).toMatchObject({
      periodType: "ttm",
      revenue: 410_000_000_000,
      freeCashFlow: 106_000_000_000,
    });
    expect(snapshot.metrics.find((metric) => metric.id === "revenue-growth")?.value)
      .toBeCloseTo(0.051, 3);
    expect(snapshot.changeAnalysis.quarterly[0]).toMatchObject({
      id: "quarterly-revenue",
      signal: "positive",
    });
    expect(snapshot.changeAnalysis.quarterly.map((item) => item.id)).toContain(
      "quarterly-liabilities-to-assets",
    );
    expect(
      snapshot.changeAnalysis.annual.find((item) => item.id === "annual-debt"),
    ).toMatchObject({
      currentValue: 100_000_000_000,
      previousValue: 104_000_000_000,
      signal: "positive",
    });
    expect(snapshot.balanceSheetAnalysis).toMatchObject({
      cash: 32_000_000_000,
      debt: 100_000_000_000,
      workingCapital: -5_000_000_000,
    });
    expect(snapshot.businessDrivers.find((driver) => driver.id === "growth")?.details)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "product-demand" }),
          expect.objectContaining({ id: "recent-quarter-demand" }),
          expect.objectContaining({ id: "services-hardware-mix", signal: "unknown" }),
          expect.objectContaining({ id: "geographic-exposure", signal: "unknown" }),
        ]),
      );
    expect(
      snapshot.businessDrivers.find((driver) => driver.id === "profitability")
        ?.details,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "pricing-power" }),
        expect.objectContaining({ id: "margin-pressure" }),
      ]),
    );
    expect(snapshot.dataQuality.label).toBe("High");
    expect(snapshot.caveatChangeAnalysis.status).toBe("baseline");
    expect(snapshot.decisionFramework.watchMetric).toBeTruthy();
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

  it("tracks new and resolved normalization caveats against a previous snapshot", () => {
    const snapshot = normalizeCompanySnapshot(
      fixtureIdentity,
      fixtureSubmissions,
      {
        cik: 320193,
        entityName: "Apple Inc.",
        facts: { "us-gaap": {} },
      },
      undefined,
      ["Resolved prior caveat."],
    );

    expect(snapshot.caveatChangeAnalysis.status).toBe("changed");
    expect(snapshot.caveatChangeAnalysis.newCaveats).toContain(
      "No annual financial-statement facts were found for this company.",
    );
    expect(snapshot.caveatChangeAnalysis.resolvedCaveats).toContain(
      "Resolved prior caveat.",
    );
  });

  it("computes same-SIC peer medians and limited coverage caveats", () => {
    const target = normalizeCompanySnapshot(
      fixtureIdentity,
      fixtureSubmissions,
      fixtureFacts,
    );
    const peer = {
      ...target,
      identity: { ...target.identity, ticker: "PEER", cik: "0000000001" },
      metrics: target.metrics.map((metric) =>
        metric.id === "operating-margin"
          ? { ...metric, value: 0.2, signal: "positive" as const }
          : metric,
      ),
    };
    const comparison = buildPeerComparisonFromSnapshots(target, [peer]);

    expect(comparison.status).toBe("limited");
    expect(comparison.peerCount).toBe(1);
    expect(
      comparison.metrics.find((metric) => metric.id === "operating-margin")
        ?.peerMedian,
    ).toBeCloseTo(0.2, 3);
  });
});
