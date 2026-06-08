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

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
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

async function fetchMaybeJson<T>(url: string): Promise<T | null> {
  try {
    return await fetchJson<T>(url);
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
  const keyMetricsUrl = `${baseUrl}/key-metrics?symbol=${encodeURIComponent(normalized)}&apikey=${encodeURIComponent(apiKey)}`;
  const quoteUrl = `${baseUrl}/quote?symbol=${encodeURIComponent(normalized)}&apikey=${encodeURIComponent(apiKey)}`;
  const ratiosUrl = `${baseUrl}/ratios-ttm?symbol=${encodeURIComponent(normalized)}&apikey=${encodeURIComponent(apiKey)}`;

  const [rawMetrics, rawQuote, rawRatios] = await Promise.all([
    fetchMaybeJson<FmpRatiosItem[] | FmpRatiosItem>(keyMetricsUrl),
    fetchMaybeJson<FmpQuoteItem | FmpQuoteItem[]>(quoteUrl),
    fetchMaybeJson<FmpRatiosItem[] | FmpRatiosItem>(ratiosUrl),
  ]);

  const ratios =
    firstObject<FmpRatiosItem>(rawMetrics) ?? firstObject<FmpRatiosItem>(rawRatios);
  const quote = firstObject<FmpQuoteItem>(rawQuote);

  if (!ratios) {
    throw new Error(`No valuation data available for ${normalized}`);
  }

  return {
    ticker: normalized,
    asOf: new Date().toISOString(),
    marketCap:
      asNumber(ratios.marketCap) ??
      asNumber(quote?.marketCap) ??
      asNumber(quote?.marketCapitalization) ??
      asNumber(quote?.mktCap) ??
      asNumber(quote?.market_cap),
    priceToEarnings:
      asNumber(ratios.priceEarningsRatio) ??
      asNumber(ratios.peRatio),
    priceToBook:
      asNumber(ratios.priceToBookRatio) ??
      asNumber(ratios.pbRatio),
    enterpriseValueToEbitda:
      asNumber(ratios.enterpriseValueOverEBITDA) ??
      asNumber(ratios.evEbitda),
    debtToEquity:
      asNumber(ratios.debtToEquity),
    returnOnEquity:
      asNumber(ratios.returnOnEquity) ??
      asNumber(ratios.returnOnEquityTTM),
    currency: "USD",
    source: "financialmodelingprep.com",
  };
}
