import { getFmpApiKey, getFmpBaseUrl } from "@/lib/env";
import type { MetricUnit, ValuationMetric, ValuationSnapshot } from "@/lib/types";

const FETCH_TIMEOUT_MS = 12_000;

type FmpRatiosItem = {
  symbol?: string;
  marketCap?: unknown;
  enterpriseValue?: unknown;
  priceEarningsRatio?: unknown;
  peRatio?: unknown;
  priceToBookRatio?: unknown;
  pbRatio?: unknown;
  enterpriseValueOverEBITDA?: unknown;
  evEbitda?: unknown;
  enterpriseToRevenueRatio?: unknown;
  debtToEquity?: unknown;
  returnOnEquity?: unknown;
  returnOnEquityTTM?: unknown;
};

type FmpQuoteItem = {
  symbol?: string;
  marketCap?: unknown;
  marketCapitalization?: unknown;
  mktCap?: unknown;
  market_cap?: unknown;
};

type FmpSourceName = ValuationMetric["source"];

const METADATA_KEYS = new Set([
  "symbol",
  "date",
  "fiscalYear",
  "period",
  "reportedCurrency",
  "name",
  "exchange",
]);

const LABEL_OVERRIDES: Record<string, string> = {
  marketCap: "Market cap",
  marketCapitalization: "Market cap",
  mktCap: "Market cap",
  market_cap: "Market cap",
  enterpriseValue: "Enterprise value",
  marketCapTTM: "Market cap TTM",
  enterpriseValueTTM: "Enterprise value TTM",
  priceEarningsRatio: "P/E ratio",
  peRatio: "P/E ratio",
  priceToEarningsRatioTTM: "P/E ratio TTM",
  priceToEarningsGrowthRatioTTM: "PEG ratio TTM",
  priceToBookRatio: "P/B ratio",
  pbRatio: "P/B ratio",
  priceToBookRatioTTM: "P/B ratio TTM",
  enterpriseValueOverEBITDA: "EV/EBITDA",
  evEbitda: "EV/EBITDA",
  enterpriseValueMultipleTTM: "EV/EBITDA TTM",
  enterpriseToRevenueRatio: "EV/Revenue",
  evToSales: "EV/Sales",
  evToEBITDA: "EV/EBITDA",
  evToFreeCashFlow: "EV/FCF",
  evToOperatingCashFlow: "EV/OCF",
  priceToFreeCashFlowRatioTTM: "P/FCF ratio TTM",
  priceToOperatingCashFlowRatioTTM: "P/OCF ratio TTM",
  priceToSalesRatioTTM: "P/S ratio TTM",
  debtToEquity: "Debt / equity",
  debtToEquityRatioTTM: "Debt / equity ratio TTM",
  debtToAssetsRatioTTM: "Debt / assets ratio TTM",
  debtToCapitalRatioTTM: "Debt / capital ratio TTM",
  debtToMarketCapTTM: "Debt / market cap TTM",
  longTermDebtToCapitalRatioTTM: "Long-term debt / capital ratio TTM",
  currentRatio: "Current ratio",
  currentRatioTTM: "Current ratio TTM",
  quickRatioTTM: "Quick ratio TTM",
  cashRatioTTM: "Cash ratio TTM",
  workingCapital: "Working capital",
  workingCapitalTurnoverRatioTTM: "Working capital turnover ratio TTM",
  netDebtToEBITDA: "Net debt / EBITDA",
  returnOnEquity: "ROE",
  returnOnEquityTTM: "ROE TTM",
  returnOnAssets: "ROA",
  returnOnAssetsTTM: "ROA TTM",
  operatingReturnOnAssets: "Operating ROA",
  returnOnCapitalEmployed: "ROCE",
  returnOnInvestedCapital: "ROIC",
  returnOnTangibleAssets: "ROTA",
  earningsYield: "Earnings yield",
  freeCashFlowYield: "FCF yield",
  freeCashFlowToEquity: "FCF to equity",
  freeCashFlowToFirm: "FCF to firm",
  freeCashFlowOperatingCashFlowRatioTTM: "FCF / OCF ratio TTM",
  operatingCashFlowRatioTTM: "OCF ratio TTM",
  operatingCashFlowSalesRatioTTM: "OCF / sales ratio TTM",
  operatingCashFlowCoverageRatioTTM: "OCF coverage ratio TTM",
  shortTermOperatingCashFlowCoverageRatioTTM: "Short-term OCF coverage ratio TTM",
  capitalExpenditureCoverageRatioTTM: "Capex coverage ratio TTM",
  dividendYieldTTM: "Dividend yield TTM",
  dividendPayoutRatioTTM: "Dividend payout ratio TTM",
  dividendPerShareTTM: "Dividend per share TTM",
  revenuePerShareTTM: "Revenue per share TTM",
  bookValuePerShareTTM: "Book value per share TTM",
  cashPerShareTTM: "Cash per share TTM",
  freeCashFlowPerShareTTM: "FCF per share TTM",
  operatingCashFlowPerShareTTM: "OCF per share TTM",
  netIncomePerShareTTM: "Net income per share TTM",
  shareholdersEquityPerShareTTM: "Shareholders' equity per share TTM",
  tangibleBookValuePerShareTTM: "Tangible book value per share TTM",
  capexPerShareTTM: "Capex per share TTM",
  interestDebtPerShareTTM: "Interest debt per share TTM",
  grossProfitMarginTTM: "Gross margin TTM",
  operatingProfitMarginTTM: "Operating margin TTM",
  ebitdaMarginTTM: "EBITDA margin TTM",
  ebitMarginTTM: "EBIT margin TTM",
  netProfitMarginTTM: "Net margin TTM",
  bottomLineProfitMarginTTM: "Bottom-line margin TTM",
  continuousOperationsProfitMarginTTM: "Continuing ops margin TTM",
  pretaxProfitMarginTTM: "Pre-tax margin TTM",
  effectiveTaxRateTTM: "Effective tax rate TTM",
  taxBurden: "Tax burden",
  interestBurden: "Interest burden",
  incomeQuality: "Income quality",
  capexToRevenue: "Capex / revenue",
  capexToOperatingCashFlow: "Capex / OCF",
  capexToDepreciation: "Capex / depreciation",
  cashConversionCycle: "Cash conversion cycle",
  daysOfInventoryOutstanding: "Days inventory outstanding",
  daysOfPayablesOutstanding: "Days payables outstanding",
  daysOfSalesOutstanding: "Days sales outstanding",
  averageInventory: "Average inventory",
  averagePayables: "Average payables",
  averageReceivables: "Average receivables",
  intangiblesToTotalAssets: "Intangibles / total assets",
  grahamNetNet: "Graham net-net",
  grahamNumber: "Graham number",
  netCurrentAssetValue: "Net current asset value",
  investedCapital: "Invested capital",
  assetTurnoverTTM: "Asset turnover TTM",
  fixedAssetTurnoverTTM: "Fixed asset turnover TTM",
  inventoryTurnoverTTM: "Inventory turnover TTM",
  payablesTurnoverTTM: "Payables turnover TTM",
  receivablesTurnoverTTM: "Receivables turnover TTM",
  operatingCycle: "Operating cycle",
  financialLeverageRatioTTM: "Financial leverage ratio TTM",
  solvencyRatioTTM: "Solvency ratio TTM",
  interestCoverageRatioTTM: "Interest coverage ratio TTM",
  debtServiceCoverageRatioTTM: "Debt service coverage ratio TTM",
  dividendPaidAndCapexCoverageRatioTTM: "Dividend + capex coverage ratio TTM",
  stockBasedCompensationToRevenue: "SBC / revenue",
  researchAndDevelopementToRevenue: "R&D / revenue",
  salesGeneralAndAdministrativeToRevenue: "SG&A / revenue",
  priceToFairValueTTM: "Price / fair value TTM",
};

