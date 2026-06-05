import { getOpenAiModel } from "@/lib/env";
import { compactCurrency, formatMetricValue } from "@/lib/format";
import { summarizeMetricSignal } from "@/lib/financial-analysis";
import {
  DEFAULT_LOCALE,
  getDictionary,
  translateCaveat,
  type Locale,
} from "@/lib/i18n";
import type {
  CompanyEventImpact,
  CompanySnapshot,
  MemoSection,
  ResearchMemo,
  TrendSignal,
} from "@/lib/types";

export type AiGenerationUsage = {
  model: string;
  status: "success" | "fallback";
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
};

export type GeneratedResearchMemo = {
  memo: ResearchMemo;
  usage: AiGenerationUsage;
};

function sentenceForSignal(signal: TrendSignal, locale: Locale): string {
  const t = getDictionary(locale);

  if (signal === "positive") {
    return t.memo.signal.positive;
  }

  if (signal === "negative") {
    return t.memo.signal.negative;
  }

  if (signal === "neutral") {
    return t.memo.signal.neutral;
  }

  return t.memo.signal.unknown;
}

function recordValue<T extends Record<string, string>>(
  record: T,
  key: string,
  fallback: string,
): string {
  return record[key as keyof T] ?? fallback;
}

function periodLabel(snapshot: CompanySnapshot, locale: Locale): string {
  const t = getDictionary(locale);
  const period = snapshot.ttmPeriod ?? snapshot.quarterlyPeriods[0];

  if (!period) {
    return t.advisor.latestPeriod;
  }

  if (period.periodType === "ttm") {
    return t.analysis.ttm;
  }

  if (period.periodType === "quarterly" && period.fiscalPeriod) {
    return `${period.fiscalYear} ${period.fiscalPeriod}`;
  }

  return `${t.snapshot.fiscalYear} ${period.fiscalYear}`;
}

function fallbackSections(
  snapshot: CompanySnapshot,
  locale: Locale,
  eventImpacts: CompanyEventImpact[] = [],
): MemoSection[] {
  const t = getDictionary(locale);
  const latest = snapshot.periods[0];
  const latestRollingPeriod = snapshot.ttmPeriod ?? snapshot.quarterlyPeriods[0];
  const prior = snapshot.periods[1];
  const signal = summarizeMetricSignal(snapshot.metrics);
  const metricHighlights = snapshot.metrics
    .slice(0, 6)
    .map((metric) => {
      const metricText = t.metrics[metric.id as keyof typeof t.metrics];
      return `${metricText?.label ?? metric.label}: ${formatMetricValue(
        metric.value,
        metric.unit,
      )}`;
    })
    .join("; ");
  const translatedCaveats = snapshot.caveats
    .map((caveat) => translateCaveat(caveat, locale))
    .join(" ");

  const sections: MemoSection[] = [
    {
      title: t.memo.sections.institutionalRead,
      signal,
      body: t.memo.fallback.intro(
        snapshot.identity.name,
        snapshot.identity.ticker,
        sentenceForSignal(signal, locale),
      ),
    },
    {
      title: t.memo.sections.decisionScreen,
      signal: snapshot.decisionFramework.signal,
      body: t.memo.fallback.decision(
        recordValue(
          t.decision.takeaways,
          snapshot.decisionFramework.takeaway,
          snapshot.decisionFramework.takeaway,
        ),
        recordValue(
          t.decision.evidence,
          snapshot.decisionFramework.strongestEvidence,
          snapshot.decisionFramework.strongestEvidence,
        ),
        recordValue(
          t.decision.risks,
          snapshot.decisionFramework.mainRisk,
          snapshot.decisionFramework.mainRisk,
        ),
        snapshot.decisionFramework.watchMetric,
      ),
    },
    {
      title: t.memo.sections.trajectory,
      signal:
        latest?.revenue && prior?.revenue && latest.revenue > prior.revenue
          ? "positive"
          : "neutral",
      body: latest
        ? t.memo.fallback.trajectory(
            compactCurrency(latest.revenue),
            compactCurrency(latest.netIncome),
            latest.fiscalYear,
            metricHighlights || t.memo.fallback.metricsUnavailable,
          )
        : t.memo.fallback.trajectoryUnavailable,
    },
    {
      title: t.memo.sections.quarterlyTtm,
      signal: latestRollingPeriod ? "neutral" : "unknown",
      body: latestRollingPeriod
        ? t.memo.fallback.quarterly(
            periodLabel(snapshot, locale),
            compactCurrency(latestRollingPeriod.revenue),
            compactCurrency(latestRollingPeriod.netIncome),
            compactCurrency(latestRollingPeriod.freeCashFlow),
          )
        : t.memo.fallback.quarterlyUnavailable,
    },
    {
      title: t.memo.sections.balanceSheet,
      signal:
        latest?.freeCashFlow && latest.freeCashFlow > 0 ? "positive" : "neutral",
      body: latest
        ? t.memo.fallback.balanceSheet(
            compactCurrency(latest.assets),
            compactCurrency(latest.liabilities),
            compactCurrency(latest.cash),
            compactCurrency(latest.freeCashFlow),
          )
        : t.memo.fallback.balanceSheetUnavailable,
    },
    {
      title: t.memo.sections.peerAndConfidence,
      signal: snapshot.dataQuality.signal,
      body: t.memo.fallback.peerDataQuality(
        snapshot.peerComparison.peerCount,
        t.analysis.confidenceLabels[snapshot.dataQuality.label],
      ),
    },
  ];

  if (eventImpacts.length > 0) {
    const topEvents = eventImpacts
      .slice(0, 3)
      .map((event) => `${event.title}: ${event.investorMeaning}`)
      .join(" ");
    sections.push({
      title: t.memo.sections.eventImpact,
      signal: eventImpacts.some((event) => event.impact === "negative")
        ? "negative"
        : eventImpacts.some((event) => event.impact === "positive")
          ? "positive"
          : "neutral",
      body: t.memo.fallback.eventImpact(topEvents),
    });
  }

  sections.push({
      title: t.memo.sections.riskQuestions,
      signal: snapshot.caveats.length ? "negative" : "neutral",
      body:
        snapshot.caveats.length > 0
          ? t.memo.fallback.reviewCaveats(translatedCaveats)
          : t.memo.fallback.defaultQuestions,
    });

  return sections;
}

