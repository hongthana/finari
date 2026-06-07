export type TrendSignal = "positive" | "neutral" | "negative" | "unknown";
export type PeriodType = "annual" | "quarterly" | "ttm";
export type MetricUnit = "currency" | "percent" | "ratio" | "number";

export type AlertCondition =
  | "above"
  | "below"
  | "change-above"
  | "change-below"
  | "above-or-equal"
  | "below-or-equal";

export type AlertType =
  | "revenue"
  | "net-income"
  | "fcf"
  | "cash"
  | "debt"
  | "working-capital"
  | "debt-to-equity"
  | "roe"
  | "custom";

export interface CompanyIdentity {
  cik: string;
  ticker: string;
  name: string;
  exchange?: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
}

export interface FilingSummary {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate?: string;
  primaryDocument?: string;
  url?: string;
}

export interface SourceCitation {
  label: string;
  url: string;
  form?: string;
  filedDate?: string;
  accessionNumber?: string;
}

export type CompanyEventType =
  | "company-specific"
  | "industry"
  | "macro"
  | "legal-regulatory"
  | "filing-related";

export type EventImpactDriver =
  | "revenue"
  | "margin"
  | "cash-flow"
  | "debt"
  | "capex"
  | "valuation-risk";

export type EventHorizon = "short-term" | "long-term" | "both" | "uncertain";
export type EventConfidence = "High" | "Medium" | "Low";
export type CompanyEventSourceType = "news" | "filing";
export type EventAnalysisMode = "deterministic" | "ai";
export type EventVisibility = "public" | "private";

export interface RawCompanyEvent {
  title: string;
  summary?: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  sourceType: CompanyEventSourceType;
  provider: string;
  form?: string;
}

export interface CompanyEventImpact {
  id: string;
  ticker: string;
  title: string;
  summary?: string;
  url: string;
  sourceName: string;
  sourceType: CompanyEventSourceType;
  provider: string;
  publishedAt: string;
  eventType: CompanyEventType;
  drivers: EventImpactDriver[];
  impact: TrendSignal;
  horizon: EventHorizon;
  watchMetric: string;
  confidence: EventConfidence;
  impactSummary: string;
  investorMeaning: string;
  analysisMode: EventAnalysisMode;
  visibility: EventVisibility;
  isFeatured?: boolean;
  isHidden?: boolean;
  generatedAt?: string;
  publishedAtAnalysis?: string;
}

export interface FinancialPeriod {
  periodType?: PeriodType;
  fiscalYear: number;
  fiscalPeriod?: string;
  startDate?: string;
  endDate?: string;
  filedDate?: string;
  form?: string;
  accessionNumber?: string;
  revenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  assets?: number | null;
  liabilities?: number | null;
  equity?: number | null;
  cash?: number | null;
  debt?: number | null;
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  workingCapital?: number | null;
  operatingCashFlow?: number | null;
  capitalExpenditure?: number | null;
  freeCashFlow?: number | null;
  researchAndDevelopment?: number | null;
  sellingGeneralAdministrative?: number | null;
  buybacks?: number | null;
  dividends?: number | null;
  epsDiluted?: number | null;
  sharesDiluted?: number | null;
}

export interface FinancialMetric {
  id: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  description: string;
  signal: TrendSignal;
}

export interface ChangeItem {
  id: string;
  label: string;
  currentValue: number | null;
  previousValue: number | null;
  change: number | null;
  unit: MetricUnit;
  signal: TrendSignal;
  description: string;
}

export interface ChangeAnalysis {
  quarterly: ChangeItem[];
  annual: ChangeItem[];
}

export interface CaveatChangeAnalysis {
  status: "baseline" | "changed" | "unchanged";
  newCaveats: string[];
  resolvedCaveats: string[];
  unchangedCaveats: string[];
}

export interface BusinessDriverDetail {
  id:
    | "product-demand"
    | "recent-quarter-demand"
    | "pricing-power"
    | "margin-pressure"
    | "cash-conversion"
    | "capital-return"
    | "working-capital-flexibility"
    | "balance-sheet-flexibility"
    | "services-hardware-mix"
    | "geographic-exposure";
  value: number | null;
  unit: MetricUnit;
  signal: TrendSignal;
}

export interface BusinessDriver {
  id:
    | "growth"
    | "profitability"
    | "cash-generation"
    | "capital-allocation"
    | "liquidity"
    | "leverage";
  signal: TrendSignal;
  primaryValue: number | null;
  secondaryValue?: number | null;
  unit: MetricUnit;
  details?: BusinessDriverDetail[];
}

