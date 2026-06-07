import {
  enrichIdentityFromSubmissions,
  extractRecentFilings,
  type SecCompanyFact,
  type SecCompanyFactsResponse,
  type SecFactUnit,
  type SecSubmissionsResponse,
} from "@/lib/sec";
import type {
  BalanceSheetAnalysis,
  BusinessDriver,
  CaveatChangeAnalysis,
  ChangeAnalysis,
  FilingSummary,
  ChangeItem,
  CompanyIdentity,
  CompanySnapshot,
  DataQuality,
  DataQualityCheck,
  DecisionFramework,
  FinancialMetric,
  FinancialPeriod,
  MetricUnit,
  PeerComparison,
  PeerMetricComparison,
  SourceCitation,
  TrendSignal,
} from "@/lib/types";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A"]);
const QUARTERLY_FORMS = new Set(["10-Q", "10-Q/A"]);
const FINANCIAL_FORMS = new Set([...ANNUAL_FORMS, ...QUARTERLY_FORMS]);
const QUARTER_ORDER = ["Q1", "Q2", "Q3", "Q4"] as const;

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
  currentAssets: ["AssetsCurrent"],
  currentLiabilities: ["LiabilitiesCurrent"],
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
  researchAndDevelopment: ["ResearchAndDevelopmentExpense"],
  sellingGeneralAdministrative: [
    "SellingGeneralAndAdministrativeExpense",
    "SellingAndMarketingExpense",
  ],
  buybacks: [
    "PaymentsForRepurchaseOfCommonStock",
    "PaymentsForRepurchaseOfEquity",
  ],
  dividends: [
    "PaymentsOfDividendsCommonStock",
    "PaymentsOfDividends",
    "PaymentsOfOrdinaryDividends",
  ],
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
  | "currentAssets"
  | "currentLiabilities"
  | "equity"
  | "cash"
  | "operatingCashFlow"
  | "capitalExpenditure"
  | "researchAndDevelopment"
  | "sellingGeneralAdministrative"
  | "buybacks"
  | "dividends"
  | "epsDiluted"
  | "sharesDiluted";

type QuarterName = (typeof QUARTER_ORDER)[number];

interface SelectedFact {
  tag: string;
  unit: string;
  fact: SecFactUnit;
}