function isNumericValue(value: unknown): value is number | string {
  return (
    typeof value === "number" ||
    (typeof value === "string" && value.trim().length > 0)
  );
}

function inferUnit(key: string, source: FmpSourceName): MetricUnit {
  if (source === "quote") {
    if (key === "volume" || key === "timestamp") {
      return "number";
    }

    return key === "price" ||
      key === "dayHigh" ||
      key === "dayLow" ||
      key === "open" ||
      key === "previousClose" ||
      key === "priceAvg200" ||
      key === "priceAvg50" ||
      key === "yearHigh" ||
      key === "yearLow" ||
      key === "marketCap" ||
      key === "marketCapitalization" ||
      key === "mktCap" ||
      key === "market_cap"
      ? "currency"
      : "number";
  }

  if (
    key === "marketCap" ||
    key === "marketCapTTM" ||
    key === "enterpriseValue" ||
    key === "enterpriseValueTTM" ||
    key === "workingCapital" ||
    key === "netCurrentAssetValue" ||
    key === "investedCapital" ||
    key === "tangibleAssetValue" ||
    key === "freeCashFlowToEquity" ||
    key === "freeCashFlowToFirm" ||
    key === "averageInventory" ||
    key === "averagePayables" ||
    key === "averageReceivables"
  ) {
    return "currency";
  }

  if (
    key.endsWith("PerShareTTM") ||
    key === "bookValuePerShareTTM" ||
    key === "cashPerShareTTM" ||
    key === "freeCashFlowPerShareTTM" ||
    key === "operatingCashFlowPerShareTTM" ||
    key === "netIncomePerShareTTM" ||
    key === "shareholdersEquityPerShareTTM" ||
    key === "tangibleBookValuePerShareTTM" ||
    key === "dividendPerShareTTM" ||
    key === "capexPerShareTTM" ||
    key === "interestDebtPerShareTTM"
  ) {
    return "currency";
  }

  if (
    key.includes("Margin") ||
    key.includes("Yield") ||
    key.startsWith("returnOn") ||
    key === "operatingReturnOnAssets" ||
    key === "earningsYield" ||
    key === "incomeQuality" ||
    key === "taxBurden" ||
    key === "interestBurden" ||
    key === "effectiveTaxRateTTM" ||
    key === "dividendPayoutRatioTTM" ||
    key === "stockBasedCompensationToRevenue" ||
    key === "researchAndDevelopementToRevenue" ||
    key === "salesGeneralAndAdministrativeToRevenue" ||
    key === "capexToRevenue" ||
    key === "capexToOperatingCashFlow" ||
    key === "capexToDepreciation" ||
    key === "freeCashFlowOperatingCashFlowRatioTTM" ||
    key === "operatingCashFlowRatioTTM" ||
    key === "operatingCashFlowSalesRatioTTM" ||
    key === "operatingCashFlowCoverageRatioTTM" ||
    key === "shortTermOperatingCashFlowCoverageRatioTTM" ||
    key === "capitalExpenditureCoverageRatioTTM" ||
    key === "dividendPaidAndCapexCoverageRatioTTM"
  ) {
    return "percent";
  }

  return "ratio";
}

