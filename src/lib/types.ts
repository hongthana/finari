export type TrendSignal = "positive" | "neutral" | "negative" | "unknown";

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

export interface FinancialPeriod {
  fiscalYear: number;
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
  operatingCashFlow?: number | null;
  capitalExpenditure?: number | null;
  freeCashFlow?: number | null;
  epsDiluted?: number | null;
  sharesDiluted?: number | null;
}

export interface FinancialMetric {
  id: string;
  label: string;
  value: number | null;
  unit: "currency" | "percent" | "ratio" | "number";
  description: string;
  signal: TrendSignal;
}

export interface CompanySnapshot {
  identity: CompanyIdentity;
  latestFiling?: FilingSummary;
  filings: FilingSummary[];
  periods: FinancialPeriod[];
  metrics: FinancialMetric[];
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
  disclaimer: string;
  sections: MemoSection[];
  citations: SourceCitation[];
}

export interface WaitlistLead {
  email: string;
  investorProfile: string;
  interestArea: string;
  sourceTicker?: string;
}

export interface WaitlistLeadRecord extends WaitlistLead {
  id: number;
  createdAt: string;
}