interface SelectedFactValue extends SelectedFact {
  value: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function quarterRank(period?: string): number {
  const index = QUARTER_ORDER.indexOf(period as QuarterName);
  return index === -1 ? -1 : index;
}

function quarterKey(fiscalYear: number, fiscalPeriod: string): string {
  return `${fiscalYear}:${fiscalPeriod}`;
}

function previousQuarter(period: string): QuarterName | null {
  const index = quarterRank(period);
  return index > 0 ? QUARTER_ORDER[index - 1] : null;
}

function fiscalYearEndMonth(fiscalYearEnd?: string): number | null {
  const raw = fiscalYearEnd?.trim();
  if (!raw || raw.length < 2) {
    return null;
  }

  const month = Number(raw.slice(0, 2));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function fiscalYearForEndDate(endDate?: string, fiscalYearEnd?: string): number | null {
  if (!endDate) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(endDate);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const fiscalEndMonth = fiscalYearEndMonth(fiscalYearEnd);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }

  if (!fiscalEndMonth) {
    return year;
  }

  return month > fiscalEndMonth ? year + 1 : year;
}

function factMatchesFiscalYearEnd(
  fact: SecFactUnit,
  fiscalYearEnd?: string,
): boolean {
  const factFiscalYear = fiscalYearForEndDate(fact.end, fiscalYearEnd);
  return factFiscalYear === null || factFiscalYear === fact.fy;
}

function isAnnualFact(fact: SecFactUnit): boolean {
  const annualFrame = /^CY\d{4}$/.test(fact.frame ?? "");
  return (
    (fact.fp === "FY" || annualFrame || ANNUAL_FORMS.has(fact.form ?? "")) &&
    isFiniteNumber(fact.val) &&
    isFiniteNumber(fact.fy)
  );
}

function isQuarterFact(fact: SecFactUnit): boolean {
  return (
    Boolean(fact.fp && QUARTER_ORDER.includes(fact.fp as QuarterName)) &&
    isFiniteNumber(fact.val) &&
    isFiniteNumber(fact.fy) &&
    (QUARTERLY_FORMS.has(fact.form ?? "") ||
      /^CY\d{4}Q[1-4]/.test(fact.frame ?? ""))
  );
}

function isStandaloneQuarterFact(fact: SecFactUnit): boolean {
  return /^CY\d{4}Q[1-4]$/.test(fact.frame ?? "");
}

function canDeriveFromAdjacentYtdFact(
  currentFact: SecFactUnit,
  previousFact: SecFactUnit,
): boolean {
  return (
    !isStandaloneQuarterFact(currentFact) &&
    !isStandaloneQuarterFact(previousFact) &&
    currentFact.form === previousFact.form &&
    currentFact.fy === previousFact.fy
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

function scoreQuarterFact(fact: SecFactUnit): number {
  let score = 0;

  if (isStandaloneQuarterFact(fact)) {
    score += 12;
  }

  if (QUARTERLY_FORMS.has(fact.form ?? "")) {
    score += 6;
  }

  if (fact.fp && QUARTER_ORDER.includes(fact.fp as QuarterName)) {
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
  fiscalYearEnd?: string,
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
        if (
          !isAnnualFact(fact) ||
          !isFiniteNumber(fact.fy) ||
          !factMatchesFiscalYearEnd(fact, fiscalYearEnd)
        ) {
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

function selectFactsByQuarter(
  facts: SecCompanyFactsResponse,
  tags: readonly string[],
  preferredUnits: readonly string[],
  fiscalYearEnd?: string,
): Map<string, SelectedFact> {
  const byQuarter = new Map<string, SelectedFact>();

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
        if (
          !isQuarterFact(fact) ||
          !isFiniteNumber(fact.fy) ||
          !fact.fp ||
          !factMatchesFiscalYearEnd(fact, fiscalYearEnd)
        ) {
          continue;
        }

        const key = quarterKey(fact.fy, fact.fp);
        const existing = byQuarter.get(key);
        if (!existing || scoreQuarterFact(fact) > scoreQuarterFact(existing.fact)) {
          byQuarter.set(key, { tag, unit, fact });
        }
      }
    }
  }

  return byQuarter;
}

function selectQuarterlyDurationFacts(
  facts: SecCompanyFactsResponse,
  tags: readonly string[],
  preferredUnits: readonly string[],
  fiscalYearEnd?: string,
  annualFacts = selectFactsByYear(facts, tags, preferredUnits, fiscalYearEnd),
): Map<string, SelectedFactValue> {
  const selected = selectFactsByQuarter(facts, tags, preferredUnits, fiscalYearEnd);
  const values = new Map<string, SelectedFactValue>();

  for (const [key, selectedFact] of selected) {
    const fiscalYear = selectedFact.fact.fy;
    const fiscalPeriod = selectedFact.fact.fp;
    if (!isFiniteNumber(fiscalYear) || !fiscalPeriod) {
      continue;
    }

    let value: number | null = null;
    if (fiscalPeriod === "Q1" || isStandaloneQuarterFact(selectedFact.fact)) {
      value = selectedFact.fact.val;
    } else {
      const previous = previousQuarter(fiscalPeriod);
      const previousFact = previous ? selected.get(quarterKey(fiscalYear, previous)) : null;
      if (
        previousFact &&
        canDeriveFromAdjacentYtdFact(selectedFact.fact, previousFact.fact)
      ) {
        value = selectedFact.fact.val - previousFact.fact.val;
      }
    }

    if (value !== null && Number.isFinite(value)) {
      values.set(key, { ...selectedFact, value });
    }
  }

  for (const [fiscalYear, annualFact] of annualFacts) {
    const q3 = selected.get(quarterKey(fiscalYear, "Q3"));
    if (
      !q3 ||
      selected.has(quarterKey(fiscalYear, "Q4")) ||
      isStandaloneQuarterFact(q3.fact)
    ) {
      continue;
    }

    const value = annualFact.fact.val - q3.fact.val;
    if (Number.isFinite(value)) {
      values.set(quarterKey(fiscalYear, "Q4"), {
        tag: annualFact.tag,
        unit: annualFact.unit,
        fact: {
          ...annualFact.fact,
          fp: "Q4",
          form: annualFact.fact.form,
          filed: annualFact.fact.filed,
          start: q3.fact.end,
        },
        value,
      });
    }
  }

  return values;
}

function addAnnualFactValues(
  periods: Map<number, FinancialPeriod>,
  field: StatementField,
  facts: Map<number, SelectedFact>,
  transform: (value: number) => number | null = (value) => value,
): void {
  for (const [fiscalYear, selected] of facts) {
    const period = periods.get(fiscalYear) ?? {
      periodType: "annual" as const,
      fiscalYear,
      fiscalPeriod: "FY",
    };
    const value = transform(selected.fact.val);

    period[field] = value;
    period.startDate ||= selected.fact.start;
    period.endDate ||= selected.fact.end;
    period.filedDate ||= selected.fact.filed;
    period.form ||= selected.fact.form;
    period.accessionNumber ||= selected.fact.accn;
    periods.set(fiscalYear, period);
  }
}

function addQuarterlyFactValues(
  periods: Map<string, FinancialPeriod>,
  field: StatementField,
  facts: Map<string, SelectedFactValue>,
  transform: (value: number) => number | null = (value) => value,
): void {
  for (const [key, selected] of facts) {
    const fiscalYear = selected.fact.fy;
    const fiscalPeriod = selected.fact.fp;
    if (!isFiniteNumber(fiscalYear) || !fiscalPeriod) {
      continue;
    }

    const period = periods.get(key) ?? {
      periodType: "quarterly" as const,
      fiscalYear,
      fiscalPeriod,
    };
    const value = transform(selected.value);

    period[field] = value;
    period.startDate ||= selected.fact.start;
    period.endDate ||= selected.fact.end;
    period.filedDate ||= selected.fact.filed;
    period.form ||= selected.fact.form;
    period.accessionNumber ||= selected.fact.accn;
    periods.set(key, period);
  }
}

function addQuarterlyInstantFactValues(
  periods: Map<string, FinancialPeriod>,
  field: StatementField,
  facts: Map<string, SelectedFact>,
  transform: (value: number) => number | null = (value) => value,
): void {
  const values = new Map<string, SelectedFactValue>();
  for (const [key, selected] of facts) {
    values.set(key, { ...selected, value: selected.fact.val });
  }
  addQuarterlyFactValues(periods, field, values, transform);
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

function sumField(
  periods: FinancialPeriod[],
  field: keyof FinancialPeriod,
): number | null {
  const values = periods.map((period) => period[field]);
  if (values.some((value) => !isFiniteNumber(value))) {
    return null;
  }

  return values.reduce<number>((sum, value) => sum + Number(value), 0);
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

function signalForChange(
  change: number | null,
  positiveAt = 0.02,
  negativeAt = -0.02,
  lowerIsBetter = false,
): TrendSignal {
  if (!isFiniteNumber(change)) {
    return "unknown";
  }

  if (lowerIsBetter) {
    if (change < -Math.abs(positiveAt)) {
      return "positive";
    }

    if (change > Math.abs(negativeAt)) {
      return "negative";
    }

    return "neutral";
  }

  return signalForMetric(change, positiveAt, negativeAt);
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

function riskSignal(value: number | null, positiveBelow: number, negativeAbove: number): TrendSignal {
  if (!isFiniteNumber(value)) {
    return "unknown";
  }

  if (value <= positiveBelow) {
    return "positive";
  }

  if (value >= negativeAbove) {
    return "negative";
  }

  return "neutral";
}

function sortedPeriods(periods: FinancialPeriod[]): FinancialPeriod[] {
  return periods.sort((a, b) => {
    if (b.fiscalYear !== a.fiscalYear) {
      return b.fiscalYear - a.fiscalYear;
    }

    return quarterRank(b.fiscalPeriod) - quarterRank(a.fiscalPeriod);
  });
}

function withDerivedFields(period: FinancialPeriod): FinancialPeriod {
  return {
    ...period,
    workingCapital:
      isFiniteNumber(period.currentAssets) && isFiniteNumber(period.currentLiabilities)
        ? period.currentAssets - period.currentLiabilities
        : period.workingCapital ?? null,
    freeCashFlow:
      isFiniteNumber(period.operatingCashFlow) &&
      isFiniteNumber(period.capitalExpenditure)
        ? period.operatingCashFlow - period.capitalExpenditure
        : period.freeCashFlow ?? null,
  };
}

function buildMetrics(periods: FinancialPeriod[], ttmPeriod?: FinancialPeriod): FinancialMetric[] {
  const latest = periods[0];
  const previous = periods[1];
  const cashPeriod = ttmPeriod ?? latest;

  if (!latest) {
    return [];
  }

  const revenueGrowth = percentChange(latest.revenue, previous?.revenue);
  const netIncomeGrowth = percentChange(latest.netIncome, previous?.netIncome);
  const grossMargin = divide(latest.grossProfit, latest.revenue);
  const operatingMargin = divide(latest.operatingIncome, latest.revenue);
  const netMargin = divide(latest.netIncome, latest.revenue);
  const fcfMargin = divide(
    cashPeriod?.freeCashFlow ?? latest.freeCashFlow,
    cashPeriod?.revenue ?? latest.revenue,
  );
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
      signal: riskSignal(liabilitiesToAssets, 0.45, 0.75),
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

function changeItem(
  id: string,
  label: string,
  unit: MetricUnit,
  currentValue: number | null | undefined,
  previousValue: number | null | undefined,
  description: string,
  positiveAt = 0.02,
  negativeAt = -0.02,
  lowerIsBetter = false,
): ChangeItem {
  const change = unit === "percent"
    ? (isFiniteNumber(currentValue) && isFiniteNumber(previousValue)
        ? currentValue - previousValue
        : null)
    : percentChange(currentValue, previousValue);
  const signal = signalForChange(change, positiveAt, negativeAt, lowerIsBetter);

  return {
    id,
    label,
    currentValue: currentValue ?? null,
    previousValue: previousValue ?? null,
    change,
    unit,
    description,
    signal,
  };
}

function buildChangeAnalysis(
  annualPeriods: FinancialPeriod[],
  quarterlyPeriods: FinancialPeriod[],
): ChangeAnalysis {
  const latestQuarter = quarterlyPeriods[0];
  const previousQuarterPeriod = quarterlyPeriods[1];
  const latestAnnual = annualPeriods[0];
  const previousAnnual = annualPeriods[1];

  return {
    quarterly: latestQuarter
      ? [
          changeItem(
            "quarterly-revenue",
            "Quarterly revenue",
            "currency",
            latestQuarter.revenue,
            previousQuarterPeriod?.revenue,
            "Latest quarter revenue compared with the prior quarter.",
          ),
          changeItem(
            "quarterly-net-income",
            "Quarterly net income",
            "currency",
            latestQuarter.netIncome,
            previousQuarterPeriod?.netIncome,
            "Latest quarter net income compared with the prior quarter.",
          ),
          changeItem(
            "quarterly-fcf",
            "Quarterly free cash flow",
            "currency",
            latestQuarter.freeCashFlow,
            previousQuarterPeriod?.freeCashFlow,
            "Latest quarter free cash flow compared with the prior quarter.",
          ),
          changeItem(
            "quarterly-operating-margin",
            "Quarterly operating margin",
            "percent",
            divide(latestQuarter.operatingIncome, latestQuarter.revenue),
            divide(previousQuarterPeriod?.operatingIncome, previousQuarterPeriod?.revenue),
            "Latest quarter operating margin compared with the prior quarter.",
            0.01,
            -0.01,
          ),
          changeItem(
            "quarterly-debt",
            "Quarterly debt",
            "currency",
            latestQuarter.debt,
            previousQuarterPeriod?.debt,
            "Latest quarter debt compared with the prior quarter.",
            0.02,
            -0.02,
            true,
          ),
          changeItem(
            "quarterly-cash",
            "Quarterly cash",
            "currency",
            latestQuarter.cash,
            previousQuarterPeriod?.cash,
            "Latest quarter cash compared with the prior quarter.",
          ),
          changeItem(
            "quarterly-liabilities-to-assets",
            "Quarterly liabilities to assets",
            "percent",
            divide(latestQuarter.liabilities, latestQuarter.assets),
            divide(previousQuarterPeriod?.liabilities, previousQuarterPeriod?.assets),
            "Latest quarter liabilities/assets compared with the prior quarter.",
            0.01,
            -0.01,
            true,
          ),
          changeItem(
            "quarterly-working-capital",
            "Quarterly working capital",
            "currency",
            latestQuarter.workingCapital,
            previousQuarterPeriod?.workingCapital,
            "Latest quarter working capital compared with the prior quarter.",
          ),
        ]
      : [],
    annual: latestAnnual
      ? [
          changeItem(
            "annual-revenue",
            "Annual revenue",
            "currency",
            latestAnnual.revenue,
            previousAnnual?.revenue,
            "Latest annual revenue compared with the prior fiscal year.",
          ),
          changeItem(
            "annual-net-income",
            "Annual net income",
            "currency",
            latestAnnual.netIncome,
            previousAnnual?.netIncome,
            "Latest annual net income compared with the prior fiscal year.",
          ),
          changeItem(
            "annual-fcf",
            "Annual free cash flow",
            "currency",
            latestAnnual.freeCashFlow,
            previousAnnual?.freeCashFlow,
            "Latest annual free cash flow compared with the prior fiscal year.",
          ),
          changeItem(
            "annual-operating-margin",
            "Annual operating margin",
            "percent",
            divide(latestAnnual.operatingIncome, latestAnnual.revenue),
            divide(previousAnnual?.operatingIncome, previousAnnual?.revenue),
            "Latest annual operating margin compared with the prior fiscal year.",
            0.01,
            -0.01,
          ),
          changeItem(
            "annual-debt",
            "Annual debt",
            "currency",
            latestAnnual.debt,
            previousAnnual?.debt,
            "Latest annual debt compared with the prior fiscal year.",
            0.02,
            -0.02,
            true,
          ),
          changeItem(
            "annual-cash",
            "Annual cash",
            "currency",
            latestAnnual.cash,
            previousAnnual?.cash,
            "Latest annual cash compared with the prior fiscal year.",
          ),
          changeItem(
            "annual-liabilities-to-assets",
            "Annual liabilities to assets",
            "percent",
            divide(latestAnnual.liabilities, latestAnnual.assets),
            divide(previousAnnual?.liabilities, previousAnnual?.assets),
            "Latest annual liabilities/assets compared with the prior fiscal year.",
            0.01,
            -0.01,
            true,
          ),
          changeItem(
            "annual-working-capital",
            "Annual working capital",
            "currency",
            latestAnnual.workingCapital,
            previousAnnual?.workingCapital,
            "Latest annual working capital compared with the prior fiscal year.",
          ),
        ]
      : [],
  };
}

function buildCaveatChangeAnalysis(
  currentCaveats: string[],
  previousCaveats?: string[],
): CaveatChangeAnalysis {
  if (!previousCaveats) {
    return {
      status: "baseline",
      newCaveats: [],
      resolvedCaveats: [],
      unchangedCaveats: currentCaveats,
    };
  }

  const previous = new Set(previousCaveats);
  const current = new Set(currentCaveats);
  const newCaveats = currentCaveats.filter((caveat) => !previous.has(caveat));
  const resolvedCaveats = previousCaveats.filter((caveat) => !current.has(caveat));
  const unchangedCaveats = currentCaveats.filter((caveat) => previous.has(caveat));

  return {
    status: newCaveats.length || resolvedCaveats.length ? "changed" : "unchanged",
    newCaveats,
    resolvedCaveats,
    unchangedCaveats,
  };
}

function buildTtmPeriod(quarterlyPeriods: FinancialPeriod[]): FinancialPeriod | undefined {
  const latestFour = quarterlyPeriods.slice(0, 4);
  if (latestFour.length < 4) {
    return undefined;
  }

  const latest = latestFour[0];
  const ttm: FinancialPeriod = {
    periodType: "ttm",
    fiscalYear: latest.fiscalYear,
    fiscalPeriod: "TTM",
    startDate: latestFour[3].startDate,
    endDate: latest.endDate,
    filedDate: latest.filedDate,
    form: latest.form,
    accessionNumber: latest.accessionNumber,
    revenue: sumField(latestFour, "revenue"),
    grossProfit: sumField(latestFour, "grossProfit"),
    operatingIncome: sumField(latestFour, "operatingIncome"),
    netIncome: sumField(latestFour, "netIncome"),
    operatingCashFlow: sumField(latestFour, "operatingCashFlow"),
    capitalExpenditure: sumField(latestFour, "capitalExpenditure"),
    researchAndDevelopment: sumField(latestFour, "researchAndDevelopment"),
    sellingGeneralAdministrative: sumField(latestFour, "sellingGeneralAdministrative"),
    buybacks: sumField(latestFour, "buybacks"),
    dividends: sumField(latestFour, "dividends"),
    assets: latest.assets,
    liabilities: latest.liabilities,
    currentAssets: latest.currentAssets,
    currentLiabilities: latest.currentLiabilities,
    equity: latest.equity,
    cash: latest.cash,
    debt: latest.debt,
    epsDiluted: sumField(latestFour, "epsDiluted"),
    sharesDiluted: latest.sharesDiluted,
  };

  return withDerivedFields(ttm);
}

function buildBalanceSheetAnalysis(
  annualPeriods: FinancialPeriod[],
  quarterlyPeriods: FinancialPeriod[],
): BalanceSheetAnalysis {
  const latest = quarterlyPeriods[0] ?? annualPeriods[0];
  const latestAnnual = annualPeriods[0];
  const cash = latest?.cash ?? null;
  const debt = latest?.debt ?? latestAnnual?.debt ?? null;
  const liabilitiesToAssets = divide(latest?.liabilities, latest?.assets);
  const debtToEquity = divide(debt, latest?.equity ?? latestAnnual?.equity);
  const cashToDebt = divide(cash, debt);
  const workingCapital = latest?.workingCapital ?? null;
  const netCash =
    isFiniteNumber(cash) && isFiniteNumber(debt) ? cash - debt : null;
  const signal = [
    riskSignal(liabilitiesToAssets, 0.45, 0.75),
    leverageSignal(debtToEquity),
    signalForMetric(workingCapital, 0, -1),
  ];

  const negative = signal.filter((item) => item === "negative").length;
  const positive = signal.filter((item) => item === "positive").length;

  return {
    cash,
    debt,
    netCash,
    currentAssets: latest?.currentAssets ?? null,
    currentLiabilities: latest?.currentLiabilities ?? null,
    workingCapital,
    cashToDebt,
    debtToEquity,
    liabilitiesToAssets,
    signal: negative > 0 ? "negative" : positive > 1 ? "positive" : "neutral",
  };
}

function buildBusinessDrivers(
  metrics: FinancialMetric[],
  annualPeriods: FinancialPeriod[],
  quarterlyPeriods: FinancialPeriod[],
  ttmPeriod?: FinancialPeriod,
): BusinessDriver[] {
  const metric = (id: string) => metrics.find((item) => item.id === id)?.value ?? null;
  const latestAnnual = annualPeriods[0];
  const latestQuarter = quarterlyPeriods[0];
  const previousQuarter = quarterlyPeriods[1];
  const revenueChange =
    percentChange(latestQuarter?.revenue, previousQuarter?.revenue) ??
    metric("revenue-growth");
  const annualRevenueChange = metric("revenue-growth");
  const operatingMargin = divide(
    ttmPeriod?.operatingIncome ?? latestAnnual?.operatingIncome,
    ttmPeriod?.revenue ?? latestAnnual?.revenue,
  );
  const grossMargin = divide(
    ttmPeriod?.grossProfit ?? latestAnnual?.grossProfit,
    ttmPeriod?.revenue ?? latestAnnual?.revenue,
  );
  const grossMarginChange =
    divide(latestQuarter?.grossProfit, latestQuarter?.revenue) !== null &&
    divide(previousQuarter?.grossProfit, previousQuarter?.revenue) !== null
      ? Number(divide(latestQuarter?.grossProfit, latestQuarter?.revenue)) -
        Number(divide(previousQuarter?.grossProfit, previousQuarter?.revenue))
      : null;
  const operatingMarginChange =
    divide(latestQuarter?.operatingIncome, latestQuarter?.revenue) !== null &&
    divide(previousQuarter?.operatingIncome, previousQuarter?.revenue) !== null
      ? Number(divide(latestQuarter?.operatingIncome, latestQuarter?.revenue)) -
        Number(divide(previousQuarter?.operatingIncome, previousQuarter?.revenue))
      : null;
  const fcfMargin = divide(
    ttmPeriod?.freeCashFlow ?? latestAnnual?.freeCashFlow,
    ttmPeriod?.revenue ?? latestAnnual?.revenue,
  );
  const cashConversion = divide(
    ttmPeriod?.freeCashFlow ?? latestAnnual?.freeCashFlow,
    ttmPeriod?.netIncome ?? latestAnnual?.netIncome,
  );
  const buybacks = ttmPeriod?.buybacks ?? latestAnnual?.buybacks;
  const dividends = ttmPeriod?.dividends ?? latestAnnual?.dividends;
  const capitalReturned =
    isFiniteNumber(buybacks) || isFiniteNumber(dividends)
      ? (buybacks ?? 0) + (dividends ?? 0)
      : null;
  const payout = divide(
    capitalReturned,
    ttmPeriod?.freeCashFlow ?? latestAnnual?.freeCashFlow,
  );
  const currentRatio = divide(latestQuarter?.currentAssets ?? latestAnnual?.currentAssets, latestQuarter?.currentLiabilities ?? latestAnnual?.currentLiabilities);
  const liabilitiesToAssets = metric("liabilities-to-assets");
  const cashToDebt = divide(latestQuarter?.cash ?? latestAnnual?.cash, latestQuarter?.debt ?? latestAnnual?.debt);

  return [
    {
      id: "growth",
      signal: signalForMetric(revenueChange, 0.03, -0.03),
      primaryValue: revenueChange,
      unit: "percent",
      details: [
        {
          id: "product-demand",
          value: annualRevenueChange,
          unit: "percent",
          signal: signalForMetric(annualRevenueChange, 0.03, -0.03),
        },
        {
          id: "recent-quarter-demand",
          value: revenueChange,
          unit: "percent",
          signal: signalForMetric(revenueChange, 0.03, -0.03),
        },
        {
          id: "services-hardware-mix",
          value: null,
          unit: "ratio",
          signal: "unknown",
        },
        {
          id: "geographic-exposure",
          value: null,
          unit: "ratio",
          signal: "unknown",
        },
      ],
    },
    {
      id: "profitability",
      signal: signalForMetric(operatingMargin, 0.15, 0.03),
      primaryValue: operatingMargin,
      unit: "percent",
      details: [
        {
          id: "pricing-power",
          value: grossMarginChange ?? grossMargin,
          unit: "percent",
          signal: grossMarginChange !== null
            ? signalForMetric(grossMarginChange, 0.01, -0.01)
            : signalForMetric(grossMargin, 0.3, 0.1),
        },
        {
          id: "margin-pressure",
          value: operatingMarginChange ?? operatingMargin,
          unit: "percent",
          signal: operatingMarginChange !== null
            ? signalForMetric(operatingMarginChange, 0.01, -0.01)
            : signalForMetric(operatingMargin, 0.15, 0.03),
        },
      ],
    },
    {
      id: "cash-generation",
      signal: signalForMetric(fcfMargin, 0.08, 0),
      primaryValue: fcfMargin,
      unit: "percent",
      details: [
        {
          id: "cash-conversion",
          value: cashConversion,
          unit: "ratio",
          signal: signalForMetric(cashConversion, 0.8, 0.4),
        },
      ],
    },
    {
      id: "capital-allocation",
      signal: riskSignal(payout, 0.5, 1),
      primaryValue: payout,
      secondaryValue: capitalReturned,
      unit: "percent",
      details: [
        {
          id: "capital-return",
          value: capitalReturned,
          unit: "currency",
          signal: riskSignal(payout, 0.5, 1),
        },
      ],
    },
    {
      id: "liquidity",
      signal: signalForMetric(currentRatio, 1.5, 1),
      primaryValue: currentRatio,
      secondaryValue: latestQuarter?.workingCapital ?? latestAnnual?.workingCapital ?? null,
      unit: "ratio",
      details: [
        {
          id: "working-capital-flexibility",
          value: latestQuarter?.workingCapital ?? latestAnnual?.workingCapital ?? null,
          unit: "currency",
          signal: signalForMetric(latestQuarter?.workingCapital ?? latestAnnual?.workingCapital ?? null, 0, -1),
        },
      ],
    },
    {
      id: "leverage",
      signal: riskSignal(liabilitiesToAssets, 0.45, 0.75),
      primaryValue: liabilitiesToAssets,
      unit: "percent",
      details: [
        {
          id: "balance-sheet-flexibility",
          value: cashToDebt,
          unit: "ratio",
          signal: signalForMetric(cashToDebt, 1, 0.25),
        },
      ],
    },
  ];
}

function buildDataQuality(
  periods: FinancialPeriod[],
  quarterlyPeriods: FinancialPeriod[],
  latestFinancialFiling: unknown | undefined,
  facts: SecCompanyFactsResponse,
): DataQuality {
  const latest = periods[0];
  const checks: DataQualityCheck[] = [
    {
      id: "financial-filing",
      label: "Latest financial filing found",
      passed: Boolean(latestFinancialFiling),
      description: "Finari identified a 10-K/10-Q family filing as the analysis anchor.",
    },
    {
      id: "annual-comparability",
      label: "Annual comparability",
      passed: periods.length >= 2,
      description: "At least two annual periods are available for trend analysis.",
    },
    {
      id: "core-annual-tags",
      label: "Core annual tags",
      passed: Boolean(
        latest &&
          isFiniteNumber(latest.revenue) &&
          isFiniteNumber(latest.netIncome) &&
          isFiniteNumber(latest.assets) &&
          isFiniteNumber(latest.operatingCashFlow),
      ),
      description: "Revenue, net income, assets, and operating cash flow were available.",
    },
    {
      id: "quarterly-coverage",
      label: "Quarterly coverage",
      passed: quarterlyPeriods.length >= 4,
      description: "At least four quarterly periods are available for TTM analysis.",
    },
    {
      id: "us-gaap",
      label: "US-GAAP facts",
      passed: Boolean(facts.facts?.["us-gaap"]),
      description: "The SEC response includes standard US-GAAP facts.",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  const label = score >= 80 ? "High" : score >= 55 ? "Medium" : "Low";

  return {
    score,
    label,
    signal: label === "High" ? "positive" : label === "Low" ? "negative" : "neutral",
    summary:
      label === "High"
        ? "Core filing data is available and comparable."
        : label === "Medium"
          ? "Core analysis is usable, but some filing fields need caution."
          : "Filing data is limited and should be manually reviewed.",
    checks,
  };
}

function buildDecisionFramework(
  metrics: FinancialMetric[],
  balanceSheetAnalysis: BalanceSheetAnalysis,
  dataQuality: DataQuality,
): DecisionFramework {
  const metric = (id: string) => metrics.find((item) => item.id === id)?.value ?? null;
  const revenueGrowth = metric("revenue-growth");
  const operatingMargin = metric("operating-margin");
  const fcfMargin = metric("free-cash-flow-margin");
  const balanceRisk = balanceSheetAnalysis.signal === "negative";
  const dataRisk = dataQuality.label === "Low";
  const growthPressure = isFiniteNumber(revenueGrowth) && revenueGrowth < -0.03;
  const qualitySupport =
    (isFiniteNumber(operatingMargin) && operatingMargin >= 0.15) ||
    (isFiniteNumber(fcfMargin) && fcfMargin >= 0.08);

  if (dataRisk) {
    return {
      signal: "unknown",
      takeaway: "limited",
      strongestEvidence: "data-quality",
      mainRisk: "data-quality",
      watchMetric: "Core SEC tags",
    };
  }

  if (growthPressure || balanceRisk) {
    return {
      signal: growthPressure && balanceRisk ? "negative" : "neutral",
      takeaway: "caution",
      strongestEvidence: qualitySupport ? "profit-quality" : "financial-scale",
      mainRisk: growthPressure ? "growth" : "balance-sheet",
      watchMetric: growthPressure ? "Revenue growth" : "Liabilities / assets",
    };
  }

  if (qualitySupport) {
    return {
      signal: "positive",
      takeaway: "constructive",
      strongestEvidence:
        isFiniteNumber(fcfMargin) && fcfMargin >= 0.08
          ? "cash-generation"
          : "profit-quality",
      mainRisk: "valuation-needed",
      watchMetric: "FCF margin",
    };
  }

  return {
    signal: "neutral",
    takeaway: "mixed",
    strongestEvidence: "financial-scale",
    mainRisk: "margin-durability",
    watchMetric: "Operating margin",
  };
}

function buildCaveats(
  periods: FinancialPeriod[],
  quarterlyPeriods: FinancialPeriod[],
  peerComparison: PeerComparison,
  facts: SecCompanyFactsResponse,
) {
  const caveats: string[] = [];

  if (periods.length < 2) {
    caveats.push(
      "Finari found fewer than two comparable annual periods, so trend analysis is limited.",
    );
  }

  if (quarterlyPeriods.length < 4) {
    caveats.push(
      "Finari found fewer than four comparable quarterly periods, so TTM analysis is limited.",
    );
  }

  if (peerComparison.status === "limited") {
    caveats.push(
      "SEC industry peer coverage is limited, so peer comparison should be treated as directional.",
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
  latestAnnualFiling?: FilingSummary,
  latestQuarterlyFiling?: FilingSummary,
): SourceCitation[] {
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

  if (latestQuarterlyFiling?.url) {
    citations.push({
      label: `${identity.ticker} latest quarterly filing`,
      url: latestQuarterlyFiling.url,
      form: latestQuarterlyFiling.form,
      filedDate: latestQuarterlyFiling.filingDate,
      accessionNumber: latestQuarterlyFiling.accessionNumber,
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

function buildDebtByYear(
  periods: Map<number, FinancialPeriod>,
  facts: SecCompanyFactsResponse,
  fiscalYearEnd?: string,
): void {
  const currentDebt = selectFactsByYear(
    facts,
    FACT_TAGS.debtCurrent,
    ["USD"],
    fiscalYearEnd,
  );
  const noncurrentDebt = selectFactsByYear(
    facts,
    FACT_TAGS.debtNoncurrent,
    ["USD"],
    fiscalYearEnd,
  );
  const totalDebt = selectFactsByYear(
    facts,
    FACT_TAGS.debtTotal,
    ["USD"],
    fiscalYearEnd,
  );

  for (const fiscalYear of new Set([
    ...Array.from(currentDebt.keys()),
    ...Array.from(noncurrentDebt.keys()),
    ...Array.from(totalDebt.keys()),
  ])) {
    const period = periods.get(fiscalYear) ?? {
      periodType: "annual" as const,
      fiscalYear,
      fiscalPeriod: "FY",
    };
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
}

function buildDebtByQuarter(
  periods: Map<string, FinancialPeriod>,
  facts: SecCompanyFactsResponse,
  fiscalYearEnd?: string,
): void {
  const currentDebt = selectFactsByQuarter(
    facts,
    FACT_TAGS.debtCurrent,
    ["USD"],
    fiscalYearEnd,
  );
  const noncurrentDebt = selectFactsByQuarter(
    facts,
    FACT_TAGS.debtNoncurrent,
    ["USD"],
    fiscalYearEnd,
  );
  const totalDebt = selectFactsByQuarter(
    facts,
    FACT_TAGS.debtTotal,
    ["USD"],
    fiscalYearEnd,
  );

  for (const key of new Set([
    ...Array.from(currentDebt.keys()),
    ...Array.from(noncurrentDebt.keys()),
    ...Array.from(totalDebt.keys()),
  ])) {
    const selected = totalDebt.get(key) ?? noncurrentDebt.get(key) ?? currentDebt.get(key);
    const fiscalYear = selected?.fact.fy;
    const fiscalPeriod = selected?.fact.fp;
    if (!selected || !isFiniteNumber(fiscalYear) || !fiscalPeriod) {
      continue;
    }

    const period = periods.get(key) ?? {
      periodType: "quarterly" as const,
      fiscalYear,
      fiscalPeriod,
    };
    period.debt =
      totalDebt.get(key)?.fact.val ??
      firstValue([currentDebt.get(key)?.fact.val, 0])! +
        firstValue([noncurrentDebt.get(key)?.fact.val, 0])!;
    period.endDate ||=
      totalDebt.get(key)?.fact.end ??
      noncurrentDebt.get(key)?.fact.end ??
      currentDebt.get(key)?.fact.end;
    period.filedDate ||=
      totalDebt.get(key)?.fact.filed ??
      noncurrentDebt.get(key)?.fact.filed ??
      currentDebt.get(key)?.fact.filed;
    period.form ||=
      totalDebt.get(key)?.fact.form ??
      noncurrentDebt.get(key)?.fact.form ??
      currentDebt.get(key)?.fact.form;
    period.accessionNumber ||=
      totalDebt.get(key)?.fact.accn ??
      noncurrentDebt.get(key)?.fact.accn ??
      currentDebt.get(key)?.fact.accn;
    periods.set(key, period);
  }
}

function filingFromPeriod(
  identity: CompanyIdentity,
  period?: FinancialPeriod,
): FilingSummary | undefined {
  if (!period?.form || !period.accessionNumber) {
    return undefined;
  }

  const cikNumber = String(Number(identity.cik));
  const accessionPath = period.accessionNumber.replaceAll("-", "");
  return {
    accessionNumber: period.accessionNumber,
    form: period.form,
    filingDate: period.filedDate ?? "",
    reportDate: period.endDate,
    url: `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accessionPath}/`,
    primaryDocument: undefined,
  };
}

function emptyPeerComparison(identity: CompanyIdentity): PeerComparison {
  return {
    status: "limited",
    sic: identity.sic,
    sicDescription: identity.sicDescription,
    peerCount: 0,
    metrics: [],
    caveats: [
      "Fewer than three same-SIC peer snapshots are available from SEC data.",
    ],
  };
}

function metricValue(snapshot: CompanySnapshot, id: string): number | null {
  return snapshot.metrics.find((metric) => metric.id === id)?.value ?? null;
}

function median(values: number[]): number | null {
  const clean = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (!clean.length) {
    return null;
  }
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2
    ? clean[middle]
    : (clean[middle - 1] + clean[middle]) / 2;
}

function peerMetric(
  id: string,
  label: string,
  unit: MetricUnit,
  companyValue: number | null,
  peerValues: Array<number | null>,
  lowerIsBetter = false,
): PeerMetricComparison {
  const peerMedian = median(peerValues.filter(isFiniteNumber));
  let signal: TrendSignal = "unknown";

  if (isFiniteNumber(companyValue) && isFiniteNumber(peerMedian)) {
    const better = lowerIsBetter
      ? companyValue <= peerMedian
      : companyValue >= peerMedian;
    signal = better ? "positive" : "negative";
  }

  return {
    id,
    label,
    companyValue,
    peerMedian,
    unit,
    signal,
    description: `${label} compared with the same-SIC peer median.`,
  };
}

export function buildPeerComparisonFromSnapshots(
  target: CompanySnapshot,
  peers: CompanySnapshot[],
): PeerComparison {
  const sameIndustryPeers = peers.filter(
    (peer) =>
      peer.identity.ticker !== target.identity.ticker &&
      peer.identity.sic &&
      target.identity.sic &&
      peer.identity.sic === target.identity.sic,
  );

  if (sameIndustryPeers.length === 0) {
    return emptyPeerComparison(target.identity);
  }

  const metrics = [
    peerMetric(
      "revenue-growth",
      "Revenue growth",
      "percent",
      metricValue(target, "revenue-growth"),
      sameIndustryPeers.map((peer) => metricValue(peer, "revenue-growth")),
    ),
    peerMetric(
      "operating-margin",
      "Operating margin",
      "percent",
      metricValue(target, "operating-margin"),
      sameIndustryPeers.map((peer) => metricValue(peer, "operating-margin")),
    ),
    peerMetric(
      "free-cash-flow-margin",
      "FCF margin",
      "percent",
      metricValue(target, "free-cash-flow-margin"),
      sameIndustryPeers.map((peer) => metricValue(peer, "free-cash-flow-margin")),
    ),
    peerMetric(
      "return-on-assets",
      "Return on assets",
      "percent",
      metricValue(target, "return-on-assets"),
      sameIndustryPeers.map((peer) => metricValue(peer, "return-on-assets")),
    ),
    peerMetric(
      "liabilities-to-assets",
      "Liabilities / assets",
      "percent",
      metricValue(target, "liabilities-to-assets"),
      sameIndustryPeers.map((peer) => metricValue(peer, "liabilities-to-assets")),
      true,
    ),
    peerMetric(
      "cash-to-debt",
      "Cash / debt",
      "ratio",
      target.balanceSheetAnalysis.cashToDebt,
      sameIndustryPeers.map((peer) => peer.balanceSheetAnalysis.cashToDebt),
    ),
  ];

  const limited = sameIndustryPeers.length < 3;
  return {
    status: limited ? "limited" : "ready",
    sic: target.identity.sic,
    sicDescription: target.identity.sicDescription,
    peerCount: sameIndustryPeers.length,
    metrics,
    caveats: limited
      ? ["Fewer than three same-SIC peer snapshots are available from SEC data."]
      : [],
  };
}

export function normalizeCompanySnapshot(
  identity: CompanyIdentity,
  submissions: SecSubmissionsResponse,
  facts: SecCompanyFactsResponse,
  peerComparison?: PeerComparison,
  previousCaveats?: string[],
): CompanySnapshot {
  const enrichedIdentity = enrichIdentityFromSubmissions(identity, submissions);
  const periods = new Map<number, FinancialPeriod>();
  const quarterlyPeriods = new Map<string, FinancialPeriod>();
  const fiscalYearEnd = enrichedIdentity.fiscalYearEnd;
  const annualFacts = (tags: readonly string[], preferredUnits: readonly string[]) =>
    selectFactsByYear(facts, tags, preferredUnits, fiscalYearEnd);
  const quarterlyFacts = (tags: readonly string[], preferredUnits: readonly string[]) =>
    selectFactsByQuarter(facts, tags, preferredUnits, fiscalYearEnd);
  const quarterlyDurationFacts = (
    tags: readonly string[],
    preferredUnits: readonly string[],
  ) => selectQuarterlyDurationFacts(facts, tags, preferredUnits, fiscalYearEnd);

  addAnnualFactValues(
    periods,
    "revenue",
    annualFacts(FACT_TAGS.revenue, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "grossProfit",
    annualFacts(FACT_TAGS.grossProfit, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "operatingIncome",
    annualFacts(FACT_TAGS.operatingIncome, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "netIncome",
    annualFacts(FACT_TAGS.netIncome, ["USD"]),
  );
  addAnnualFactValues(periods, "assets", annualFacts(FACT_TAGS.assets, ["USD"]));
  addAnnualFactValues(
    periods,
    "liabilities",
    annualFacts(FACT_TAGS.liabilities, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "currentAssets",
    annualFacts(FACT_TAGS.currentAssets, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "currentLiabilities",
    annualFacts(FACT_TAGS.currentLiabilities, ["USD"]),
  );
  addAnnualFactValues(periods, "equity", annualFacts(FACT_TAGS.equity, ["USD"]));
  addAnnualFactValues(periods, "cash", annualFacts(FACT_TAGS.cash, ["USD"]));
  addAnnualFactValues(
    periods,
    "operatingCashFlow",
    annualFacts(FACT_TAGS.operatingCashFlow, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "capitalExpenditure",
    annualFacts(FACT_TAGS.capitalExpenditure, ["USD"]),
    (value) => Math.abs(value),
  );
  addAnnualFactValues(
    periods,
    "researchAndDevelopment",
    annualFacts(FACT_TAGS.researchAndDevelopment, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "sellingGeneralAdministrative",
    annualFacts(FACT_TAGS.sellingGeneralAdministrative, ["USD"]),
  );
  addAnnualFactValues(
    periods,
    "buybacks",
    annualFacts(FACT_TAGS.buybacks, ["USD"]),
    (value) => Math.abs(value),
  );
  addAnnualFactValues(
    periods,
    "dividends",
    annualFacts(FACT_TAGS.dividends, ["USD"]),
    (value) => Math.abs(value),
  );
  addAnnualFactValues(
    periods,
    "epsDiluted",
    annualFacts(FACT_TAGS.epsDiluted, ["USD/shares"]),
  );
  addAnnualFactValues(
    periods,
    "sharesDiluted",
    annualFacts(FACT_TAGS.sharesDiluted, ["shares"]),
  );
  buildDebtByYear(periods, facts, fiscalYearEnd);

  addQuarterlyFactValues(
    quarterlyPeriods,
    "revenue",
    quarterlyDurationFacts(FACT_TAGS.revenue, ["USD"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "grossProfit",
    quarterlyDurationFacts(FACT_TAGS.grossProfit, ["USD"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "operatingIncome",
    quarterlyDurationFacts(FACT_TAGS.operatingIncome, ["USD"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "netIncome",
    quarterlyDurationFacts(FACT_TAGS.netIncome, ["USD"]),
  );
  addQuarterlyInstantFactValues(
    quarterlyPeriods,
    "assets",
    quarterlyFacts(FACT_TAGS.assets, ["USD"]),
  );
  addQuarterlyInstantFactValues(
    quarterlyPeriods,
    "liabilities",
    quarterlyFacts(FACT_TAGS.liabilities, ["USD"]),
  );
  addQuarterlyInstantFactValues(
    quarterlyPeriods,
    "currentAssets",
    quarterlyFacts(FACT_TAGS.currentAssets, ["USD"]),
  );
  addQuarterlyInstantFactValues(
    quarterlyPeriods,
    "currentLiabilities",
    quarterlyFacts(FACT_TAGS.currentLiabilities, ["USD"]),
  );
  addQuarterlyInstantFactValues(
    quarterlyPeriods,
    "equity",
    quarterlyFacts(FACT_TAGS.equity, ["USD"]),
  );
  addQuarterlyInstantFactValues(
    quarterlyPeriods,
    "cash",
    quarterlyFacts(FACT_TAGS.cash, ["USD"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "operatingCashFlow",
    quarterlyDurationFacts(FACT_TAGS.operatingCashFlow, ["USD"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "capitalExpenditure",
    quarterlyDurationFacts(FACT_TAGS.capitalExpenditure, ["USD"]),
    (value) => Math.abs(value),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "researchAndDevelopment",
    quarterlyDurationFacts(FACT_TAGS.researchAndDevelopment, ["USD"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "sellingGeneralAdministrative",
    quarterlyDurationFacts(FACT_TAGS.sellingGeneralAdministrative, ["USD"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "buybacks",
    quarterlyDurationFacts(FACT_TAGS.buybacks, ["USD"]),
    (value) => Math.abs(value),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "dividends",
    quarterlyDurationFacts(FACT_TAGS.dividends, ["USD"]),
    (value) => Math.abs(value),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "epsDiluted",
    quarterlyDurationFacts(FACT_TAGS.epsDiluted, ["USD/shares"]),
  );
  addQuarterlyFactValues(
    quarterlyPeriods,
    "sharesDiluted",
    quarterlyDurationFacts(FACT_TAGS.sharesDiluted, ["shares"]),
  );
  buildDebtByQuarter(quarterlyPeriods, facts, fiscalYearEnd);

  const normalizedPeriods = Array.from(periods.values())
    .map(withDerivedFields)
    .sort((a, b) => b.fiscalYear - a.fiscalYear)
    .slice(0, 5);
  const normalizedQuarterlyPeriods = sortedPeriods(
    Array.from(quarterlyPeriods.values()).map(withDerivedFields),
  ).slice(0, 8);
  const ttmPeriod = buildTtmPeriod(normalizedQuarterlyPeriods);
  const filings = extractRecentFilings(submissions, 40);
  const latestAnnualFromFilings = filings.find((filing) =>
    ANNUAL_FORMS.has(filing.form),
  );
  const latestQuarterlyFromFilings = filings.find((filing) =>
    QUARTERLY_FORMS.has(filing.form),
  );
  const latestAnnualFromPeriods = normalizedPeriods.find(
    (period) => period.periodType === "annual" && ANNUAL_FORMS.has(period.form ?? ""),
  );
  const latestQuarterlyFromPeriods = normalizedQuarterlyPeriods.find(
    (period) => period.periodType === "quarterly" && QUARTERLY_FORMS.has(period.form ?? ""),
  );
  const latestAnnualFiling =
    latestAnnualFromFilings ??
    filingFromPeriod(enrichedIdentity, latestAnnualFromPeriods);
  const latestQuarterlyFiling =
    latestQuarterlyFromFilings ??
    filingFromPeriod(enrichedIdentity, latestQuarterlyFromPeriods);
  const latestFinancialFiling =
    filings.find((filing) => FINANCIAL_FORMS.has(filing.form)) ??
    latestAnnualFiling ??
    latestQuarterlyFiling;
  const metrics = buildMetrics(normalizedPeriods, ttmPeriod);
  const balanceSheetAnalysis = buildBalanceSheetAnalysis(
    normalizedPeriods,
    normalizedQuarterlyPeriods,
  );
  const dataQuality = buildDataQuality(
    normalizedPeriods,
    normalizedQuarterlyPeriods,
    latestFinancialFiling,
    facts,
  );
  const resolvedPeerComparison = peerComparison ?? emptyPeerComparison(enrichedIdentity);
  const caveats = buildCaveats(
    normalizedPeriods,
    normalizedQuarterlyPeriods,
    resolvedPeerComparison,
    facts,
  );

  return {
    identity: enrichedIdentity,
    latestFiling: filings[0],
    latestFinancialFiling,
    latestAnnualFiling,
    latestQuarterlyFiling,
    filings,
    periods: normalizedPeriods,
    quarterlyPeriods: normalizedQuarterlyPeriods,
    ttmPeriod,
    metrics,
    changeAnalysis: buildChangeAnalysis(normalizedPeriods, normalizedQuarterlyPeriods),
    caveatChangeAnalysis: buildCaveatChangeAnalysis(caveats, previousCaveats),
    businessDrivers: buildBusinessDrivers(
      metrics,
      normalizedPeriods,
      normalizedQuarterlyPeriods,
      ttmPeriod,
    ),
    balanceSheetAnalysis,
    peerComparison: resolvedPeerComparison,
    dataQuality,
    decisionFramework: buildDecisionFramework(metrics, balanceSheetAnalysis, dataQuality),
    caveats,
    citations: buildCitations(enrichedIdentity, normalizedPeriods, latestAnnualFiling, latestQuarterlyFiling),
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
