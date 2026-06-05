import { cacheKey, getJsonCache, setJsonCache, stableHash } from "@/lib/cache";
import { getSecUserAgent } from "@/lib/env";
import {
  extractRecentFilings,
  findCompanyByTicker,
  getSubmissions,
} from "@/lib/sec";
import type {
  CompanyEventImpact,
  CompanyEventType,
  CompanyIdentity,
  EventConfidence,
  EventHorizon,
  EventImpactDriver,
  FilingSummary,
  TrendSignal,
} from "@/lib/types";

const EVENTS_CACHE_TTL_SECONDS = 30 * 60;
const RSS_FETCH_TIMEOUT_MS = 8_000;
const MAX_NEWS_ITEMS = 6;
const MAX_FILING_ITEMS = 4;
const DEFAULT_NEWS_RSS_TEMPLATE =
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US";
const EVENT_FILING_FORMS = new Set([
  "8-K",
  "8-K/A",
  "10-K",
  "10-K/A",
  "10-Q",
  "10-Q/A",
  "DEF 14A",
  "S-1",
  "S-1/A",
]);

interface RawEvent {
  title: string;
  summary?: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  sourceType: "news" | "filing";
  form?: string;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value: string): string {
  return stripHtml(
    value
      .replaceAll("<![CDATA[", "")
      .replaceAll("]]>", "")
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", "\"")
      .replaceAll("&#39;", "'")
      .replaceAll("&apos;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">"),
  );
}

function textFromTag(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match?.[1] ? decodeXml(match[1]) : undefined;
}

function domainName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname || "News source";
  } catch {
    return "News source";
  }
}

function newsFeedUrl(ticker: string): string {
  const template = process.env.NEWS_RSS_URL_TEMPLATE?.trim() || DEFAULT_NEWS_RSS_TEMPLATE;
  return template.replaceAll("{ticker}", encodeURIComponent(ticker));
}

