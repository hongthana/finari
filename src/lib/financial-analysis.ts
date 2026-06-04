import {
  enrichIdentityFromSubmissions,
  extractRecentFilings,
  type SecCompanyFact,
  type SecCompanyFactsResponse,
  type SecFactUnit,
  type SecSubmissionsResponse,
} from "@/lib/sec";
import type {
  CompanyIdentity,
  CompanySnapshot,
  FinancialMetric,
  FinancialPeriod,
  SourceCitation,
  TrendSignal,
} from "@/lib/types";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F"]);

const FACT_TAGS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
  ],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  cash: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
  ],
  debtCurrent: [
    "ShortTermBorrowings",
    "ShortTermDebtCurrent",
    "LongTermDebtAndFinanceLeaseObligationsCurrent",
    "LongTermDebtCurrent",
  ],
  debtNoncurrent: [
    "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
    "LongTermDebtNoncurrent",
  ],
  debtTotal: [
    "LongTermDebtAndFinanceLeaseObligations",
    "LongTermDebt",
  ],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capitalExpenditure: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  epsDiluted: ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
  sharesDiluted: [
    "WeightedAverageNumberOfDilutedSharesOutstanding",
    "WeightedAverageNumberOfSharesOutstandingBasic",
  ],
} as const;

type StatementField =
  | "revenue"
  | "grossProfit"
  | "operatingIncome"
  | "netIncome"
  | "assets"
  | "liabilities"
  | "equity"
  | "cash"
  | "operatingCashFlow"
  | "capitalExpenditure"
  | "epsDiluted"
  | "sharesDiluted";

interface SelectedFact {
  tag: string;
  unit: string;
  fact: SecFactUnit;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isAnnualFact(fact: SecFactUnit): boolean {
  const annualFrame = /^CY\d{4}$/.test(fact.frame ?? "");
  return (
    (fact.fp === "FY" || annualFrame || ANNUAL_FORMS.has(fact.form ?? "")) &&
    isFiniteNumber(fact.val) &&
    isFiniteNumber(fact.fy)
  );
}

function scoreFact(fact: SecFactUnit): number {
  let score = 0;

  if (fact.fp === "FY") {
    score += 8;
  }

  if (/^CY\d{4}$/.test(fact.frame ?? "")) {
    score += 5;
  }

  if (ANNUAL_FORMS.has(fact.form ?? "")) {
    score += 4;
  }

  if (fact.filed) {
    score += Date.parse(fact.filed) / 10_000_000_000_000;
  }

  return score;
}

function getUsGaapFact(
  facts: SecCompanyFactsResponse,
  tag: string,
): SecCompanyFact | undefined {
  return facts.facts?.["us-gaap"]?.[tag];
}

function selectFactsByYear(
  facts: SecCompanyFactsResponse,
  tags: readonly string[],
  preferredUnits: readonly string[],
): Map<number, SelectedFact> {
  const byYear = new Map<number, SelectedFact>();

  for (const tag of tags) {
    const concept = getUsGaapFact(facts, tag);
    if (!concept?.units) {
      continue;
    }

    const unitNames = [
      ...preferredUnits.filter((unit) => concept.units?.[unit]),
      ...Object.keys(concept.units).filter(
        (unit) => !preferredUnits.includes(unit),
      ),
    ];

    for (const unit of unitNames) {
      const unitFacts = concept.units[unit] ?? [];

      for (const fact of unitFacts) {
        if (!isAnnualFact(fact) || !isFiniteNumber(fact.fy)) {
          continue;
        }

        const existing = byYear.get(fact.fy);
        if (!existing || scoreFact(fact) > scoreFact(existing.fact)) {
          byYear.set(fact.fy, { tag, unit, fact });
        }
      }
    }
  }

  return byYear;
}

function addFactValues(
  periods: Map<number, FinancialPeriod>,
  field: StatementField,
  facts: Map<number, SelectedFact>,
  transform: (value: number) => number | null = (value) => value,
): void {
  for (const [fiscalYear, selected] of facts) {
    const period = periods.get(fiscalYear) ?? { fiscalYear };
    const value = transform(selected.fact.val);

    period[field] = value;
    period.endDate ||= selected.fact.end;
    period.filedDate ||= selected.fact.filed;
    period.form ||= selected.fact.form;
    period.accessionNumber ||= selected.fact.accn;
    periods.set(fiscalYear, period);
  }
}

function firstValue(values: Array<number | null | undefined>): number | null {
  return values.find((value) => isFiniteNumber(value)) ?? null;
}

function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous) || previous === 0) {
    return null;
  }

  return (current - previous) / Math.abs(previous);
}

