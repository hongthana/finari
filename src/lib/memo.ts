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
  CompanySnapshot,
  MemoSection,
  ResearchMemo,
  TrendSignal,
} from "@/lib/types";

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

function fallbackSections(
  snapshot: CompanySnapshot,
  locale: Locale,
): MemoSection[] {
  const t = getDictionary(locale);
  const latest = snapshot.periods[0];
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

  return [
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
      title: t.memo.sections.riskQuestions,
      signal: snapshot.caveats.length ? "negative" : "neutral",
      body:
        snapshot.caveats.length > 0
          ? t.memo.fallback.reviewCaveats(translatedCaveats)
          : t.memo.fallback.defaultQuestions,
    },
  ];
}

function buildPrompt(snapshot: CompanySnapshot, locale: Locale): string {
  const t = getDictionary(locale);
  const latest = snapshot.periods[0];
  const periods = snapshot.periods.map((period) => ({
    fiscalYear: period.fiscalYear,
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

  return JSON.stringify(
    {
      instruction: t.memo.aiInstruction,
      locale,
      company: snapshot.identity,
      latestFiscalYear: latest?.fiscalYear,
      periods,
      metrics: snapshot.metrics,
      caveats: snapshot.caveats,
      citations: snapshot.citations,
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

async function generateAiSections(
  snapshot: CompanySnapshot,
  locale: Locale,
): Promise<MemoSection[]> {
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
      input: buildPrompt(snapshot, locale),
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
                maxItems: 6,
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

  return sections;
}

export async function generateResearchMemo(
  snapshot: CompanySnapshot,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ResearchMemo> {
  const t = getDictionary(locale);

  try {
    const sections = await generateAiSections(snapshot, locale);
    return {
      company: snapshot.identity,
      generatedAt: new Date().toISOString(),
      mode: "ai",
      disclaimer: t.memo.disclaimer,
      sections,
      citations: snapshot.citations,
    };
  } catch {
    return {
      company: snapshot.identity,
      generatedAt: new Date().toISOString(),
      mode: "fallback",
      disclaimer: t.memo.disclaimer,
      sections: fallbackSections(snapshot, locale),
      citations: snapshot.citations,
    };
  }
}
