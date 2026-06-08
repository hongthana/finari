import { getFmpApiKey, getFmpBaseUrl } from "@/lib/env";
import type { ValuationSnapshot } from "@/lib/types";

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

  const ratios =
    firstObject<FmpRatiosItem>(rawMetrics) ?? firstObject<FmpRatiosItem>(rawRatios);
  const quote = firstObject<FmpQuoteItem>(rawQuote);

  if (!ratios && !quote) {
    throw new Error(`No valuation data available for ${normalized}`);
  }

  const metricSource = ratios ?? {};

  return {
    ticker: normalized,
    asOf: new Date().toISOString(),
    marketCap:
      asNumber(metricSource.marketCap) ??
      asNumber(quote?.marketCap) ??
      asNumber(quote?.marketCapitalization) ??
      asNumber(quote?.mktCap) ??
      asNumber(quote?.market_cap),
    priceToEarnings:
      asNumber(metricSource.priceEarningsRatio) ??
      asNumber(metricSource.peRatio),
    priceToBook:
      asNumber(metricSource.priceToBookRatio) ??
      asNumber(metricSource.pbRatio),
    enterpriseValueToEbitda:
      asNumber(metricSource.enterpriseValueOverEBITDA) ??
      asNumber(metricSource.evEbitda),
    debtToEquity:
      asNumber(metricSource.debtToEquity),
    returnOnEquity:
      asNumber(metricSource.returnOnEquity) ??
      asNumber(metricSource.returnOnEquityTTM),
    currency: "USD",
    source: ratios
      ? "financialmodelingprep.com"
      : "financialmodelingprep.com (quote fallback)",
  };
}
