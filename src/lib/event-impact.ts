import { cacheKey, getJsonCache, setJsonCache, stableHash } from "@/lib/cache";
import { getOpenAiModel, getSecUserAgent } from "@/lib/env";
import {
  computeEventImpactPromptHash,
  eventBatchUsageId,
  getStoredEventImpact,
  mergeStoredEventImpact,
  persistEventImpact,
  updateCompanyEventCuration,
  upsertCompanyEvents,
  type StoredCompanyEvent,
} from "@/lib/event-store";
import {
  DEFAULT_LOCALE,
  getDictionary,
  type Locale,
} from "@/lib/i18n";
import {
  findCompanyIdByTicker,
  persistCompanyIdentities,
  recordAiUsageEvent,
} from "@/lib/research-store";
import {
  extractRecentFilings,
  findCompanyByTicker,
  getSubmissions,
} from "@/lib/sec";
import type {
  CompanyEventImpact,
  CompanyEventType,
  CompanyIdentity,
  EventAnalysisMode,
  EventConfidence,
  EventHorizon,
  EventImpactDriver,
  EventVisibility,
  FilingSummary,
  RawCompanyEvent,
  TrendSignal,
} from "@/lib/types";

const PROVIDER_CACHE_TTL_SECONDS = 30 * 60;
const RSS_FETCH_TIMEOUT_MS = 8_000;
const MAX_NEWS_ITEMS = 6;
const MAX_FILING_ITEMS = 4;
const MAX_EVENT_ITEMS = 8;
const DEFAULT_NEWS_RSS_TEMPLATE =
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US";
const DETERMINISTIC_EVENT_MODEL = "deterministic";
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

export type RawEvent = RawCompanyEvent;

type EventImpactGenerationUsage = {
  model: string;
  status: "success" | "fallback";
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
};

type GeneratedEventImpacts = {
  events: CompanyEventImpact[];
  impactIds: string[];
  usage: EventImpactGenerationUsage;
};

type EventImpactOptions = {
  ownerUserId?: string;
  includeHidden?: boolean;
};

type ProviderName = "rss";

