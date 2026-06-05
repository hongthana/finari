import type {
  SecCompanyFactsResponse,
  SecSubmissionsResponse,
} from "@/lib/sec";
import { normalizeCompanySnapshot } from "@/lib/financial-analysis";

export const fixtureIdentity = {
  cik: "0000320193",
  ticker: "AAPL",
  name: "Apple Inc.",
};

export const fixtureSubmissions: SecSubmissionsResponse = {
  cik: "0000320193",
  name: "Apple Inc.",
  tickers: ["AAPL"],
  exchanges: ["Nasdaq"],
  sic: "3571",
  sicDescription: "Electronic Computers",
  fiscalYearEnd: "0927",
  filings: {
    recent: {
      accessionNumber: [
        "0000320193-26-000003",
        "0000320193-25-000079",
        "0000320193-25-000050",
        "0000320193-25-000030",
        "0000320193-25-000010",
      ],
      filingDate: [
        "2026-01-05",
        "2025-10-31",
        "2025-08-01",
        "2025-05-02",
        "2025-01-31",
      ],
      reportDate: [
        "2026-01-04",
        "2025-09-27",
        "2025-06-28",
        "2025-03-29",
        "2024-12-28",
      ],
      form: ["4", "10-K", "10-Q", "10-Q", "10-Q"],
      primaryDocument: [
        "xslF345X05/wk-form4_1767610000.xml",
        "aapl-20250927.htm",
        "aapl-20250628.htm",
        "aapl-20250329.htm",
        "aapl-20241228.htm",
      ],
    },
  },
};

function annualFact(
  fy: number,
  val: number,
  tagSuffix = "",
  unitExtras: Partial<{ end: string; filed: string }> = {},
) {
  return {
    fy,
    fp: "FY",
    form: "10-K",
    filed: unitExtras.filed ?? `${fy}-10-31`,
    end: unitExtras.end ?? `${fy}-09-27`,
    frame: `CY${fy}`,
    accn: `0000320193-${String(fy).slice(2)}-000079${tagSuffix}`,
    val,
  };
}

function quarterFact(
  fy: number,
  fp: "Q1" | "Q2" | "Q3" | "Q4",
  val: number,
  end: string,
  filed: string,
  form = fp === "Q4" ? "10-K" : "10-Q",
) {
  return {
    fy,
    fp,
    form,
    filed,
    start: "",
    end,
    frame: `CY${fy}${fp}`,
    accn: `0000320193-${String(fy).slice(2)}-${fp}`,
    val,
  };
}

export const fixtureFacts: SecCompanyFactsResponse = {
  cik: 320193,
  entityName: "Apple Inc.",
  facts: {
    "us-gaap": {
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            annualFact(2025, 410_000_000_000),
            annualFact(2024, 390_000_000_000),
            quarterFact(2025, "Q4", 112_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 98_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 97_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 103_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      GrossProfit: {
        units: {
          USD: [
            annualFact(2025, 185_000_000_000),
            annualFact(2024, 175_000_000_000),
            quarterFact(2025, "Q4", 50_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 44_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 43_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 48_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      OperatingIncomeLoss: {
        units: {
          USD: [
            annualFact(2025, 125_000_000_000),
            annualFact(2024, 115_000_000_000),
            quarterFact(2025, "Q4", 35_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 29_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 28_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 33_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [
            annualFact(2025, 102_000_000_000),
            annualFact(2024, 95_000_000_000),
            quarterFact(2025, "Q4", 29_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 24_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 23_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 26_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      Assets: {
        units: {
          USD: [
            annualFact(2025, 365_000_000_000),
            annualFact(2024, 350_000_000_000),
            quarterFact(2025, "Q4", 365_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 360_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 355_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 352_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      Liabilities: {
        units: {
          USD: [
            annualFact(2025, 280_000_000_000),
            annualFact(2024, 270_000_000_000),
            quarterFact(2025, "Q4", 280_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 276_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 274_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 272_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      AssetsCurrent: {
        units: {
          USD: [
            annualFact(2025, 145_000_000_000),
            annualFact(2024, 140_000_000_000),
            quarterFact(2025, "Q4", 145_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 142_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 141_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 139_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      LiabilitiesCurrent: {
        units: {
          USD: [
            annualFact(2025, 150_000_000_000),
            annualFact(2024, 145_000_000_000),
            quarterFact(2025, "Q4", 150_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 148_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 147_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 146_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      StockholdersEquity: {
        units: {
          USD: [
            annualFact(2025, 85_000_000_000),
            annualFact(2024, 80_000_000_000),
            quarterFact(2025, "Q4", 85_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 84_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 81_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 80_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      CashAndCashEquivalentsAtCarryingValue: {
        units: {
          USD: [
            annualFact(2025, 32_000_000_000),
            annualFact(2024, 30_000_000_000),
            quarterFact(2025, "Q4", 32_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 34_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 33_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 31_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      ShortTermDebtCurrent: {
        units: {
          USD: [annualFact(2025, 10_000_000_000), annualFact(2024, 9_000_000_000)],
        },
      },
      LongTermDebtNoncurrent: {
        units: {
          USD: [annualFact(2025, 90_000_000_000), annualFact(2024, 95_000_000_000)],
        },
      },
      NetCashProvidedByUsedInOperatingActivities: {
        units: {
          USD: [
            annualFact(2025, 118_000_000_000),
            annualFact(2024, 110_000_000_000),
            quarterFact(2025, "Q4", 33_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 27_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 28_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 30_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      PaymentsToAcquirePropertyPlantAndEquipment: {
        units: {
          USD: [
            annualFact(2025, 12_000_000_000),
            annualFact(2024, 11_000_000_000),
            quarterFact(2025, "Q4", 3_500_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 3_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 2_700_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 2_800_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      ResearchAndDevelopmentExpense: {
        units: {
          USD: [
            annualFact(2025, 32_000_000_000),
            annualFact(2024, 30_000_000_000),
            quarterFact(2025, "Q4", 8_500_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 8_100_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 7_900_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 7_500_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      PaymentsForRepurchaseOfCommonStock: {
        units: {
          USD: [
            annualFact(2025, 85_000_000_000),
            annualFact(2024, 80_000_000_000),
            quarterFact(2025, "Q4", 21_000_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 22_000_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 21_000_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 21_000_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      PaymentsOfDividendsCommonStock: {
        units: {
          USD: [
            annualFact(2025, 15_000_000_000),
            annualFact(2024, 15_000_000_000),
            quarterFact(2025, "Q4", 3_800_000_000, "2025-09-27", "2025-10-31"),
            quarterFact(2025, "Q3", 3_700_000_000, "2025-06-28", "2025-08-01"),
            quarterFact(2025, "Q2", 3_700_000_000, "2025-03-29", "2025-05-02"),
            quarterFact(2025, "Q1", 3_800_000_000, "2024-12-28", "2025-01-31"),
          ],
        },
      },
      EarningsPerShareDiluted: {
        units: {
          "USD/shares": [annualFact(2025, 6.75), annualFact(2024, 6.12)],
        },
      },
      WeightedAverageNumberOfDilutedSharesOutstanding: {
        units: {
          shares: [annualFact(2025, 15_100_000_000), annualFact(2024, 15_500_000_000)],
        },
      },
    },
  },
};

export const fixtureSnapshot = normalizeCompanySnapshot(
  fixtureIdentity,
  fixtureSubmissions,
  fixtureFacts,
);