function divide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (
    !isFiniteNumber(numerator) ||
    !isFiniteNumber(denominator) ||
    denominator === 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function signalForMetric(
  value: number | null,
  positiveAt = 0,
  negativeAt = 0,
): TrendSignal {
  if (!isFiniteNumber(value)) {
    return "unknown";
  }

  if (value > positiveAt) {
    return "positive";
  }

  if (value < negativeAt) {
    return "negative";
  }

  return "neutral";
}

function leverageSignal(value: number | null): TrendSignal {
  if (!isFiniteNumber(value)) {
    return "unknown";
  }

  if (value < 0.5) {
    return "positive";
  }

  if (value > 1.5) {
    return "negative";
  }

  return "neutral";
}

function buildMetrics(periods: FinancialPeriod[]): FinancialMetric[] {
  const latest = periods[0];
  const previous = periods[1];

  if (!latest) {
    return [];
  }

  const revenueGrowth = percentChange(latest.revenue, previous?.revenue);
  const netIncomeGrowth = percentChange(latest.netIncome, previous?.netIncome);
  const grossMargin = divide(latest.grossProfit, latest.revenue);
  const operatingMargin = divide(latest.operatingIncome, latest.revenue);
  const netMargin = divide(latest.netIncome, latest.revenue);
  const fcfMargin = divide(latest.freeCashFlow, latest.revenue);
  const debtToEquity = divide(latest.debt, latest.equity);
  const liabilitiesToAssets = divide(latest.liabilities, latest.assets);
  const returnOnAssets = divide(latest.netIncome, latest.assets);
  const returnOnEquity = divide(latest.netIncome, latest.equity);

  return [
    {
      id: "revenue-growth",
      label: "Revenue growth",
      value: revenueGrowth,
      unit: "percent",
      description: "Latest annual revenue compared with the prior fiscal year.",
      signal: signalForMetric(revenueGrowth, 0.05, -0.03),
    },
    {
      id: "net-income-growth",
      label: "Net income growth",
      value: netIncomeGrowth,
      unit: "percent",
      description: "Bottom-line growth compared with the prior fiscal year.",
      signal: signalForMetric(netIncomeGrowth, 0.05, -0.05),
    },
    {
      id: "gross-margin",
      label: "Gross margin",
      value: grossMargin,
      unit: "percent",
      description: "Gross profit as a percentage of revenue.",
      signal: signalForMetric(grossMargin, 0.35, 0.15),
    },
    {
      id: "operating-margin",
      label: "Operating margin",
      value: operatingMargin,
      unit: "percent",
      description: "Operating income as a percentage of revenue.",
      signal: signalForMetric(operatingMargin, 0.15, 0.03),
    },
    {
      id: "net-margin",
      label: "Net margin",
      value: netMargin,
      unit: "percent",
      description: "Net income as a percentage of revenue.",
      signal: signalForMetric(netMargin, 0.1, 0),
    },
    {
      id: "free-cash-flow-margin",
      label: "FCF margin",
      value: fcfMargin,
      unit: "percent",
      description: "Free cash flow as a percentage of revenue.",
      signal: signalForMetric(fcfMargin, 0.08, 0),
    },
    {
      id: "debt-to-equity",
      label: "Debt / equity",
      value: debtToEquity,
      unit: "ratio",
      description: "Debt load relative to book equity.",
      signal: leverageSignal(debtToEquity),
    },
    {
      id: "liabilities-to-assets",
      label: "Liabilities / assets",
      value: liabilitiesToAssets,
      unit: "percent",
      description: "Balance-sheet obligations relative to total assets.",
      signal: leverageSignal(liabilitiesToAssets),
    },
    {
      id: "return-on-assets",
      label: "Return on assets",
      value: returnOnAssets,
      unit: "percent",
      description: "Net income generated per dollar of assets.",
      signal: signalForMetric(returnOnAssets, 0.05, 0),
    },
    {
      id: "return-on-equity",
      label: "Return on equity",
      value: returnOnEquity,
      unit: "percent",
      description: "Net income generated per dollar of book equity.",
      signal: signalForMetric(returnOnEquity, 0.1, 0),
    },
  ];
}

function buildCaveats(periods: FinancialPeriod[], facts: SecCompanyFactsResponse) {
  const caveats: string[] = [];

  if (periods.length < 2) {
    caveats.push(
      "Finari found fewer than two comparable annual periods, so trend analysis is limited.",
    );
  }

  const latest = periods[0];
  if (!latest) {
    caveats.push("No annual financial-statement facts were found for this company.");
    return caveats;
  }

  const required: Array<[keyof FinancialPeriod, string]> = [
    ["revenue", "revenue"],
    ["netIncome", "net income"],
    ["assets", "assets"],
    ["operatingCashFlow", "operating cash flow"],
  ];

  for (const [field, label] of required) {
    if (!isFiniteNumber(latest[field])) {
      caveats.push(`Latest annual ${label} was not available in standard SEC tags.`);
    }
  }

  if (!facts.facts?.["us-gaap"]) {
    caveats.push("The company did not expose standard US-GAAP facts in the SEC response.");
  }

  return caveats;
}

function buildCitations(
  identity: CompanyIdentity,
  periods: FinancialPeriod[],
  filings: ReturnType<typeof extractRecentFilings>,
): SourceCitation[] {
  const latestAnnualFiling = filings.find((filing) =>
    ANNUAL_FORMS.has(filing.form),
  );
  const latestPeriod = periods[0];
  const citations: SourceCitation[] = [];

  if (latestAnnualFiling?.url) {
    citations.push({
      label: `${identity.ticker} latest annual filing`,
      url: latestAnnualFiling.url,
      form: latestAnnualFiling.form,
      filedDate: latestAnnualFiling.filingDate,
      accessionNumber: latestAnnualFiling.accessionNumber,
    });
  }

  if (latestPeriod?.accessionNumber) {
    citations.push({
      label: `${identity.ticker} normalized XBRL facts`,
      url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${identity.cik}.json`,
      form: latestPeriod.form,
      filedDate: latestPeriod.filedDate,
      accessionNumber: latestPeriod.accessionNumber,
    });
  }

  citations.push({
    label: "SEC company submissions",
    url: `https://data.sec.gov/submissions/CIK${identity.cik}.json`,
  });

  return citations;
}

export function normalizeCompanySnapshot(
  identity: CompanyIdentity,
  submissions: SecSubmissionsResponse,
  facts: SecCompanyFactsResponse,
): CompanySnapshot {
  const enrichedIdentity = enrichIdentityFromSubmissions(identity, submissions);
  const periods = new Map<number, FinancialPeriod>();

  addFactValues(
    periods,
    "revenue",
    selectFactsByYear(facts, FACT_TAGS.revenue, ["USD"]),
  );
  addFactValues(
    periods,
    "grossProfit",
    selectFactsByYear(facts, FACT_TAGS.grossProfit, ["USD"]),
  );
  addFactValues(
    periods,
    "operatingIncome",
    selectFactsByYear(facts, FACT_TAGS.operatingIncome, ["USD"]),
  );
  addFactValues(
    periods,
    "netIncome",
    selectFactsByYear(facts, FACT_TAGS.netIncome, ["USD"]),
  );
  addFactValues(periods, "assets", selectFactsByYear(facts, FACT_TAGS.assets, ["USD"]));
  addFactValues(
    periods,
    "liabilities",
    selectFactsByYear(facts, FACT_TAGS.liabilities, ["USD"]),
  );
  addFactValues(periods, "equity", selectFactsByYear(facts, FACT_TAGS.equity, ["USD"]));
  addFactValues(periods, "cash", selectFactsByYear(facts, FACT_TAGS.cash, ["USD"]));
  addFactValues(
    periods,
    "operatingCashFlow",
    selectFactsByYear(facts, FACT_TAGS.operatingCashFlow, ["USD"]),
  );
  addFactValues(
    periods,
    "capitalExpenditure",
    selectFactsByYear(facts, FACT_TAGS.capitalExpenditure, ["USD"]),
    (value) => Math.abs(value),
  );
  addFactValues(
    periods,
    "epsDiluted",
    selectFactsByYear(facts, FACT_TAGS.epsDiluted, ["USD/shares"]),
  );
  addFactValues(
    periods,
    "sharesDiluted",
    selectFactsByYear(facts, FACT_TAGS.sharesDiluted, ["shares"]),
  );

  const currentDebt = selectFactsByYear(facts, FACT_TAGS.debtCurrent, ["USD"]);
  const noncurrentDebt = selectFactsByYear(facts, FACT_TAGS.debtNoncurrent, ["USD"]);
  const totalDebt = selectFactsByYear(facts, FACT_TAGS.debtTotal, ["USD"]);

  for (const fiscalYear of new Set([
    ...Array.from(currentDebt.keys()),
    ...Array.from(noncurrentDebt.keys()),
    ...Array.from(totalDebt.keys()),
  ])) {
    const period = periods.get(fiscalYear) ?? { fiscalYear };
    period.debt =
      totalDebt.get(fiscalYear)?.fact.val ??
      firstValue([currentDebt.get(fiscalYear)?.fact.val, 0])! +
        firstValue([noncurrentDebt.get(fiscalYear)?.fact.val, 0])!;
    period.endDate ||=
      totalDebt.get(fiscalYear)?.fact.end ??
      noncurrentDebt.get(fiscalYear)?.fact.end ??
      currentDebt.get(fiscalYear)?.fact.end;
    period.filedDate ||=
      totalDebt.get(fiscalYear)?.fact.filed ??
      noncurrentDebt.get(fiscalYear)?.fact.filed ??
      currentDebt.get(fiscalYear)?.fact.filed;
    period.form ||=
      totalDebt.get(fiscalYear)?.fact.form ??
      noncurrentDebt.get(fiscalYear)?.fact.form ??
      currentDebt.get(fiscalYear)?.fact.form;
    period.accessionNumber ||=
      totalDebt.get(fiscalYear)?.fact.accn ??
      noncurrentDebt.get(fiscalYear)?.fact.accn ??
      currentDebt.get(fiscalYear)?.fact.accn;
    periods.set(fiscalYear, period);
  }

  const normalizedPeriods = Array.from(periods.values())
    .map((period) => ({
      ...period,
      freeCashFlow:
        isFiniteNumber(period.operatingCashFlow) &&
        isFiniteNumber(period.capitalExpenditure)
          ? period.operatingCashFlow - period.capitalExpenditure
          : null,
    }))
    .sort((a, b) => b.fiscalYear - a.fiscalYear)
    .slice(0, 5);

  const filings = extractRecentFilings(submissions);

  return {
    identity: enrichedIdentity,
    latestFiling: filings[0],
    filings,
    periods: normalizedPeriods,
    metrics: buildMetrics(normalizedPeriods),
    caveats: buildCaveats(normalizedPeriods, facts),
    citations: buildCitations(enrichedIdentity, normalizedPeriods, filings),
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeMetricSignal(metrics: FinancialMetric[]): TrendSignal {
  const scores: number[] = metrics.map((metric) => {
    if (metric.signal === "positive") {
      return 1;
    }

    if (metric.signal === "negative") {
      return -1;
    }

    return 0;
  });
  const total = scores.reduce<number>((sum, score) => sum + score, 0);

  if (total > 2) {
    return "positive";
  }

  if (total < -1) {
    return "negative";
  }

  return metrics.length ? "neutral" : "unknown";
}