function humanizeKey(key: string): string {
  return key
    .replace(/TTM$/, " TTM")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/\bTo\b/g, "to")
    .replace(/\bOf\b/g, "of");
}

function metricLabel(key: string): string {
  return LABEL_OVERRIDES[key] ?? humanizeKey(key);
}

function normalizeTicker(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(normalized)) {
    throw new Error(`Invalid ticker: ${value}`);
  }
  return normalized;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        apikey: apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`FMP request failed (${response.status})`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMaybeJson<T>(url: string, apiKey: string): Promise<T | null> {
  try {
    return await fetchJson<T>(url, apiKey);
  } catch {
    return null;
  }
}

function firstObject<T>(payload: T | T[] | null | undefined): T | null {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  return payload;
}

function collectMetrics(
  payload: Record<string, unknown> | null | undefined,
  source: FmpSourceName,
): ValuationMetric[] {
  if (!payload) {
    return [];
  }

  return Object.entries(payload)
    .filter(([key, value]) => !METADATA_KEYS.has(key) && isNumericValue(value))
    .map(([key, value]) => ({
      id: key,
      label: metricLabel(key),
      value: asNumber(value),
      unit: inferUnit(key, source),
      source,
    }));
}

function getFirstMetricValue(
  metrics: ValuationMetric[],
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const match = metrics.find((metric) => metric.id === key);
    if (match) {
      return match.value;
    }
  }

  return null;
}

