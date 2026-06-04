import { getOpenAiModel } from "@/lib/env";
import { compactCurrency, formatMetricValue } from "@/lib/format";
import { summarizeMetricSignal } from "@/lib/financial-analysis";
import type {
  CompanySnapshot,
  MemoSection,
  ResearchMemo,
  TrendSignal,
} from "@/lib/types";

const DISCLAIMER =
  "Finari is educational research software. It does not provide personalized investment advice, buy/sell recommendations, price targets, or suitability analysis.";

function sentenceForSignal(signal: TrendSignal): string {
  if (signal === "positive") {
    return "The current filing profile screens as constructive, but it still needs valuation and business-quality review.";
  }

  if (signal === "negative") {
    return "The current filing profile contains pressure points that deserve extra diligence before any investment decision.";
  }

  if (signal === "neutral") {
    return "The current filing profile is mixed, so the next step is understanding the business drivers behind the numbers.";
  }

  return "There is not enough standardized filing data to form a strong filing-based view.";
}

function fallbackSections(snapshot: CompanySnapshot): MemoSection[] {
  const latest = snapshot.periods[0];
  const prior = snapshot.periods[1];
  const signal = summarizeMetricSignal(snapshot.metrics);
  const metricHighlights = snapshot.metrics
    .slice(0, 6)
    .map((metric) => `${metric.label}: ${formatMetricValue(metric.value, metric.unit)}`)
    .join("; ");

  return [
    {
      title: "Institutional read",
      signal,
      body: `${snapshot.identity.name} (${snapshot.identity.ticker}) is analyzed from SEC standardized financial-statement facts. ${sentenceForSignal(signal)}`,
    },
    {
      title: "Financial trajectory",
      signal:
        latest?.revenue && prior?.revenue && latest.revenue > prior.revenue
          ? "positive"
          : "neutral",
      body: latest
        ? `Latest annual revenue was ${compactCurrency(latest.revenue)} and net income was ${compactCurrency(latest.netIncome)} for fiscal ${latest.fiscalYear}. ${metricHighlights || "Several core metrics were unavailable in standard SEC tags."}`
        : "Finari could not identify a comparable latest annual period from standard SEC tags.",
    },
    {
      title: "Balance sheet and cash flow",
      signal:
        latest?.freeCashFlow && latest.freeCashFlow > 0 ? "positive" : "neutral",
      body: latest
        ? `Reported assets were ${compactCurrency(latest.assets)}, liabilities were ${compactCurrency(latest.liabilities)}, cash was ${compactCurrency(latest.cash)}, and free cash flow was ${compactCurrency(latest.freeCashFlow)}. Treat free cash flow as a screening estimate because XBRL tag conventions can vary by issuer.`
        : "Balance sheet and cash-flow screening is unavailable until a filing period can be normalized.",
    },
    {
      title: "Risk questions",
      signal: snapshot.caveats.length ? "negative" : "neutral",
      body:
        snapshot.caveats.length > 0
          ? `Review these before relying on the memo: ${snapshot.caveats.join(" ")}`
          : "Key next questions: what drives margins, how durable is growth, what risks management highlights in the latest 10-K, and whether the current market price compensates for those risks.",
    },
  ];
}

function buildPrompt(snapshot: CompanySnapshot): string {
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
      instruction:
        "Write a concise institutional-grade equity research memo for retail investors. Use only the supplied SEC-derived facts and caveats. Do not include buy/sell recommendations, price targets, or personalized investment advice. Return strict JSON with sections: [{title, body, signal}] where signal is positive, neutral, negative, or unknown.",
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

async function generateAiSections(snapshot: CompanySnapshot): Promise<MemoSection[]> {
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
      input: buildPrompt(snapshot),
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
): Promise<ResearchMemo> {
  try {
    const sections = await generateAiSections(snapshot);
    return {
      company: snapshot.identity,
      generatedAt: new Date().toISOString(),
      mode: "ai",
      disclaimer: DISCLAIMER,
      sections,
      citations: snapshot.citations,
    };
  } catch {
    return {
      company: snapshot.identity,
      generatedAt: new Date().toISOString(),
      mode: "fallback",
      disclaimer: DISCLAIMER,
      sections: fallbackSections(snapshot),
      citations: snapshot.citations,
    };
  }
}