export interface BalanceSheetAnalysis {
  cash: number | null;
  debt: number | null;
  netCash: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  workingCapital: number | null;
  cashToDebt: number | null;
  debtToEquity: number | null;
  liabilitiesToAssets: number | null;
  signal: TrendSignal;
}

export interface PeerMetricComparison {
  id: string;
  label: string;
  companyValue: number | null;
  peerMedian: number | null;
  unit: MetricUnit;
  signal: TrendSignal;
  description: string;
}

export interface PeerComparison {
  status: "ready" | "limited";
  sic?: string;
  sicDescription?: string;
  peerCount: number;
  metrics: PeerMetricComparison[];
  caveats: string[];
}

export interface DataQualityCheck {
  id: string;
  label: string;
  passed: boolean;
  description: string;
}

export interface DataQuality {
  score: number;
  label: "High" | "Medium" | "Low";
  signal: TrendSignal;
  summary: string;
  checks: DataQualityCheck[];
}

export interface DecisionFramework {
  signal: TrendSignal;
  takeaway: "constructive" | "mixed" | "caution" | "limited";
  strongestEvidence: string;
  mainRisk: string;
  watchMetric: string;
}

export interface CompanySnapshot {
  identity: CompanyIdentity;
  latestFiling?: FilingSummary;
  latestFinancialFiling?: FilingSummary;
  latestAnnualFiling?: FilingSummary;
  latestQuarterlyFiling?: FilingSummary;
  filings: FilingSummary[];
  periods: FinancialPeriod[];
  quarterlyPeriods: FinancialPeriod[];
  ttmPeriod?: FinancialPeriod;
  metrics: FinancialMetric[];
  changeAnalysis: ChangeAnalysis;
  caveatChangeAnalysis: CaveatChangeAnalysis;
  businessDrivers: BusinessDriver[];
  balanceSheetAnalysis: BalanceSheetAnalysis;
  peerComparison: PeerComparison;
  dataQuality: DataQuality;
  decisionFramework: DecisionFramework;
  caveats: string[];
  citations: SourceCitation[];
  generatedAt: string;
}

export interface MemoSection {
  title: string;
  body: string;
  signal?: TrendSignal;
}

export interface ResearchMemo {
  company: CompanyIdentity;
  generatedAt: string;
  mode: "ai" | "fallback";
  visibility?: "public" | "private";
  disclaimer: string;
  sections: MemoSection[];
  citations: SourceCitation[];
}

export interface AlertConfig {
  threshold: number;
  condition: AlertCondition;
  notes?: string;
}

export interface AlertPreference {
  id: string;
  userId: string;
  ticker: string;
  alertType: AlertType | string;
  config: AlertConfig;
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDelivery {
  id: string;
  userId: string;
  alertPreferenceId: string;
  companyName: string;
  ticker: string;
  alertType: string;
  channel: "in-app";
  status: "queued" | "read" | "dismissed";
  emailStatus: "queued" | "sent" | "failed" | "skipped";
  emailError: string | null;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  currentValue: number | null;
  previousValue: number | null;
  threshold: number;
  condition: AlertCondition;
  unit: MetricUnit;
  deliveredAt: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDeliveryJobSummary {
  scanned: number;
  triggered: number;
  queued: number;
  emailSent: number;
  emailFailed: number;
  skipped: number;
  deduped: number;
}

export interface WaitlistLead {
  email: string;
  investorProfile: string;
  interestArea: string;
  sourceTicker?: string;
}

export interface WaitlistLeadRecord extends WaitlistLead {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceExportMemo {
  company: CompanyIdentity;
  disclaimer: string;
  mode: "ai" | "fallback";
  sections: MemoSection[];
}

export interface WorkspaceExportPayload {
  scope: "memo" | "snapshot";
  ticker: string;
  companyName: string;
  generatedAt: string;
  snapshotSummary: {
    latestFiling: string | null;
    latestFinancialFiling: string | null;
    latestAnnualFiling: string | null;
    latestQuarterlyFiling: string | null;
    latestRevenue: number | null;
    latestNetIncome: number | null;
    latestFreeCashFlow: number | null;
    latestDebt: number | null;
    balanceSheetSignal: string;
  };
  memo?: WorkspaceExportMemo;
}

export interface ValuationSnapshot {
  ticker: string;
  asOf: string;
  marketCap: number | null;
  priceToEarnings: number | null;
  priceToBook: number | null;
  enterpriseValueToEbitda: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
  currency: string | null;
  source: string;
}