export async function getValuationForTicker(ticker: string): Promise<ValuationSnapshot> {
  const normalized = normalizeTicker(ticker);
  const apiKey = getFmpApiKey();

  if (!apiKey) {
    throw new Error("FMP_API_KEY is not configured");
  }

  const baseUrl = getFmpBaseUrl().replace(/\/+$/, "");
  const keyMetricsUrl = `${baseUrl}/key-metrics?symbol=${encodeURIComponent(normalized)}`;
  const quoteUrl = `${baseUrl}/quote?symbol=${encodeURIComponent(normalized)}`;
  const ratiosUrl = `${baseUrl}/ratios-ttm?symbol=${encodeURIComponent(normalized)}`;

  const [rawMetrics, rawQuote, rawRatios] = await Promise.all([
    fetchMaybeJson<FmpRatiosItem[] | FmpRatiosItem>(keyMetricsUrl, apiKey),
    fetchMaybeJson<FmpQuoteItem | FmpQuoteItem[]>(quoteUrl, apiKey),
    fetchMaybeJson<FmpRatiosItem[] | FmpRatiosItem>(ratiosUrl, apiKey),
  ]);

  const keyMetrics = firstObject<FmpRatiosItem>(rawMetrics);
  const ratiosTtm = firstObject<FmpRatiosItem>(rawRatios);
  const quote = firstObject<FmpQuoteItem>(rawQuote);

  if (!keyMetrics && !ratiosTtm && !quote) {
    throw new Error(`No valuation data available for ${normalized}`);
  }

  const metrics = [
    ...collectMetrics(keyMetrics as Record<string, unknown> | null, "key-metrics"),
    ...collectMetrics(ratiosTtm as Record<string, unknown> | null, "ratios-ttm"),
    ...collectMetrics(quote as Record<string, unknown> | null, "quote"),
  ].reduce<ValuationMetric[]>((acc, metric) => {
    const existingIndex = acc.findIndex((item) => item.id === metric.id);
    if (existingIndex === -1) {
      acc.push(metric);
      return acc;
    }

    const existing = acc[existingIndex];
    const rank = {
      "key-metrics": 3,
      "ratios-ttm": 2,
      quote: 1,
    } as const;

    if (rank[metric.source] > rank[existing.source]) {
      acc[existingIndex] = metric;
    }

    return acc;
  }, []);

  metrics.sort((left, right) => {
    const order = {
      "key-metrics": 0,
      "ratios-ttm": 1,
      quote: 2,
    } as const;

    return (
      order[left.source] - order[right.source] ||
      left.label.localeCompare(right.label)
    );
  });

  return {
    ticker: normalized,
    asOf: new Date().toISOString(),
    marketCap:
      getFirstMetricValue(metrics, "marketCap", "marketCapitalization", "mktCap", "market_cap") ??
      asNumber(quote?.marketCap) ??
      asNumber(quote?.marketCapitalization) ??
      asNumber(quote?.mktCap) ??
      asNumber(quote?.market_cap),
    priceToEarnings:
      getFirstMetricValue(
        metrics,
        "priceEarningsRatio",
        "peRatio",
        "priceToEarningsRatioTTM",
      ),
    priceToBook:
      getFirstMetricValue(
        metrics,
        "priceToBookRatio",
        "pbRatio",
        "priceToBookRatioTTM",
      ),
    enterpriseValueToEbitda:
      getFirstMetricValue(
        metrics,
        "enterpriseValueOverEBITDA",
        "evEbitda",
        "enterpriseValueMultipleTTM",
      ),
    debtToEquity:
      getFirstMetricValue(
        metrics,
        "debtToEquity",
        "debtToEquityRatioTTM",
      ),
    returnOnEquity:
      getFirstMetricValue(
        metrics,
        "returnOnEquity",
        "returnOnEquityTTM",
      ),
    currency: "USD",
    source: keyMetrics || ratiosTtm
      ? "financialmodelingprep.com"
      : "financialmodelingprep.com (quote fallback)",
    metrics,
  };
}
