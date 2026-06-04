import { getSecUserAgent } from "@/lib/env";
import type { CompanyIdentity, FilingSummary } from "@/lib/types";

const SEC_DATA_BASE = "https://data.sec.gov";
const SEC_WWW_BASE = "https://www.sec.gov";
const TICKER_DIRECTORY_URL = `${SEC_WWW_BASE}/files/company_tickers.json`;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const MIN_SEC_INTERVAL_MS = 125;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface SecGlobalState {
  cache: Map<string, CacheEntry<unknown>>;
  lastRequestAt: number;
  queue: Promise<void>;
}

const secState = globalThis as typeof globalThis & {
  __finariSecState?: SecGlobalState;
};

function getState(): SecGlobalState {
  if (!secState.__finariSecState) {
    secState.__finariSecState = {
      cache: new Map(),
      lastRequestAt: 0,
      queue: Promise.resolve(),
    };
  }

  return secState.__finariSecState;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSecTurn(): Promise<void> {
  const state = getState();
  const previous = state.queue;

  let release!: () => void;
  state.queue = new Promise((resolve) => {
    release = resolve;
  });

  await previous;

  const elapsed = Date.now() - state.lastRequestAt;
  if (elapsed < MIN_SEC_INTERVAL_MS) {
    await sleep(MIN_SEC_INTERVAL_MS - elapsed);
  }

  state.lastRequestAt = Date.now();
  release();
}

async function fetchSecJson<T>(url: string, ttlMs: number): Promise<T> {
  const state = getState();
  const cached = state.cache.get(url) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  await waitForSecTurn();

  const response = await fetch(url, {
    headers: {
      "User-Agent": getSecUserAgent(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`SEC request failed (${response.status}) for ${url}`);
  }

  const value = (await response.json()) as T;
  state.cache.set(url, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

export function clearSecCache(): void {
  getState().cache.clear();
}

export function padCik(cik: string | number): string {
  const digits = String(cik).replace(/\D/g, "");

  if (!digits) {
    throw new Error("CIK must contain digits");
  }

  return digits.padStart(10, "0");
}

interface SecTickerDirectoryEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

type SecTickerDirectoryResponse = Record<string, SecTickerDirectoryEntry>;

export async function getTickerDirectory(): Promise<CompanyIdentity[]> {
  const raw = await fetchSecJson<SecTickerDirectoryResponse>(
    TICKER_DIRECTORY_URL,
    ONE_DAY_MS,
  );

  return Object.values(raw)
    .map((entry) => ({
      cik: padCik(entry.cik_str),
      ticker: entry.ticker.toUpperCase(),
      name: entry.title,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function searchCompanies(
  query: string,
  limit = 8,
): Promise<CompanyIdentity[]> {
  const normalized = query.trim().toUpperCase();

  if (!normalized) {
    return [];
  }

  const directory = await getTickerDirectory();
  const startsWith = directory.filter(
    (company) =>
      company.ticker.startsWith(normalized) ||
      company.name.toUpperCase().startsWith(normalized),
  );
  const includes = directory.filter(
    (company) =>
      !startsWith.includes(company) &&
      (company.ticker.includes(normalized) ||
        company.name.toUpperCase().includes(normalized)),
  );

  return [...startsWith, ...includes].slice(0, limit);
}

export async function findCompanyByTicker(
  ticker: string,
): Promise<CompanyIdentity | null> {
  const normalized = ticker.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  const directory = await getTickerDirectory();
  return directory.find((company) => company.ticker === normalized) ?? null;
}

export interface SecSubmissionsResponse {
  cik: string;
  name: string;
  tickers?: string[];
  exchanges?: string[];
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
}

export interface SecFactUnit {
  start?: string;
  end?: string;
  val: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
}

export interface SecCompanyFact {
  label?: string;
  description?: string;
  units?: Record<string, SecFactUnit[]>;
}

export interface SecCompanyFactsResponse {
  cik: number;
  entityName: string;
  facts?: Record<string, Record<string, SecCompanyFact>>;
}

export async function getSubmissions(
  cik: string,
): Promise<SecSubmissionsResponse> {
  return fetchSecJson<SecSubmissionsResponse>(
    `${SEC_DATA_BASE}/submissions/CIK${padCik(cik)}.json`,
    ONE_HOUR_MS,
  );
}

export async function getCompanyFacts(
  cik: string,
): Promise<SecCompanyFactsResponse> {
  return fetchSecJson<SecCompanyFactsResponse>(
    `${SEC_DATA_BASE}/api/xbrl/companyfacts/CIK${padCik(cik)}.json`,
    ONE_HOUR_MS,
  );
}

export function filingDocumentUrl(
  cik: string,
  accessionNumber: string,
  primaryDocument?: string,
): string | undefined {
  if (!primaryDocument) {
    return undefined;
  }

  const cikNumber = String(Number(cik));
  const accessionPath = accessionNumber.replaceAll("-", "");
  return `${SEC_WWW_BASE}/Archives/edgar/data/${cikNumber}/${accessionPath}/${primaryDocument}`;
}

export function extractRecentFilings(
  submissions: SecSubmissionsResponse,
  limit = 8,
): FilingSummary[] {
  const recent = submissions.filings?.recent;

  if (!recent?.accessionNumber?.length) {
    return [];
  }

  return recent.accessionNumber
    .map((accessionNumber, index) => ({
      accessionNumber,
      form: recent.form?.[index] ?? "Unknown",
      filingDate: recent.filingDate?.[index] ?? "",
      reportDate: recent.reportDate?.[index],
      primaryDocument: recent.primaryDocument?.[index],
      url: filingDocumentUrl(
        submissions.cik,
        accessionNumber,
        recent.primaryDocument?.[index],
      ),
    }))
    .filter((filing) => filing.filingDate)
    .slice(0, limit);
}

export function enrichIdentityFromSubmissions(
  identity: CompanyIdentity,
  submissions: SecSubmissionsResponse,
): CompanyIdentity {
  return {
    ...identity,
    name: submissions.name || identity.name,
    exchange: submissions.exchanges?.[0] || identity.exchange,
    sic: submissions.sic || identity.sic,
    sicDescription: submissions.sicDescription || identity.sicDescription,
    fiscalYearEnd: submissions.fiscalYearEnd || identity.fiscalYearEnd,
  };
}