interface EventProvider {
  id: ProviderName;
  fetch(identity: CompanyIdentity): Promise<RawCompanyEvent[]>;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export function normalizeNewsProviderName(value = process.env.NEWS_PROVIDER): ProviderName {
  const normalized = value?.trim().toLowerCase();
  return normalized === "rss" || !normalized ? "rss" : "rss";
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

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function companySearchTerms(identity: CompanyIdentity): string[] {
  const legalName = identity.name.trim();
  const simpleName = legalName
    .replace(
      /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|class|ordinary shares|common stock)\b\.?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const firstWords = simpleName.split(/\s+/).slice(0, 2).join(" ");

  return Array.from(
    new Set(
      [
        identity.ticker,
        legalName,
        simpleName,
        firstWords,
      ]
        .map(normalizeSearchText)
        .filter((term) => term.length >= 3),
    ),
  );
}

function searchTermsFromInput(tickerOrTerms: string | string[]): string[] {
  const terms = Array.isArray(tickerOrTerms) ? tickerOrTerms : [tickerOrTerms];
  return terms.map(normalizeSearchText).filter((term) => term.length >= 2);
}

function eventMatchesTerms(event: Pick<RawCompanyEvent, "title" | "summary">, terms: string[]) {
  const searchable = ` ${normalizeSearchText(`${event.title} ${event.summary ?? ""}`)} `;
  return terms.some((term) => searchable.includes(` ${term} `));
}

export function parseRssItems(
  xml: string,
  tickerOrTerms: string | string[],
): RawCompanyEvent[] {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const terms = searchTermsFromInput(tickerOrTerms);

  return itemMatches
    .map((item): RawCompanyEvent | null => {
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
        sourceType: "news",
        provider: "rss",
      };
    })
    .filter((event): event is RawCompanyEvent => event !== null)
    .filter((event) => eventMatchesTerms(event, terms) || itemMatches.length <= 3)
    .slice(0, MAX_NEWS_ITEMS);
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function uniqueDrivers(drivers: EventImpactDriver[]): EventImpactDriver[] {
  return Array.from(new Set(drivers));
}

function classifyEventType(
  text: string,
  sourceType: RawCompanyEvent["sourceType"],
  form?: string,
): CompanyEventType {
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
  sourceType: RawCompanyEvent["sourceType"],
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

function localizedEventText(input: {
  impact: TrendSignal;
  drivers: EventImpactDriver[];
  horizon: EventHorizon;
  watchMetric: string;
  confidence: EventConfidence;
  locale: Locale;
}) {
  const t = getDictionary(input.locale);
  const impact = t.events.impactLabels[input.impact];
  const horizon = t.events.horizonLabels[input.horizon];
  const watchMetric = recordValue(t.events.watchMetrics, input.watchMetric, input.watchMetric);
  const drivers = input.drivers
    .map((driver) => recordValue(t.events.driverLabels, driver, driver))
    .join(", ");
  const confidence = t.events.confidenceLabels[input.confidence];

  return {
    impactSummary: t.events.impactSummary(impact, drivers, watchMetric, confidence),
    investorMeaning: t.events.investorMeaning(impact, drivers, horizon),
  };
}

function recordValue<T extends Record<string, string>>(
  record: T,
  key: string,
  fallback: string,
): string {
  return record[key as keyof T] ?? fallback;
}

export function classifyEventImpact(
  raw: RawCompanyEvent,
  identity: CompanyIdentity,
  locale: Locale = DEFAULT_LOCALE,
  visibility: EventVisibility = "public",
  analysisMode: EventAnalysisMode = "deterministic",
): CompanyEventImpact {
  const text = `${raw.title} ${raw.summary ?? ""} ${raw.form ?? ""}`.toLowerCase();
  const eventType = classifyEventType(text, raw.sourceType, raw.form);
  const drivers = classifyDrivers(text, eventType);
  const impact = classifyImpact(text, eventType);
  const horizon = classifyHorizon(text, eventType);
  const confidence = confidenceForEvent(raw.sourceType, impact, drivers);
  const watchMetric = watchMetricForDrivers(drivers);
  const localizedText = localizedEventText({
    impact,
    drivers,
    horizon,
    watchMetric,
    confidence,
    locale,
  });

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
    sourceType: raw.sourceType,
    provider: raw.provider,
    publishedAt: raw.publishedAt,
    eventType,
    drivers,
    impact,
    horizon,
    watchMetric,
    confidence,
    impactSummary: localizedText.impactSummary,
    investorMeaning: localizedText.investorMeaning,
    analysisMode,
    visibility,
    generatedAt: new Date().toISOString(),
  };
}

async function fetchRssProviderEvents(identity: CompanyIdentity): Promise<RawCompanyEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(newsFeedUrl(identity.ticker), {
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

    return parseRssItems(await response.text(), companySearchTerms(identity));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function configuredNewsProvider(): EventProvider {
  return {
    id: normalizeNewsProviderName(),
    fetch: fetchRssProviderEvents,
  };
}

async function fetchHeadlineEvents(identity: CompanyIdentity): Promise<RawCompanyEvent[]> {
  const provider = configuredNewsProvider();
  const key = cacheKey(["events", "provider", provider.id, identity.ticker, "v2"]);
  const cached = await getJsonCache<RawCompanyEvent[]>(key);
  if (cached) {
    return cached;
  }

  const events = await provider.fetch(identity);
  await setJsonCache(key, events, PROVIDER_CACHE_TTL_SECONDS);
  return events;
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

function filingEvents(identity: CompanyIdentity, filings: FilingSummary[]): RawCompanyEvent[] {
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
      provider: "sec",
      form: filing.form,
    }));
}

function dedupeEvents(events: RawCompanyEvent[]): RawCompanyEvent[] {
  const seen = new Set<string>();
  const deduped: RawCompanyEvent[] = [];

  for (const event of events) {
    const key = event.url
      ? event.url.trim().toLowerCase()
      : `${event.title.toLowerCase()}|${event.publishedAt}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

async function resolveIdentity(ticker: string) {
  const normalized = normalizeTicker(ticker);
  const identity = await findCompanyByTicker(normalized);

  if (!identity) {
    throw new Error(`Unknown ticker: ${normalized}`);
  }

  return identity;
}

async function fetchAndStoreEvents(identity: CompanyIdentity) {
  const [headlineEvents, submissions] = await Promise.all([
    fetchHeadlineEvents(identity),
    getSubmissions(identity.cik),
  ]);
  const filingRawEvents = filingEvents(identity, extractRecentFilings(submissions, 20));
  const rawEvents = dedupeEvents([...headlineEvents, ...filingRawEvents])
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, MAX_EVENT_ITEMS);

  return upsertCompanyEvents(identity, rawEvents);
}

function deterministicPromptHash(
  event: StoredCompanyEvent,
  locale: Locale,
): string {
  return computeEventImpactPromptHash({
    event: event.event,
    sourceFingerprint: event.sourceFingerprint,
    locale,
    model: DETERMINISTIC_EVENT_MODEL,
    analysisMode: "deterministic",
  });
}

function aiPromptHash(event: StoredCompanyEvent, locale: Locale): string {
  return computeEventImpactPromptHash({
    event: event.event,
    sourceFingerprint: event.sourceFingerprint,
    locale,
    model: getOpenAiModel(),
    analysisMode: "ai",
  });
}

async function persistedDeterministicImpact(
  identity: CompanyIdentity,
  event: StoredCompanyEvent,
  locale: Locale,
) {
  const promptHash = deterministicPromptHash(event, locale);
  const existing = await getStoredEventImpact(
    event,
    locale,
    DETERMINISTIC_EVENT_MODEL,
    promptHash,
    { visibility: "public" },
  );
  if (existing) {
    return existing;
  }

  const impact = classifyEventImpact(event.event, identity, locale, "public", "deterministic");
  return persistEventImpact(
    event,
    impact,
    locale,
    DETERMINISTIC_EVENT_MODEL,
    promptHash,
    { visibility: "public" },
  );
}

async function bestImpactForEvent(
  identity: CompanyIdentity,
  event: StoredCompanyEvent,
  locale: Locale,
  options: EventImpactOptions = {},
): Promise<CompanyEventImpact> {
  const privateImpact = options.ownerUserId
    ? await getStoredEventImpact(
        event,
        locale,
        getOpenAiModel(),
        aiPromptHash(event, locale),
        { visibility: "private", ownerUserId: options.ownerUserId },
      )
    : null;
  if (privateImpact) {
    return mergeStoredEventImpact(identity, event, privateImpact);
  }

  const publicAiImpact = await getStoredEventImpact(
    event,
    locale,
    getOpenAiModel(),
    aiPromptHash(event, locale),
    { visibility: "public" },
  );
  if (publicAiImpact) {
    return mergeStoredEventImpact(identity, event, publicAiImpact);
  }

  const deterministic = await persistedDeterministicImpact(identity, event, locale);
  return mergeStoredEventImpact(identity, event, deterministic);
}

function sortImpacts(events: CompanyEventImpact[]): CompanyEventImpact[] {
  return events.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) {
      return a.isFeatured ? -1 : 1;
    }

    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export async function getCompanyEventImpacts(
  ticker: string,
  locale: Locale = DEFAULT_LOCALE,
  options: EventImpactOptions = {},
): Promise<{
  identity: CompanyIdentity;
  events: CompanyEventImpact[];
  generatedAt: string;
}> {
  const identity = await resolveIdentity(ticker);
  const storedEvents = await fetchAndStoreEvents(identity);
  const visibleEvents = options.includeHidden
    ? storedEvents
    : storedEvents.filter((event) => !event.isHidden);
  const events = await Promise.all(
    visibleEvents.map((event) => bestImpactForEvent(identity, event, locale, options)),
  );

  return {
    identity,
    events: sortImpacts(events),
    generatedAt: new Date().toISOString(),
  };
}

function extractOutputText(responseJson: unknown): string | null {
  if (!responseJson || typeof responseJson !== "object") {
    return null;
  }

  const outputText = (responseJson as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") {
    return outputText;
  }

  const output = (responseJson as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
    }
  }

  return null;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function extractTokenUsage(responseJson: unknown) {
  if (!responseJson || typeof responseJson !== "object") {
    return {};
  }

  const usage = (responseJson as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") {
    return {};
  }

  const inputTokens = numberField((usage as { input_tokens?: unknown }).input_tokens);
  const outputTokens = numberField((usage as { output_tokens?: unknown }).output_tokens);
  const totalTokens =
    numberField((usage as { total_tokens?: unknown }).total_tokens) ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);

  return { inputTokens, outputTokens, totalTokens };
}

function coerceDrivers(value: unknown): EventImpactDriver[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const allowed = new Set<EventImpactDriver>([
    "revenue",
    "margin",
    "cash-flow",
    "debt",
    "capex",
    "valuation-risk",
  ]);
  const drivers = value
    .filter((driver): driver is EventImpactDriver => allowed.has(driver))
    .slice(0, 6);
  return drivers.length ? drivers : null;
}

function coerceAiImpact(
  value: unknown,
  fallback: CompanyEventImpact,
  visibility: EventVisibility,
): CompanyEventImpact {
  if (!value || typeof value !== "object") {
    return { ...fallback, visibility, analysisMode: "ai" };
  }

  const raw = value as Record<string, unknown>;
  const drivers = coerceDrivers(raw.drivers) ?? fallback.drivers;
  const impact =
    raw.impact === "positive" ||
    raw.impact === "negative" ||
    raw.impact === "neutral" ||
    raw.impact === "unknown"
      ? raw.impact
      : fallback.impact;
  const horizon =
    raw.horizon === "short-term" ||
    raw.horizon === "long-term" ||
    raw.horizon === "both" ||
    raw.horizon === "uncertain"
      ? raw.horizon
      : fallback.horizon;
  const confidence =
    raw.confidence === "High" || raw.confidence === "Medium" || raw.confidence === "Low"
      ? raw.confidence
      : fallback.confidence;

  return {
    ...fallback,
    eventType:
      raw.eventType === "industry" ||
      raw.eventType === "macro" ||
      raw.eventType === "legal-regulatory" ||
      raw.eventType === "filing-related" ||
      raw.eventType === "company-specific"
        ? raw.eventType
        : fallback.eventType,
    drivers,
    impact,
    horizon,
    watchMetric: typeof raw.watchMetric === "string" ? raw.watchMetric : fallback.watchMetric,
    confidence,
    impactSummary:
      typeof raw.impactSummary === "string" && raw.impactSummary.trim()
        ? raw.impactSummary
        : fallback.impactSummary,
    investorMeaning:
      typeof raw.investorMeaning === "string" && raw.investorMeaning.trim()
        ? raw.investorMeaning
        : fallback.investorMeaning,
    analysisMode: "ai",
    visibility,
    generatedAt: new Date().toISOString(),
  };
}

async function generateAiEventImpacts(
  identity: CompanyIdentity,
  events: StoredCompanyEvent[],
  locale: Locale,
  visibility: EventVisibility,
): Promise<{
  events: CompanyEventImpact[];
  usage: EventImpactGenerationUsage;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = getOpenAiModel();
  const deterministic = events.map((event) =>
    classifyEventImpact(event.event, identity, locale, visibility, "deterministic"),
  );

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const t = getDictionary(locale);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: JSON.stringify(
        {
          instruction: t.events.aiInstruction,
          locale,
          company: identity,
          events: events.map((event, index) => ({
            eventId: event.eventId,
            title: event.event.title,
            summary: event.event.summary,
            sourceName: event.event.sourceName,
            sourceType: event.event.sourceType,
            provider: event.event.provider,
            form: event.event.form,
            publishedAt: event.event.publishedAt,
            deterministicBaseline: {
              eventType: deterministic[index].eventType,
              drivers: deterministic[index].drivers,
              impact: deterministic[index].impact,
              horizon: deterministic[index].horizon,
              watchMetric: deterministic[index].watchMetric,
              confidence: deterministic[index].confidence,
            },
          })),
        },
        null,
        2,
      ),
      text: {
        format: {
          type: "json_schema",
          name: "finari_event_impacts",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              events: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    eventId: { type: "string" },
                    eventType: {
                      type: "string",
                      enum: [
                        "company-specific",
                        "industry",
                        "macro",
                        "legal-regulatory",
                        "filing-related",
                      ],
                    },
                    drivers: {
                      type: "array",
                      minItems: 1,
                      maxItems: 6,
                      items: {
                        type: "string",
                        enum: [
                          "revenue",
                          "margin",
                          "cash-flow",
                          "debt",
                          "capex",
                          "valuation-risk",
                        ],
                      },
                    },
                    impact: {
                      type: "string",
                      enum: ["positive", "neutral", "negative", "unknown"],
                    },
                    horizon: {
                      type: "string",
                      enum: ["short-term", "long-term", "both", "uncertain"],
                    },
                    watchMetric: { type: "string" },
                    confidence: {
                      type: "string",
                      enum: ["High", "Medium", "Low"],
                    },
                    impactSummary: { type: "string" },
                    investorMeaning: { type: "string" },
                  },
                  required: [
                    "eventId",
                    "eventType",
                    "drivers",
                    "impact",
                    "horizon",
                    "watchMetric",
                    "confidence",
                    "impactSummary",
                    "investorMeaning",
                  ],
                },
              },
            },
            required: ["events"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI event impact request failed (${response.status})`);
  }

  const json = (await response.json()) as unknown;
  const text = extractOutputText(json);
  if (!text) {
    throw new Error("OpenAI event impact response did not include output text");
  }

  const parsed = JSON.parse(text) as { events?: unknown };
  const aiEvents = Array.isArray(parsed.events) ? parsed.events : [];
  const byEventId = new Map<string, unknown>();
  for (const event of aiEvents) {
    if (event && typeof event === "object" && typeof (event as { eventId?: unknown }).eventId === "string") {
      byEventId.set((event as { eventId: string }).eventId, event);
    }
  }

  return {
    events: events.map((event, index) =>
      coerceAiImpact(byEventId.get(event.eventId), deterministic[index], visibility),
    ),
    usage: {
      model,
      status: "success",
      requestId: response.headers.get("x-request-id") ?? undefined,
      ...extractTokenUsage(json),
    },
  };
}

async function generateAndPersistAiImpacts(input: {
  identity: CompanyIdentity;
  storedEvents: StoredCompanyEvent[];
  locale: Locale;
  visibility: EventVisibility;
  ownerUserId?: string;
  publishedByUserId?: string;
  purpose: "private_event_impact" | "admin_public_event_impact";
}): Promise<GeneratedEventImpacts> {
  const model = getOpenAiModel();
  let generated: { events: CompanyEventImpact[]; usage: EventImpactGenerationUsage };

  try {
    generated = await generateAiEventImpacts(
      input.identity,
      input.storedEvents,
      input.locale,
      input.visibility,
    );
  } catch (error) {
    generated = {
      events: input.storedEvents.map((event) =>
        classifyEventImpact(
          event.event,
          input.identity,
          input.locale,
          input.visibility,
          "deterministic",
        ),
      ),
      usage: {
        model,
        status: "fallback",
        errorMessage:
          error instanceof Error
            ? error.message
            : "OpenAI event impact request failed",
      },
    };
  }

  const storedImpacts = await Promise.all(
    generated.events.map((impact, index) => {
      const storedEvent = input.storedEvents[index];
      const analysisMode = generated.usage.status === "success" ? "ai" : "deterministic";
      const impactToStore: CompanyEventImpact = {
        ...impact,
        analysisMode,
        visibility: input.visibility,
      };
      const promptHash =
        analysisMode === "ai"
          ? aiPromptHash(storedEvent, input.locale)
          : deterministicPromptHash(storedEvent, input.locale);
      return persistEventImpact(
        storedEvent,
        impactToStore,
        input.locale,
        analysisMode === "ai" ? model : DETERMINISTIC_EVENT_MODEL,
        promptHash,
        {
          visibility: input.visibility,
          ownerUserId: input.ownerUserId,
          publishedByUserId: input.publishedByUserId,
        },
      );
    }),
  );

  await recordAiUsageEvent({
    userId: input.ownerUserId ?? input.publishedByUserId ?? null,
    companyId: input.storedEvents[0]?.companyId ?? stableHash(input.identity.cik),
    eventImpactId: storedImpacts[0]?.impactId,
    model,
    requestId: generated.usage.requestId,
    promptHash: eventBatchUsageId(input.storedEvents),
    locale: input.locale,
    purpose: input.purpose,
    status: generated.usage.status,
    inputTokens: generated.usage.inputTokens,
    outputTokens: generated.usage.outputTokens,
    totalTokens: generated.usage.totalTokens,
    errorMessage: generated.usage.errorMessage,
  });

  return {
    events: input.storedEvents.map((event, index) =>
      mergeStoredEventImpact(input.identity, event, storedImpacts[index]),
    ),
    impactIds: storedImpacts.map((impact) => impact.impactId),
    usage: generated.usage,
  };
}

async function visibleStoredEvents(identity: CompanyIdentity, includeHidden = false) {
  const storedEvents = await fetchAndStoreEvents(identity);
  return includeHidden ? storedEvents : storedEvents.filter((event) => !event.isHidden);
}

export async function getPrivateCompanyEventAnalysisForTicker(
  userId: string,
  ticker: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{
  identity: CompanyIdentity;
  events: CompanyEventImpact[];
  generatedAt: string;
}> {
  const identity = await resolveIdentity(ticker);
  const storedEvents = await visibleStoredEvents(identity);
  const missingEvents: StoredCompanyEvent[] = [];
  const resolvedEvents: CompanyEventImpact[] = [];

  for (const event of storedEvents) {
    const existing = await getStoredEventImpact(
      event,
      locale,
      getOpenAiModel(),
      aiPromptHash(event, locale),
      { visibility: "private", ownerUserId: userId },
    );

    if (existing) {
      resolvedEvents.push(mergeStoredEventImpact(identity, event, existing));
    } else {
      missingEvents.push(event);
    }
  }

  if (missingEvents.length > 0) {
    const generated = await generateAndPersistAiImpacts({
      identity,
      storedEvents: missingEvents,
      locale,
      visibility: "private",
      ownerUserId: userId,
      purpose: "private_event_impact",
    });
    resolvedEvents.push(...generated.events);
  }

  return {
    identity,
    events: sortImpacts(resolvedEvents),
    generatedAt: new Date().toISOString(),
  };
}

export async function publishPublicEventImpactsForTicker(
  adminUserId: string,
  ticker: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{
  identity: CompanyIdentity;
  events: CompanyEventImpact[];
  generatedAt: string;
}> {
  const identity = await resolveIdentity(ticker);
  const storedEvents = await visibleStoredEvents(identity);
  const generated = await generateAndPersistAiImpacts({
    identity,
    storedEvents,
    locale,
    visibility: "public",
    publishedByUserId: adminUserId,
    purpose: "admin_public_event_impact",
  });

  return {
    identity,
    events: sortImpacts(generated.events),
    generatedAt: new Date().toISOString(),
  };
}

export async function curateCompanyEventForTicker(input: {
  ticker: string;
  eventId: string;
  adminUserId: string;
  action: "feature" | "unfeature" | "hide" | "unhide";
}) {
  const identity = await resolveIdentity(input.ticker);
  await persistCompanyIdentities([identity]);
  const companyId =
    (await findCompanyIdByTicker(identity.ticker)) ??
    stableHash({ cik: identity.cik, ticker: identity.ticker });
  const updated = await updateCompanyEventCuration({
    eventId: input.eventId,
    companyId,
    adminUserId: input.adminUserId,
    action: input.action,
  });

  if (!updated) {
    throw new Error("Unknown event");
  }
}