function eventCitations(eventImpacts: CompanyEventImpact[]) {
  return eventImpacts.slice(0, 6).map((event) => ({
    label: event.sourceName ? `${event.sourceName}: ${event.title}` : event.title,
    url: event.url,
  }));
}

function buildPrompt(
  snapshot: CompanySnapshot,
  locale: Locale,
  eventImpacts: CompanyEventImpact[] = [],
): string {
  const t = getDictionary(locale);
  const latest = snapshot.periods[0];
  const periods = snapshot.periods.map((period) => ({
    periodType: period.periodType,
    fiscalYear: period.fiscalYear,
    fiscalPeriod: period.fiscalPeriod,
    periodStartDate: period.startDate,
    periodEndDate: period.endDate,
    revenue: period.revenue,
    grossProfit: period.grossProfit,
    operatingIncome: period.operatingIncome,
    netIncome: period.netIncome,
    assets: period.assets,
    liabilities: period.liabilities,
    equity: period.equity,
    cash: period.cash,
    debt: period.debt,
    operatingCashFlow: period.operatingCashFlow,
    capitalExpenditure: period.capitalExpenditure,
    freeCashFlow: period.freeCashFlow,
    epsDiluted: period.epsDiluted,
  }));
  const quarterlyPeriods = snapshot.quarterlyPeriods.slice(0, 8).map((period) => ({
    periodType: period.periodType,
    fiscalYear: period.fiscalYear,
    fiscalPeriod: period.fiscalPeriod,
    periodStartDate: period.startDate,
    periodEndDate: period.endDate,
    revenue: period.revenue,
    grossProfit: period.grossProfit,
    operatingIncome: period.operatingIncome,
    netIncome: period.netIncome,
    assets: period.assets,
    liabilities: period.liabilities,
    currentAssets: period.currentAssets,
    currentLiabilities: period.currentLiabilities,
    workingCapital: period.workingCapital,
    cash: period.cash,
    debt: period.debt,
    operatingCashFlow: period.operatingCashFlow,
    capitalExpenditure: period.capitalExpenditure,
    freeCashFlow: period.freeCashFlow,
    researchAndDevelopment: period.researchAndDevelopment,
    sellingGeneralAdministrative: period.sellingGeneralAdministrative,
    buybacks: period.buybacks,
    dividends: period.dividends,
  }));

  return JSON.stringify(
    {
      instruction: t.memo.aiInstruction,
      locale,
      company: snapshot.identity,
      latestFiscalYear: latest?.fiscalYear,
      periods,
      quarterlyPeriods,
      ttmPeriod: snapshot.ttmPeriod,
      metrics: snapshot.metrics,
      changeAnalysis: snapshot.changeAnalysis,
      businessDrivers: snapshot.businessDrivers,
      balanceSheetAnalysis: snapshot.balanceSheetAnalysis,
      peerComparison: snapshot.peerComparison,
      dataQuality: snapshot.dataQuality,
      decisionFramework: snapshot.decisionFramework,
      eventImpacts: eventImpacts.slice(0, 6).map((event) => ({
        title: event.title,
        summary: event.summary,
        sourceName: event.sourceName,
        sourceType: event.sourceType,
        provider: event.provider,
        publishedAt: event.publishedAt,
        eventType: event.eventType,
        drivers: event.drivers,
        impact: event.impact,
        horizon: event.horizon,
        watchMetric: event.watchMetric,
        confidence: event.confidence,
        impactSummary: event.impactSummary,
        investorMeaning: event.investorMeaning,
        analysisMode: event.analysisMode,
        visibility: event.visibility,
      })),
      caveatChangeAnalysis: snapshot.caveatChangeAnalysis,
      caveats: snapshot.caveats,
      citations: [...snapshot.citations, ...eventCitations(eventImpacts)],
    },
    null,
    2,
  );
}

