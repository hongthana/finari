import type {
  SecCompanyFactsResponse,
  SecSubmissionsResponse,
} from "@/lib/sec";
import type { CompanySnapshot } from "@/lib/types";

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
      accessionNumber: ["0000320193-25-000079", "0000320193-24-000123"],
      filingDate: ["2025-10-31", "2025-08-01"],
      reportDate: ["2025-09-27", "2025-06-28"],
      form: ["10-K", "10-Q"],
      primaryDocument: ["aapl-20250927.htm", "aapl-20250628.htm"],
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

export const fixtureFacts: SecCompanyFactsResponse = {
  cik: 320193,
  entityName: "Apple Inc.",
  facts: {
    "us-gaap": {
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [annualFact(2025, 410_000_000_000), annualFact(2024, 390_000_000_000)],
        },
      },
      GrossProfit: {
        units: {
          USD: [annualFact(2025, 185_000_000_000), annualFact(2024, 175_000_000_000)],
        },
      },
      OperatingIncomeLoss: {
        units: {
          USD: [annualFact(2025, 125_000_000_000), annualFact(2024, 115_000_000_000)],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [annualFact(2025, 102_000_000_000), annualFact(2024, 95_000_000_000)],
        },
      },
      Assets: {
        units: {
          USD: [annualFact(2025, 365_000_000_000), annualFact(2024, 350_000_000_000)],
        },
      },
      Liabilities: {
        units: {
          USD: [annualFact(2025, 280_000_000_000), annualFact(2024, 270_000_000_000)],
        },
      },
      StockholdersEquity: {
        units: {
          USD: [annualFact(2025, 85_000_000_000), annualFact(2024, 80_000_000_000)],
        },
      },
      CashAndCashEquivalentsAtCarryingValue: {
        units: {
          USD: [annualFact(2025, 32_000_000_000), annualFact(2024, 30_000_000_000)],
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
          USD: [annualFact(2025, 118_000_000_000), annualFact(2024, 110_000_000_000)],
        },
      },
      PaymentsToAcquirePropertyPlantAndEquipment: {
        units: {
          USD: [annualFact(2025, 12_000_000_000), annualFact(2024, 11_000_000_000)],
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

export const fixtureSnapshot: CompanySnapshot = {
  identity: {
    ...fixtureIdentity,
    exchange: "Nasdaq",
    sicDescription: "Electronic Computers",
  },
  latestFiling: {
    accessionNumber: "0000320193-25-000079",
    form: "10-K",
    filingDate: "2025-10-31",
    reportDate: "2025-09-27",
    url: "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
  },
  filings: [],
  periods: [
    {
      fiscalYear: 2025,
      revenue: 410_000_000_000,
      grossProfit: 185_000_000_000,
      operatingIncome: 125_000_000_000,
      netIncome: 102_000_000_000,
      assets: 365_000_000_000,
      liabilities: 280_000_000_000,
      equity: 85_000_000_000,
      cash: 32_000_000_000,
      debt: 100_000_000_000,
      operatingCashFlow: 118_000_000_000,
      capitalExpenditure: 12_000_000_000,
      freeCashFlow: 106_000_000_000,
      epsDiluted: 6.75,
    },
    {
      fiscalYear: 2024,
      revenue: 390_000_000_000,
      netIncome: 95_000_000_000,
      freeCashFlow: 99_000_000_000,
    },
  ],
  metrics: [
    {
      id: "revenue-growth",
      label: "Revenue growth",
      value: 0.051,
      unit: "percent",
      description: "Latest annual revenue compared with the prior fiscal year.",
      signal: "positive",
    },
  ],
  caveats: [],
  citations: [
    {
      label: "AAPL latest annual filing",
      url: "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
      form: "10-K",
      filedDate: "2025-10-31",
    },
  ],
  generatedAt: "2026-06-04T00:00:00.000Z",
};