export function parseRssItems(xml: string, ticker: string): RawEvent[] {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches
    .map((item): RawEvent | null => {
      const title = textFromTag(item, "title");
      const url = textFromTag(item, "link") || textFromTag(item, "guid");
      if (!title || !url) {
        return null;
      }

      const publishedAt = textFromTag(item, "pubDate");
      const sourceName = textFromTag(item, "source") || domainName(url);
      const parsedDate = publishedAt ? new Date(publishedAt) : new Date();

      return {
        title,
        summary: textFromTag(item, "description"),
        url,
        sourceName,
        publishedAt: Number.isNaN(parsedDate.getTime())
          ? new Date().toISOString()
          : parsedDate.toISOString(),
        sourceType: "news" as const,
      };
    })
    .filter((event): event is RawEvent => event !== null)
    .filter((event) => {
      const searchable = `${event.title} ${event.summary ?? ""}`.toUpperCase();
      return searchable.includes(ticker) || itemMatches.length <= 3;
    })
    .slice(0, MAX_NEWS_ITEMS);
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function uniqueDrivers(drivers: EventImpactDriver[]): EventImpactDriver[] {
  return Array.from(new Set(drivers));
}

function classifyEventType(text: string, sourceType: RawEvent["sourceType"], form?: string): CompanyEventType {
  if (sourceType === "filing" || form) {
    return "filing-related";
  }

  if (
    includesAny(text, [
      "lawsuit",
      "court",
      "judge",
      "legal",
      "probe",
      "investigation",
      "antitrust",
      "regulator",
      "regulatory",
      "sec",
      "doj",
      "ftc",
      "eu",
      "fine",
      "ban",
    ])
  ) {
    return "legal-regulatory";
  }

  if (
    includesAny(text, [
      "fed",
      "rates",
      "inflation",
      "tariff",
      "currency",
      "dollar",
      "recession",
      "economy",
      "china",
      "geopolitical",
    ])
  ) {
    return "macro";
  }

  if (
    includesAny(text, [
      "industry",
      "sector",
      "rival",
      "competitor",
      "semiconductor",
      "chip",
      "smartphone market",
      "cloud market",
    ])
  ) {
    return "industry";
  }

  return "company-specific";
}

function classifyDrivers(text: string, eventType: CompanyEventType): EventImpactDriver[] {
  const drivers: EventImpactDriver[] = [];

  if (
    includesAny(text, [
      "sales",
      "revenue",
      "demand",
      "orders",
      "shipments",
      "pricing",
      "price",
      "product",
      "launch",
      "iphone",
      "ipad",
      "mac",
      "services",
      "subscriber",
      "market share",
    ])
  ) {
    drivers.push("revenue");
  }

  if (
    includesAny(text, [
      "margin",
      "cost",
      "component",
      "supply",
      "tariff",
      "pricing",
      "profit",
      "earnings",
      "wage",
      "expense",
    ])
  ) {
    drivers.push("margin");
  }

  if (
    includesAny(text, [
      "cash flow",
      "free cash flow",
      "dividend",
      "buyback",
      "repurchase",
      "cash",
      "working capital",
    ])
  ) {
    drivers.push("cash-flow");
  }

  if (includesAny(text, ["debt", "bond", "leverage", "borrow", "credit", "rating"])) {
    drivers.push("debt");
  }

  if (
    includesAny(text, [
      "capex",
      "capital expenditure",
      "data center",
      "factory",
      "plant",
      "investment",
      "ai infrastructure",
      "manufacturing",
    ])
  ) {
    drivers.push("capex");
  }

  if (
    eventType === "legal-regulatory" ||
    includesAny(text, [
      "valuation",
      "multiple",
      "guidance",
      "forecast",
      "outlook",
      "risk",
      "lawsuit",
      "probe",
      "investigation",
      "antitrust",
    ])
  ) {
    drivers.push("valuation-risk");
  }

  if (!drivers.length && eventType === "filing-related") {
    return ["revenue", "margin", "cash-flow", "debt"];
  }

  return uniqueDrivers(drivers.length ? drivers : ["valuation-risk"]);
}

function classifyImpact(text: string, eventType: CompanyEventType): TrendSignal {
  if (
    includesAny(text, [
      "beats",
      "beat",
      "raises",
      "raised",
      "upgrade",
      "growth",
      "record",
      "approval",
      "wins",
      "partnership",
      "launches",
      "buyback",
      "repurchase",
    ])
  ) {
    return "positive";
  }

  if (
    includesAny(text, [
      "misses",
      "miss",
      "cuts",
      "cut",
      "downgrade",
      "decline",
      "declines",
      "falls",
      "slows",
      "weak",
      "lawsuit",
      "probe",
      "fine",
      "ban",
      "delay",
      "recall",
      "loss",
    ])
  ) {
    return "negative";
  }

  if (
    eventType === "macro" ||
    eventType === "legal-regulatory" ||
    includesAny(text, ["tariff", "pricing", "investment", "capex", "restructuring"])
  ) {
    return "neutral";
  }

  return "unknown";
}

function classifyHorizon(text: string, eventType: CompanyEventType): EventHorizon {
  if (eventType === "filing-related") {
    return "long-term";
  }

  if (
    includesAny(text, [
      "product",
      "launch",
      "pricing",
      "capex",
      "investment",
      "regulatory",
      "antitrust",
      "lawsuit",
      "manufacturing",
      "services",
    ])
  ) {
    return "both";
  }

  if (eventType === "macro" || eventType === "industry") {
    return "short-term";
  }

  return "uncertain";
}

function watchMetricForDrivers(drivers: EventImpactDriver[]): string {
  if (drivers.includes("revenue")) {
    return "revenue-growth";
  }

  if (drivers.includes("margin")) {
    return "gross-margin";
  }

  if (drivers.includes("cash-flow")) {
    return "free-cash-flow";
  }

  if (drivers.includes("debt")) {
    return "debt-and-liabilities";
  }

  if (drivers.includes("capex")) {
    return "capex";
  }

  return "risk-disclosure";
}

function confidenceForEvent(
  sourceType: RawEvent["sourceType"],
  impact: TrendSignal,
  drivers: EventImpactDriver[],
): EventConfidence {
  if (sourceType === "filing") {
    return "High";
  }

  if (impact === "unknown" || drivers.length === 1 && drivers[0] === "valuation-risk") {
    return "Low";
  }

  return "Medium";
}

export function classifyEventImpact(raw: RawEvent, identity: CompanyIdentity): CompanyEventImpact {
  const text = `${raw.title} ${raw.summary ?? ""} ${raw.form ?? ""}`.toLowerCase();
  const eventType = classifyEventType(text, raw.sourceType, raw.form);
  const drivers = classifyDrivers(text, eventType);
  const impact = classifyImpact(text, eventType);
  const horizon = classifyHorizon(text, eventType);
  const confidence = confidenceForEvent(raw.sourceType, impact, drivers);

  return {
    id: stableHash({
      ticker: identity.ticker,
      title: raw.title,
      url: raw.url,
      publishedAt: raw.publishedAt,
    }).slice(0, 16),
    ticker: identity.ticker,
    title: raw.title,
    summary: raw.summary,
    url: raw.url,
    sourceName: raw.sourceName,
    publishedAt: raw.publishedAt,
    eventType,
    drivers,
    impact,
    horizon,
    watchMetric: watchMetricForDrivers(drivers),
    confidence,
  };
}

async function fetchHeadlineEvents(ticker: string): Promise<RawEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(newsFeedUrl(ticker), {
      headers: {
        "User-Agent": getSecUserAgent(),
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    return parseRssItems(await response.text(), ticker);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function filingTitle(filing: FilingSummary, identity: CompanyIdentity): string {
  if (filing.form === "10-K" || filing.form === "10-K/A") {
    return `${identity.name} filed annual report (${filing.form})`;
  }

  if (filing.form === "10-Q" || filing.form === "10-Q/A") {
    return `${identity.name} filed quarterly report (${filing.form})`;
  }

  if (filing.form === "8-K" || filing.form === "8-K/A") {
    return `${identity.name} filed current report (${filing.form})`;
  }

  return `${identity.name} filed ${filing.form}`;
}

function filingSummary(filing: FilingSummary): string {
  const reportDate = filing.reportDate ? ` Report date: ${filing.reportDate}.` : "";
  return `SEC filing event.${reportDate}`;
}

function filingEvents(identity: CompanyIdentity, filings: FilingSummary[]): RawEvent[] {
  return filings
    .filter((filing) => EVENT_FILING_FORMS.has(filing.form))
    .filter((filing) => Boolean(filing.url))
    .slice(0, MAX_FILING_ITEMS)
    .map((filing) => ({
      title: filingTitle(filing, identity),
      summary: filingSummary(filing),
      url: filing.url as string,
      sourceName: "SEC EDGAR",
      publishedAt: new Date(`${filing.filingDate}T00:00:00.000Z`).toISOString(),
      sourceType: "filing" as const,
      form: filing.form,
    }));
}

function dedupeEvents(events: RawEvent[]): RawEvent[] {
  const seen = new Set<string>();
  const deduped: RawEvent[] = [];

  for (const event of events) {
    const key = `${event.title.toLowerCase()}|${event.url}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

export async function getCompanyEventImpacts(ticker: string): Promise<{
  identity: CompanyIdentity;
  events: CompanyEventImpact[];
  generatedAt: string;
}> {
  const normalized = normalizeTicker(ticker);
  const identity = await findCompanyByTicker(normalized);

  if (!identity) {
    throw new Error(`Unknown ticker: ${normalized}`);
  }

  const cache = cacheKey(["events", normalized, "v1"]);
  const cached = await getJsonCache<{
    identity: CompanyIdentity;
    events: CompanyEventImpact[];
    generatedAt: string;
  }>(cache);
  if (cached) {
    return cached;
  }

  const [headlineEvents, submissions] = await Promise.all([
    fetchHeadlineEvents(normalized),
    getSubmissions(identity.cik),
  ]);
  const filingRawEvents = filingEvents(identity, extractRecentFilings(submissions, 20));
  const rawEvents = dedupeEvents([...headlineEvents, ...filingRawEvents])
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, MAX_NEWS_ITEMS);

  const result = {
    identity,
    events: rawEvents.map((event) => classifyEventImpact(event, identity)),
    generatedAt: new Date().toISOString(),
  };

  await setJsonCache(cache, result, EVENTS_CACHE_TTL_SECONDS);
  return result;
}