function coerceSections(value: unknown): MemoSection[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rawSections: Array<MemoSection | null> = value.map((section) => {
      if (
        !section ||
        typeof section !== "object" ||
        !("title" in section) ||
        !("body" in section)
      ) {
        return null;
      }

      const rawSignal =
        "signal" in section && typeof section.signal === "string"
          ? section.signal
          : "neutral";
      const signal: TrendSignal =
        rawSignal === "positive" ||
        rawSignal === "neutral" ||
        rawSignal === "negative" ||
        rawSignal === "unknown"
          ? rawSignal
          : "neutral";

      return {
        title: String(section.title),
        body: String(section.body),
        signal,
      };
    });

  const sections = rawSections.filter(
    (section): section is MemoSection => section !== null,
  );

  return sections.length ? sections : null;
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

async function generateAiSections(
  snapshot: CompanySnapshot,
  locale: Locale,
  eventImpacts: CompanyEventImpact[] = [],
): Promise<{
  sections: MemoSection[];
  usage: Omit<AiGenerationUsage, "model" | "status" | "errorMessage">;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      input: buildPrompt(snapshot, locale, eventImpacts),
      text: {
        format: {
          type: "json_schema",
          name: "finari_research_memo",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              sections: {
                type: "array",
                minItems: 4,
                maxItems: 7,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" },
                    signal: {
                      type: "string",
                      enum: ["positive", "neutral", "negative", "unknown"],
                    },
                  },
                  required: ["title", "body", "signal"],
                },
              },
            },
            required: ["sections"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI memo request failed (${response.status})`);
  }

  const json = (await response.json()) as unknown;
  const text = extractOutputText(json);

  if (!text) {
    throw new Error("OpenAI memo response did not include output text");
  }

  const parsed = JSON.parse(text) as { sections?: unknown };
  const sections = coerceSections(parsed.sections);

  if (!sections) {
    throw new Error("OpenAI memo response did not match expected sections");
  }

  return {
    sections,
    usage: {
      requestId: response.headers.get("x-request-id") ?? undefined,
      ...extractTokenUsage(json),
    },
  };
}

export function generateFallbackResearchMemo(
  snapshot: CompanySnapshot,
  locale: Locale = DEFAULT_LOCALE,
  visibility: "public" | "private" = "public",
  eventImpacts: CompanyEventImpact[] = [],
): ResearchMemo {
  const t = getDictionary(locale);

  return {
    company: snapshot.identity,
    generatedAt: new Date().toISOString(),
    mode: "fallback",
    visibility,
    disclaimer: t.memo.disclaimer,
    sections: fallbackSections(snapshot, locale, eventImpacts),
    citations: [...snapshot.citations, ...eventCitations(eventImpacts)],
  };
}

export async function generateResearchMemoWithUsage(
  snapshot: CompanySnapshot,
  locale: Locale = DEFAULT_LOCALE,
  visibility: "public" | "private" = "private",
  eventImpacts: CompanyEventImpact[] = [],
): Promise<GeneratedResearchMemo> {
  const t = getDictionary(locale);
  const model = getOpenAiModel();

  try {
    const result = await generateAiSections(snapshot, locale, eventImpacts);
    return {
      memo: {
        company: snapshot.identity,
        generatedAt: new Date().toISOString(),
        mode: "ai",
        visibility,
        disclaimer: t.memo.disclaimer,
        sections: result.sections,
        citations: [...snapshot.citations, ...eventCitations(eventImpacts)],
      },
      usage: {
        model,
        status: "success",
        ...result.usage,
      },
    };
  } catch (error) {
    return {
      memo: generateFallbackResearchMemo(snapshot, locale, visibility, eventImpacts),
      usage: {
        model,
        status: "fallback",
        errorMessage:
          error instanceof Error ? error.message : "OpenAI memo request failed",
      },
    };
  }
}

export async function generateResearchMemo(
  snapshot: CompanySnapshot,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ResearchMemo> {
  return (await generateResearchMemoWithUsage(snapshot, locale, "public")).memo;
}
