"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bookmark,
  Building2,
  CheckCircle2,
  CircleHelp,
  Database,
  DollarSign,
  Download,
  FileText,
  Languages,
  Loader2,
  LockKeyhole,
  Minus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  compactCurrency,
  compactNumber,
  formatMetricValue,
  formatPercent,
} from "@/lib/format";
import {
  getAlternateLocale,
  getDictionary,
  translateCaveat,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";
import type {
  BusinessDriver,
  ChangeItem,
  CompanyIdentity,
  CompanySnapshot,
  DataQualityCheck,
  FinancialMetric,
  FinancialPeriod,
  MetricUnit,
  PeerMetricComparison,
  ResearchMemo,
  TrendSignal,
} from "@/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";
type MemoState = "idle" | "loading" | "ready" | "error";
type Viewer = {
  id: string;
  email?: string | null;
  isAdmin: boolean;
};

const STARTER_TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "META"];
const DEFAULT_TICKER = "AAPL";

function signalClasses(signal: TrendSignal): string {
  if (signal === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (signal === "negative") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (signal === "unknown") {
    return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

type SignalIconVariant = "status" | "trend";
type MeaningTone = "sky" | "teal" | "emerald" | "amber" | "zinc";

function signalIcon(signal: TrendSignal, variant: SignalIconVariant = "status") {
  if (variant === "trend") {
    if (signal === "positive") {
      return <TrendingUp className="h-4 w-4" aria-hidden="true" />;
    }

    if (signal === "negative") {
      return <TrendingDown className="h-4 w-4" aria-hidden="true" />;
    }

    if (signal === "unknown") {
      return <CircleHelp className="h-4 w-4" aria-hidden="true" />;
    }

    return <Minus className="h-4 w-4" aria-hidden="true" />;
  }

  if (signal === "positive") {
    return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  }

  if (signal === "negative") {
    return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  }

  if (signal === "unknown") {
    return <CircleHelp className="h-4 w-4" aria-hidden="true" />;
  }

  return <ShieldCheck className="h-4 w-4" aria-hidden="true" />;
}

function signalTooltip(
  signal: TrendSignal,
  variant: SignalIconVariant,
  t: Dictionary,
): string {
  const tooltipSet =
    variant === "trend"
      ? t.advisor.signalTooltips.trend
      : t.advisor.signalTooltips.status;

  return tooltipSet[signal];
}

function SignalBadge({
  signal,
  variant = "status",
  label,
  t,
  className = "p-1.5",
  tooltipAlign = "left",
}: {
  signal: TrendSignal;
  variant?: SignalIconVariant;
  label: string;
  t: Dictionary;
  className?: string;
  tooltipAlign?: "left" | "right";
}) {
  const tooltipId = useId();
  const tooltip = signalTooltip(signal, variant, t);
  const alignClass = tooltipAlign === "right" ? "right-0" : "left-0";

  return (
    <span
      className={`group relative inline-flex shrink-0 rounded-md border ${className} ${signalClasses(signal)} outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2`}
      role="img"
      tabIndex={0}
      aria-label={`${label}: ${signal}. ${tooltip}`}
      aria-describedby={tooltipId}
      title={tooltip}
    >
      {signalIcon(signal, variant)}
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute ${alignClass} top-full z-30 mt-2 hidden w-64 max-w-[calc(100vw-2rem)] break-words rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-lg group-hover:block group-focus-visible:block`}
      >
        {tooltip}
      </span>
    </span>
  );
}

function meaningClasses(tone: MeaningTone): string {
  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (tone === "teal") {
    return "border-teal-200 bg-teal-50 text-teal-800";
  }

  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function MeaningBadge({
  Icon,
  label,
  tooltip,
  tone = "zinc",
  className = "p-1.5",
  tooltipAlign = "left",
}: {
  Icon: LucideIcon;
  label: string;
  tooltip: string;
  tone?: MeaningTone;
  className?: string;
  tooltipAlign?: "left" | "right";
}) {
  const tooltipId = useId();
  const alignClass = tooltipAlign === "right" ? "right-0" : "left-0";

  return (
    <span
      className={`group relative inline-flex shrink-0 rounded-md border ${className} ${meaningClasses(tone)} outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2`}
      role="img"
      tabIndex={0}
      aria-label={`${label}. ${tooltip}`}
      aria-describedby={tooltipId}
      title={tooltip}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute ${alignClass} top-full z-30 mt-2 hidden w-64 max-w-[calc(100vw-2rem)] break-words rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-lg group-hover:block group-focus-visible:block`}
      >
        {tooltip}
      </span>
    </span>
  );
}

function MeaningPill({
  Icon,
  label,
  tooltip,
  tone = "zinc",
}: {
  Icon: LucideIcon;
  label: string;
  tooltip: string;
  tone?: MeaningTone;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold ${meaningClasses(tone)}`}
    >
      <MeaningBadge
        Icon={Icon}
        label={label}
        tooltip={tooltip}
        tone={tone}
        className="p-0.5"
      />
      {label}
    </div>
  );
}

function metricTone(metric: FinancialMetric): string {
  if (metric.signal === "positive") {
    return "text-emerald-700";
  }

  if (metric.signal === "negative") {
    return "text-rose-700";
  }

  return "text-zinc-800";
}

function metricValue(snapshot: CompanySnapshot, id: string): number | null {
  return snapshot.metrics.find((metric) => metric.id === id)?.value ?? null;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function describeChange(label: string, value: number | null, t: Dictionary): string {
  if (!hasNumber(value)) {
    return t.advisor.noComparable(label);
  }

  if (Math.abs(value) < 0.005) {
    return t.advisor.flat(label);
  }

  const direction = value > 0 ? t.advisor.increased : t.advisor.declined;
  return t.advisor.changed(label, direction, formatPercent(Math.abs(value)));
}

function metricSignal(snapshot: CompanySnapshot, id: string): TrendSignal {
  return snapshot.metrics.find((metric) => metric.id === id)?.signal ?? "unknown";
}

function growthEarningsSignal(snapshot: CompanySnapshot): TrendSignal {
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");
  const values = [revenueGrowth, netIncomeGrowth].filter(hasNumber);

  if (!values.length) {
    return "unknown";
  }

  const hasDecline = values.some((value) => value < -0.005);
  const hasGrowth = values.some((value) => value > 0.005);

  if (hasDecline && !hasGrowth) {
    return "negative";
  }

  if (hasGrowth && !hasDecline) {
    return "positive";
  }

  return "neutral";
}

function roundedPercentValue(value: number | null): string {
  return hasNumber(value) ? formatPercent(value) : "n/a";
}

function qualityRead(snapshot: CompanySnapshot, t: Dictionary): string {
  const grossMargin = metricValue(snapshot, "gross-margin");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const fcfMargin = metricValue(snapshot, "free-cash-flow-margin");

  if (!hasNumber(grossMargin) && !hasNumber(operatingMargin) && !hasNumber(fcfMargin)) {
    return t.advisor.profitabilityUnavailable;
  }

  const strongProfit =
    (hasNumber(operatingMargin) && operatingMargin >= 0.15) ||
    (hasNumber(fcfMargin) && fcfMargin >= 0.08);
  const weakProfit =
    (hasNumber(operatingMargin) && operatingMargin < 0.03) ||
    (hasNumber(fcfMargin) && fcfMargin < 0);

  if (strongProfit) {
    return t.advisor.profitabilityStrong(
      roundedPercentValue(grossMargin),
      roundedPercentValue(operatingMargin),
      roundedPercentValue(fcfMargin),
    );
  }

  if (weakProfit) {
    return t.advisor.profitabilityWeak(
      roundedPercentValue(grossMargin),
      roundedPercentValue(operatingMargin),
      roundedPercentValue(fcfMargin),
    );
  }

  return t.advisor.profitabilityMixed(
    roundedPercentValue(grossMargin),
    roundedPercentValue(operatingMargin),
    roundedPercentValue(fcfMargin),
  );
}

function balanceSheetRead(snapshot: CompanySnapshot, t: Dictionary): string {
  const debtToEquity = metricValue(snapshot, "debt-to-equity");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");

  if (!hasNumber(debtToEquity) && !hasNumber(liabilitiesToAssets)) {
    return t.advisor.leverageUnavailable;
  }

  const leverageText = [
    hasNumber(debtToEquity)
      ? t.advisor.debtToEquity(formatMetricValue(debtToEquity, "ratio"))
      : null,
    hasNumber(liabilitiesToAssets)
      ? t.advisor.liabilitiesToAssets(formatPercent(liabilitiesToAssets))
      : null,
  ].filter(Boolean);

  const elevated =
    (hasNumber(debtToEquity) && debtToEquity > 1) ||
    (hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7);

  return `${leverageText.join(t.advisor.leverageJoiner)}; ${
    elevated ? t.advisor.leverageElevated : t.advisor.leverageManageable
  }`;
}

function decisionTakeaway(snapshot: CompanySnapshot, t: Dictionary): string {
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const fcfMargin = metricValue(snapshot, "free-cash-flow-margin");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");
  const debtToEquity = metricValue(snapshot, "debt-to-equity");

  const growthPressure = hasNumber(revenueGrowth) && revenueGrowth < -0.005;
  const qualitySupport =
    (hasNumber(operatingMargin) && operatingMargin >= 0.15) ||
    (hasNumber(fcfMargin) && fcfMargin >= 0.08);
  const balanceRisk =
    (hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7) ||
    (hasNumber(debtToEquity) && debtToEquity > 1);

  if (growthPressure && qualitySupport && balanceRisk) {
    return t.advisor.takeaways.qualityGrowthBalance;
  }

  if (growthPressure && qualitySupport) {
    return t.advisor.takeaways.qualityGrowth;
  }

  if (growthPressure) {
    return t.advisor.takeaways.growthPressure;
  }

  if (qualitySupport && balanceRisk) {
    return t.advisor.takeaways.qualityBalance;
  }

  if (qualitySupport) {
    return t.advisor.takeaways.qualitySupport;
  }

  return t.advisor.takeaways.needsMoreEvidence;
}

function advisorReads(snapshot: CompanySnapshot, t: Dictionary) {
  const latest = snapshot.periods[0];
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");

  return [
    {
      title: t.advisor.readLabels.trend,
      body: `${t.advisor.latestFacts(
        snapshot.identity.name,
        compactCurrency(latest?.revenue),
        compactCurrency(latest?.netIncome),
        compactCurrency(latest?.freeCashFlow),
        latest?.fiscalYear ? String(latest.fiscalYear) : t.advisor.latestPeriod,
      )} ${describeChange(t.advisor.labels.revenue, revenueGrowth, t)} ${
        t.advisor.and
      } ${describeChange(t.advisor.labels.netIncome, netIncomeGrowth, t)}.`,
      signal: growthEarningsSignal(snapshot),
      iconVariant: "trend" as const,
    },
    {
      title: t.advisor.readLabels.quality,
      body: qualityRead(snapshot, t),
      signal: metricSignal(snapshot, "operating-margin"),
      iconVariant: "status" as const,
    },
    {
      title: t.advisor.readLabels.balance,
      body: balanceSheetRead(snapshot, t),
      signal: metricSignal(snapshot, "liabilities-to-assets"),
      iconVariant: "status" as const,
    },
    {
      title: t.advisor.readLabels.decision,
      body: decisionTakeaway(snapshot, t),
      signal: "neutral" as const,
      iconVariant: "status" as const,
    },
  ];
}

function advisorQuestionAnswers(snapshot: CompanySnapshot, t: Dictionary) {
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");
  const debtToEquity = metricValue(snapshot, "debt-to-equity");
  const fcfMargin = metricValue(snapshot, "free-cash-flow-margin");

  return [
    {
      question:
        hasNumber(revenueGrowth) && revenueGrowth < -0.005
          ? t.advisor.questions.revenueDecline
          : t.advisor.questions.revenueContinue,
      answer:
        hasNumber(revenueGrowth) && revenueGrowth < -0.005
          ? t.advisor.answers.revenueDecline(formatPercent(Math.abs(revenueGrowth)))
          : t.advisor.answers.revenueContinue(
              hasNumber(revenueGrowth) ? formatPercent(revenueGrowth) : "n/a",
            ),
      signal: metricSignal(snapshot, "revenue-growth"),
    },
    {
      question:
        hasNumber(netIncomeGrowth) && netIncomeGrowth < -0.005
          ? t.advisor.questions.netIncomeLower
          : t.advisor.questions.earningsDurable,
      answer:
        hasNumber(netIncomeGrowth) && netIncomeGrowth < -0.005
          ? t.advisor.answers.netIncomeLower(formatPercent(Math.abs(netIncomeGrowth)))
          : t.advisor.answers.earningsDurable(
              hasNumber(netIncomeGrowth) ? formatPercent(netIncomeGrowth) : "n/a",
            ),
      signal: metricSignal(snapshot, "net-income-growth"),
    },
    {
      question:
        hasNumber(operatingMargin) && operatingMargin > 0.15
          ? t.advisor.questions.marginsDefensible
          : t.advisor.questions.operatingLeverage,
      answer:
        hasNumber(operatingMargin) && operatingMargin > 0.15
          ? t.advisor.answers.marginsDefensible(
              formatPercent(operatingMargin),
              roundedPercentValue(fcfMargin),
            )
          : t.advisor.answers.operatingLeverage(roundedPercentValue(operatingMargin)),
      signal: metricSignal(snapshot, "operating-margin"),
    },
    {
      question:
        hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7
          ? t.advisor.questions.balanceFlex
          : t.advisor.questions.priceReflect,
      answer:
        hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7
          ? t.advisor.answers.balanceFlex(
              formatPercent(liabilitiesToAssets),
              hasNumber(debtToEquity) ? formatMetricValue(debtToEquity, "ratio") : "n/a",
            )
          : t.advisor.answers.priceReflect,
      signal: metricSignal(snapshot, "liabilities-to-assets"),
    },
  ];
}

function makeChartRows(snapshot: CompanySnapshot | null) {
  return (
    snapshot?.periods
      .slice()
      .reverse()
      .map((period) => ({
        year: String(period.fiscalYear),
        revenue: period.revenue ?? 0,
        netIncome: period.netIncome ?? 0,
        freeCashFlow: period.freeCashFlow ?? 0,
        assets: period.assets ?? 0,
        liabilities: period.liabilities ?? 0,
      })) ?? []
  );
}

function AdvisorSummary({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const reads = advisorReads(snapshot, t);
  const questions = advisorQuestionAnswers(snapshot, t);

  return (
    <section className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,390px)]">
        <div className="min-w-0 max-w-full">
          <MeaningPill
            Icon={ShieldCheck}
            label={t.advisor.badge}
            tooltip={t.advisor.badgeTooltip}
            tone="teal"
          />
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {t.advisor.heading}
          </h3>
          <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
            {t.advisor.intro}
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {reads.map((read) => (
              <article
                key={read.title}
                className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3"
              >
                <div className="flex items-start gap-3">
                  <SignalBadge
                    signal={read.signal}
                    variant={read.iconVariant}
                    label={read.title}
                    t={t}
                    className="mt-0.5 p-1.5"
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-950">
                      {read.title}
                    </h4>
                    <p className="mt-1 break-words text-sm leading-6 text-zinc-700">
                      {read.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-3 break-words text-xs leading-5 text-zinc-500">
            {t.advisor.closing}
          </p>
        </div>

        <div className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h4 className="text-sm font-semibold text-zinc-950">
            {t.advisor.questionsTitle}
          </h4>
          <div className="mt-3 space-y-3">
            {questions.map((item) => (
              <article
                key={item.question}
                className="min-w-0 rounded-md border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-start gap-2">
                  <SignalBadge
                    signal={item.signal}
                    label={item.question}
                    t={t}
                    className="mt-0.5 p-1"
                  />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-5 text-zinc-950">
                      {item.question}
                    </p>
                    <p className="mt-1 break-words text-sm leading-6 text-zinc-700">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ResearchToolbar({
  locale,
  t,
  query,
  setQuery,
  results,
  loading,
  activeTicker,
  onSelectTicker,
  onSubmit,
}: {
  locale: Locale;
  t: Dictionary;
  query: string;
  setQuery: (value: string) => void;
  results: CompanyIdentity[];
  loading: boolean;
  activeTicker: string;
  onSelectTicker: (ticker: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const alternateLocale = getAlternateLocale(locale);
  const languageHref = `/${alternateLocale}?ticker=${encodeURIComponent(activeTicker)}`;

  return (
    <section className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 text-white">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
                  {t.toolbar.product}
                </p>
                <h1 className="text-xl font-semibold tracking-normal text-zinc-950 sm:text-2xl">
                  {t.toolbar.headline}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600">
            <Link
              href={languageHref}
              aria-label={t.toolbar.languageLabel}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
            >
              <Languages className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              {locale === "en" ? t.toolbar.thai : t.toolbar.english}
            </Link>
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <Database className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
              {t.toolbar.secBacked}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-700"
                aria-hidden="true"
              />
              {t.toolbar.educationOnly}
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <form onSubmit={onSubmit} className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-zinc-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.toolbar.placeholder}
              className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-28 text-base font-medium text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              {t.toolbar.research}
            </button>

            {results.length > 0 && (
              <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                {results.map((company) => (
                  <button
                    key={`${company.cik}-${company.ticker}`}
                    type="button"
                    onClick={() => onSelectTicker(company.ticker)}
                    className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left transition hover:bg-zinc-100"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-950">
                        {company.ticker}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {company.name}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-zinc-400"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="flex flex-wrap gap-2">
            {STARTER_TICKERS.map((ticker) => (
              <button
                key={ticker}
                type="button"
                onClick={() => onSelectTicker(ticker)}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SnapshotHeader({
  snapshot,
  loading,
  error,
  onRefresh,
  t,
  locale,
}: {
  snapshot: CompanySnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  t: Dictionary;
  locale: Locale;
}) {
  if (loading && !snapshot) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3 text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          {t.snapshot.loading}
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="rounded-md border border-rose-200 bg-rose-50 p-5 text-rose-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{t.snapshot.unavailableTitle}</h2>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  const latest = snapshot.periods[0];
  const latestFinancialFiling = snapshot.latestFinancialFiling ?? snapshot.latestFiling;
  const snapshotCards = [
    {
      label: t.snapshot.revenue,
      value: compactCurrency(latest?.revenue),
      Icon: TrendingUp,
      tooltip: t.snapshot.tooltips.revenue,
      tone: "teal" as const,
    },
    {
      label: t.snapshot.netIncome,
      value: compactCurrency(latest?.netIncome),
      Icon: DollarSign,
      tooltip: t.snapshot.tooltips.netIncome,
      tone: "emerald" as const,
    },
    {
      label: t.snapshot.fcf,
      value: compactCurrency(latest?.freeCashFlow),
      Icon: Download,
      tooltip: t.snapshot.tooltips.fcf,
      tone: "sky" as const,
    },
    {
      label: t.snapshot.assets,
      value: compactCurrency(latest?.assets),
      Icon: Database,
      tooltip: t.snapshot.tooltips.assets,
      tone: "zinc" as const,
    },
  ];

  return (
    <section className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex min-w-0 max-w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {snapshot.identity.exchange || t.snapshot.usListed}
            </span>
            {snapshot.identity.sicDescription && (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                {snapshot.identity.sicDescription}
              </span>
            )}
          </div>
          <div className="mt-3 flex min-w-0 items-start gap-3">
            <MeaningBadge
              Icon={Building2}
              label={snapshot.identity.name}
              tooltip={t.snapshot.tooltips.company}
              tone="sky"
              className="mt-1 p-1.5"
            />
            <h2 className="min-w-0 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              {snapshot.identity.name}
            </h2>
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            {snapshot.identity.ticker} · CIK {snapshot.identity.cik}
            {latest?.fiscalYear
              ? ` · ${t.snapshot.fiscalYear} ${latest.fiscalYear}`
              : ""}
          </p>
        </div>

        <div className="grid min-w-0 max-w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[520px] xl:shrink-0">
          {snapshotCards.map(({ label, value, Icon, tooltip, tone }) => (
            <div
              key={label}
              className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs font-medium text-zinc-500">
                  {label}
                </p>
                <MeaningBadge
                  Icon={Icon}
                  label={label}
                  tooltip={tooltip}
                  tone={tone}
                  className="p-1"
                  tooltipAlign="right"
                />
              </div>
              <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 text-sm">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-700 transition hover:border-teal-500 hover:text-teal-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t.snapshot.refresh}
        </button>
        {latestFinancialFiling?.url && (
          <a
            href={latestFinancialFiling.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-700 transition hover:border-sky-500 hover:text-sky-700"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t.snapshot.latestFinancialFiling}
          </a>
        )}
        <span className="text-xs font-medium text-zinc-500">
          {t.snapshot.generated}{" "}
          {new Date(snapshot.generatedAt).toLocaleString(
            locale === "th" ? "th-TH" : "en-US",
          )}
        </span>
      </div>
    </section>
  );
}

function recordValue<T extends Record<string, string>>(
  record: T,
  key: string,
  fallback: string,
): string {
  return record[key as keyof T] ?? fallback;
}

function formatAnalysisValue(
  value: number | null | undefined,
  unit: MetricUnit,
): string {
  return formatMetricValue(value, unit);
}

function periodLabel(period: FinancialPeriod, t: Dictionary): string {
  if (period.periodType === "ttm") {
    return t.analysis.ttm;
  }

  if (period.periodType === "quarterly" && period.fiscalPeriod) {
    return `${period.fiscalYear} ${period.fiscalPeriod}`;
  }

  return `${t.snapshot.fiscalYear} ${period.fiscalYear}`;
}

function DecisionScreen({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const framework = snapshot.decisionFramework;
  const latestFinancialFiling = snapshot.latestFinancialFiling ?? snapshot.latestFiling;
  const decisionCards = [
    {
      label: t.decision.finalTakeaway,
      value: recordValue(
        t.decision.takeaways,
        framework.takeaway,
        framework.takeaway,
      ),
      Icon: ShieldCheck,
      tooltip: t.decision.tooltips.takeaway,
      tone: "teal" as const,
      signal: framework.signal,
    },
    {
      label: t.decision.strongestEvidence,
      value: recordValue(
        t.decision.evidence,
        framework.strongestEvidence,
        framework.strongestEvidence,
      ),
      Icon: CheckCircle2,
      tooltip: t.decision.tooltips.evidence,
      tone: "emerald" as const,
      signal: "positive" as TrendSignal,
    },
    {
      label: t.decision.mainRisk,
      value: recordValue(t.decision.risks, framework.mainRisk, framework.mainRisk),
      Icon: AlertTriangle,
      tooltip: t.decision.tooltips.risk,
      tone: "amber" as const,
      signal: framework.signal === "positive" ? "neutral" : framework.signal,
    },
    {
      label: t.decision.watchNext,
      value: framework.watchMetric,
      Icon: TrendingUp,
      tooltip: t.decision.tooltips.watch,
      tone: "sky" as const,
      signal: "neutral" as TrendSignal,
    },
    {
      label: t.decision.latestFinancialFiling,
      value: latestFinancialFiling
        ? [latestFinancialFiling.form, latestFinancialFiling.filingDate]
            .filter(Boolean)
            .join(" · ")
        : t.decision.notAvailable,
      Icon: FileText,
      tooltip: t.decision.tooltips.filing,
      tone: "zinc" as const,
      signal: latestFinancialFiling ? "positive" : "unknown",
    },
    {
      label: t.decision.dataConfidence,
      value: `${t.analysis.confidenceLabels[snapshot.dataQuality.label]} · ${snapshot.dataQuality.score}/100`,
      Icon: Database,
      tooltip: t.decision.tooltips.confidence,
      tone: "zinc" as const,
      signal: snapshot.dataQuality.signal,
    },
  ];

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <MeaningPill
            Icon={ShieldCheck}
            label={t.decision.badge}
            tooltip={t.decision.badgeTooltip}
            tone="teal"
          />
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {t.decision.heading}
          </h3>
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-zinc-600">
            {t.decision.subtitle}
          </p>
        </div>
        <SignalBadge
          signal={framework.signal}
          label={t.decision.finalTakeaway}
          t={t}
          tooltipAlign="right"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {decisionCards.map((card) => (
          <article
            key={card.label}
            className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3"
          >
            <div className="flex items-start gap-3">
              <MeaningBadge
                Icon={card.Icon}
                label={card.label}
                tooltip={card.tooltip}
                tone={card.tone}
                className="mt-0.5 p-1.5"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  {card.label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold leading-6 text-zinc-950">
                  {card.value}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function QuarterlyTrendPanel({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const latestQuarters = snapshot.quarterlyPeriods.slice(0, 4);
  const rows = snapshot.ttmPeriod
    ? [snapshot.ttmPeriod, ...latestQuarters]
    : latestQuarters;

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.quarterlyTitle}
          </h3>
          <p className="mt-1 break-words text-sm leading-6 text-zinc-500">
            {t.analysis.quarterlySubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={TrendingUp}
          label={t.analysis.quarterlyTitle}
          tooltip={t.analysis.tooltips.quarterly}
          tone="teal"
          tooltipAlign="right"
        />
      </div>

      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.08em] text-zinc-500">
              <tr>
                <th className="border-b border-zinc-200 py-2 pr-4 font-semibold">
                  {t.analysis.quarter}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.revenue}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.netIncome}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.fcf}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.opMargin}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((period) => (
                <tr key={`${period.periodType}-${period.fiscalYear}-${period.fiscalPeriod}`}>
                  <td className="py-3 pr-4 font-semibold text-zinc-950">
                    {periodLabel(period, t)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {compactCurrency(period.revenue)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {compactCurrency(period.netIncome)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {compactCurrency(period.freeCashFlow)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatPercent(
                      period.operatingIncome && period.revenue
                        ? period.operatingIncome / period.revenue
                        : null,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!snapshot.ttmPeriod && (
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              {t.analysis.noTtm}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t.analysis.noComparable}
        </p>
      )}
    </section>
  );
}

function ChangeCard({
  item,
  t,
}: {
  item: ChangeItem;
  t: Dictionary;
}) {
  const label = recordValue(t.analysis.changeLabels, item.id, item.label);
  const description = recordValue(
    t.analysis.changeDescriptions,
    item.id,
    item.description,
  );

  return (
    <article className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start gap-3">
        <SignalBadge
          signal={item.signal}
          variant="trend"
          label={label}
          t={t}
          className="mt-0.5 p-1.5"
        />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">
            {label}
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {description}
          </p>
          <dl className="mt-2 grid gap-2 text-xs text-zinc-600 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-zinc-500">{t.analysis.current}</dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatAnalysisValue(item.currentValue, item.unit)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">{t.analysis.previous}</dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatAnalysisValue(item.previousValue, item.unit)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">{t.analysis.change}</dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatPercent(item.change)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

function CaveatChangePanel({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  const caveatChange = snapshot.caveatChangeAnalysis ?? {
    status: "baseline" as const,
    newCaveats: [],
    resolvedCaveats: [],
    unchangedCaveats: snapshot.caveats,
  };
  const hasDeltas =
    caveatChange.newCaveats.length || caveatChange.resolvedCaveats.length;

  const renderList = (title: string, caveats: string[]) =>
    caveats.length ? (
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {title}
        </h5>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-700">
          {caveats.map((caveat) => (
            <li key={caveat} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              <span className="min-w-0 break-words">
                {translateCaveat(caveat, locale)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h4 className="text-sm font-semibold text-zinc-950">
        {t.analysis.caveatChangesTitle}
      </h4>
      {caveatChange.status === "baseline" ? (
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t.analysis.caveatBaseline}
        </p>
      ) : hasDeltas ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {renderList(t.analysis.newCaveats, caveatChange.newCaveats)}
          {renderList(t.analysis.resolvedCaveats, caveatChange.resolvedCaveats)}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t.analysis.caveatUnchanged}
        </p>
      )}
      {caveatChange.unchangedCaveats.length > 0 && (
        <div className="mt-4">
          {renderList(t.analysis.unchangedCaveats, caveatChange.unchangedCaveats)}
        </div>
      )}
    </div>
  );
}

function ChangeAnalysisPanel({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.changeTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.changeSubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={RefreshCw}
          label={t.analysis.changeTitle}
          tooltip={t.analysis.tooltips.change}
          tone="sky"
          tooltipAlign="right"
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">
            {t.analysis.latestQuarter}
          </h4>
          <div className="mt-3 space-y-3">
            {snapshot.changeAnalysis.quarterly.length ? (
              snapshot.changeAnalysis.quarterly.map((item) => (
                <ChangeCard key={item.id} item={item} t={t} />
              ))
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                {t.analysis.noComparable}
              </p>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">
            {t.analysis.latestAnnual}
          </h4>
          <div className="mt-3 space-y-3">
            {snapshot.changeAnalysis.annual.length ? (
              snapshot.changeAnalysis.annual.map((item) => (
                <ChangeCard key={item.id} item={item} t={t} />
              ))
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                {t.analysis.noComparable}
              </p>
            )}
          </div>
        </div>
      </div>
      <CaveatChangePanel snapshot={snapshot} locale={locale} t={t} />
    </section>
  );
}

function BusinessDriverCard({
  driver,
  t,
}: {
  driver: BusinessDriver;
  t: Dictionary;
}) {
  const label = recordValue(t.analysis.driverLabels, driver.id, driver.id);
  const description = recordValue(
    t.analysis.driverDescriptions,
    driver.id,
    driver.id,
  );

  return (
    <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <SignalBadge
          signal={driver.signal}
          label={label}
          t={t}
          className="mt-0.5 p-1.5"
        />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">{label}</h4>
          <p className="mt-1 break-words text-sm leading-6 text-zinc-600">
            {description}
          </p>
          <dl className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-500">
                {t.analysis.primaryValue}
              </dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {formatAnalysisValue(driver.primaryValue, driver.unit)}
              </dd>
            </div>
            {driver.secondaryValue !== undefined && (
              <div>
                <dt className="font-medium text-zinc-500">
                  {t.analysis.secondaryValue}
                </dt>
                <dd className="mt-0.5 font-semibold text-zinc-900">
                  {driver.id === "liquidity"
                    ? compactCurrency(driver.secondaryValue)
                    : formatAnalysisValue(driver.secondaryValue, "currency")}
                </dd>
              </div>
            )}
          </dl>
          {driver.details?.length ? (
            <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
              {driver.details.map((detail) => {
                const detailLabel = recordValue(
                  t.analysis.driverDetailLabels,
                  detail.id,
                  detail.id,
                );
                const detailDescription = recordValue(
                  t.analysis.driverDetailDescriptions,
                  detail.id,
                  detail.id,
                );

                return (
                  <div key={detail.id} className="flex items-start gap-2">
                    <SignalBadge
                      signal={detail.signal}
                      label={detailLabel}
                      t={t}
                      className="mt-0.5 h-6 w-6 rounded-md p-1"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h5 className="text-xs font-semibold text-zinc-950">
                          {detailLabel}
                        </h5>
                        <span className="text-xs font-semibold text-zinc-600">
                          {formatAnalysisValue(detail.value, detail.unit)}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-xs leading-5 text-zinc-500">
                        {detailDescription}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function BusinessDriversPanel({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.driversTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.driversSubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={ShieldCheck}
          label={t.analysis.driversTitle}
          tooltip={t.analysis.tooltips.drivers}
          tone="teal"
          tooltipAlign="right"
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.businessDrivers.map((driver) => (
          <BusinessDriverCard key={driver.id} driver={driver} t={t} />
        ))}
      </div>
    </section>
  );
}

function BalanceSheetPanel({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const analysis = snapshot.balanceSheetAnalysis;
  const values = [
    { label: t.analysis.cash, value: compactCurrency(analysis.cash) },
    { label: t.analysis.debt, value: compactCurrency(analysis.debt) },
    { label: t.analysis.netCash, value: compactCurrency(analysis.netCash) },
    {
      label: t.analysis.workingCapital,
      value: compactCurrency(analysis.workingCapital),
    },
    {
      label: t.analysis.cashToDebt,
      value: formatMetricValue(analysis.cashToDebt, "ratio"),
    },
    {
      label: t.analysis.liabilitiesToAssets,
      value: formatPercent(analysis.liabilitiesToAssets),
    },
    {
      label: t.analysis.debtToEquity,
      value: formatMetricValue(analysis.debtToEquity, "ratio"),
    },
  ];

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.balanceTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.balanceSubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={Database}
          label={t.analysis.balanceTitle}
          tooltip={t.analysis.tooltips.balance}
          tone="sky"
          tooltipAlign="right"
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {values.map((item) => (
          <article
            key={item.label}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
          >
            <p className="text-xs font-medium text-zinc-500">{item.label}</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {item.value}
            </p>
          </article>
        ))}
        <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-medium text-zinc-500">
            {t.decision.finalTakeaway}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <SignalBadge
              signal={analysis.signal}
              label={t.analysis.balanceTitle}
              t={t}
              className="p-1"
            />
            <span className="text-sm font-semibold capitalize text-zinc-950">
              {analysis.signal}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}

function PeerMetricRow({
  metric,
  t,
}: {
  metric: PeerMetricComparison;
  t: Dictionary;
}) {
  return (
    <tr>
      <td className="py-3 pr-4 font-semibold text-zinc-950">
        <div className="flex items-center gap-2">
          <SignalBadge
            signal={metric.signal}
            label={metric.label}
            t={t}
            className="p-1"
          />
          <span>{metric.label}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-700">
        {formatAnalysisValue(metric.companyValue, metric.unit)}
      </td>
      <td className="px-4 py-3 text-zinc-700">
        {formatAnalysisValue(metric.peerMedian, metric.unit)}
      </td>
    </tr>
  );
}

function PeerComparisonPanel({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const peerComparison = snapshot.peerComparison;

  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.peersTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.peersSubtitle}
          </p>
          <p className="mt-2 text-xs font-semibold text-zinc-600">
            {t.analysis.peerCount(peerComparison.peerCount)}
            {peerComparison.sicDescription ? ` · ${peerComparison.sicDescription}` : ""}
          </p>
        </div>
        <MeaningBadge
          Icon={Building2}
          label={t.analysis.peersTitle}
          tooltip={t.analysis.tooltips.peers}
          tone="zinc"
          tooltipAlign="right"
        />
      </div>

      {peerComparison.status === "limited" && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          {t.analysis.limitedPeerCoverage}
        </p>
      )}

      {peerComparison.metrics.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.08em] text-zinc-500">
              <tr>
                <th className="border-b border-zinc-200 py-2 pr-4 font-semibold">
                  {t.analysis.metric}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.company}
                </th>
                <th className="border-b border-zinc-200 px-4 py-2 font-semibold">
                  {t.analysis.peerMedian}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {peerComparison.metrics.map((metric) => (
                <PeerMetricRow key={metric.id} metric={metric} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          {t.analysis.noPeerMetrics}
        </p>
      )}
    </section>
  );
}

function DataQualityCheckRow({
  check,
  t,
}: {
  check: DataQualityCheck;
  t: Dictionary;
}) {
  const label = recordValue(t.analysis.checkLabels, check.id, check.label);
  const description = recordValue(
    t.analysis.checkDescriptions,
    check.id,
    check.description,
  );

  return (
    <article className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
            check.passed
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {check.passed ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-950">{label}</h4>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
        </div>
      </div>
    </article>
  );
}

function DataQualityPanel({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.analysis.dataQualityTitle}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {t.analysis.dataQualitySubtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={Database}
          label={t.analysis.dataQualityTitle}
          tooltip={t.analysis.tooltips.dataQuality}
          tone="amber"
          tooltipAlign="right"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            {t.analysis.score}
          </p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">
            {snapshot.dataQuality.score}/100
          </p>
          <div className="mt-3 flex items-center gap-2">
            <SignalBadge
              signal={snapshot.dataQuality.signal}
              label={t.analysis.confidence}
              t={t}
              className="p-1"
            />
            <span className="text-sm font-semibold text-zinc-800">
              {t.analysis.confidenceLabels[snapshot.dataQuality.label]}
            </span>
          </div>
        </article>
        <div className="grid gap-3 lg:grid-cols-2">
          {snapshot.dataQuality.checks.map((check) => (
            <DataQualityCheckRow key={check.id} check={check} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricGrid({ metrics, t }: { metrics: FinancialMetric[]; t: Dictionary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.slice(0, 10).map((metric) => {
        const metricCopy = t.metrics[metric.id as keyof typeof t.metrics];

        return (
          <article
            key={metric.id}
            className="rounded-md border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  {metricCopy?.label ?? metric.label}
                </p>
                <p className={`mt-2 text-xl font-semibold ${metricTone(metric)}`}>
                  {formatMetricValue(metric.value, metric.unit)}
                </p>
              </div>
              <SignalBadge
                signal={metric.signal}
                label={metricCopy?.label ?? metric.label}
                t={t}
                tooltipAlign="right"
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              {metricCopy?.description ?? metric.description}
            </p>
          </article>
        );
      })}
    </section>
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    function updateReady() {
      setReady((frameRef.current?.getBoundingClientRect().width ?? 0) > 0);
    }

    updateReady();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateReady);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="mt-5 h-72 min-w-0">
      {ready ? children : null}
    </div>
  );
}

function FinancialCharts({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  const chartRows = useMemo(() => makeChartRows(snapshot), [snapshot]);

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-2">
      <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">
              {t.charts.revenueNetIncome}
            </h3>
            <p className="text-sm text-zinc-500">
              {t.charts.annualFacts}
            </p>
          </div>
          <MeaningBadge
            Icon={TrendingUp}
            label={t.charts.revenueNetIncome}
            tooltip={t.charts.tooltips.revenueNetIncome}
            tone="teal"
            tooltipAlign="right"
          />
        </div>
        <ChartFrame>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={288}
            initialDimension={{ width: 1, height: 288 }}
          >
            <AreaChart data={chartRows} margin={{ left: 0, right: 12 }}>
              <defs>
                <linearGradient id="revenue" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => compactNumber(Number(value))}
              />
              <Tooltip formatter={(value) => compactCurrency(Number(value))} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0f766e"
                strokeWidth={2}
                fill="url(#revenue)"
                name={t.charts.revenue}
              />
              <Area
                type="monotone"
                dataKey="netIncome"
                stroke="#ea580c"
                strokeWidth={2}
                fill="transparent"
                name={t.charts.netIncome}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      </article>

      <article className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">
              {t.charts.cashBalance}
            </h3>
            <p className="text-sm text-zinc-500">
              {t.charts.cashBalanceSubtitle}
            </p>
          </div>
          <MeaningBadge
            Icon={Database}
            label={t.charts.cashBalance}
            tooltip={t.charts.tooltips.cashBalance}
            tone="sky"
            tooltipAlign="right"
          />
        </div>
        <ChartFrame>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={288}
            initialDimension={{ width: 1, height: 288 }}
          >
            <BarChart data={chartRows} margin={{ left: 0, right: 12 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => compactNumber(Number(value))}
              />
              <Tooltip formatter={(value) => compactCurrency(Number(value))} />
              <Bar dataKey="freeCashFlow" fill="#2563eb" name="FCF" radius={3} />
              <Bar dataKey="liabilities" fill="#f59e0b" name={t.charts.liabilities} radius={3} />
              <Bar dataKey="assets" fill="#71717a" name={t.charts.assets} radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </article>
    </section>
  );
}

function FinancialTable({
  snapshot,
  t,
}: {
  snapshot: CompanySnapshot;
  t: Dictionary;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.table.title}
          </h3>
          <p className="text-sm text-zinc-500">
            {t.table.subtitle}
          </p>
        </div>
        <MeaningBadge
          Icon={FileText}
          label={t.table.title}
          tooltip={t.table.tooltip}
          tone="zinc"
          tooltipAlign="right"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.08em] text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">{t.table.fy}</th>
              <th className="px-5 py-3 font-semibold">{t.table.revenue}</th>
              <th className="px-5 py-3 font-semibold">{t.table.grossMargin}</th>
              <th className="px-5 py-3 font-semibold">{t.table.operatingMargin}</th>
              <th className="px-5 py-3 font-semibold">{t.table.netIncome}</th>
              <th className="px-5 py-3 font-semibold">{t.table.fcf}</th>
              <th className="px-5 py-3 font-semibold">{t.table.debt}</th>
              <th className="px-5 py-3 font-semibold">{t.table.eps}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {snapshot.periods.map((period) => (
              <tr key={period.fiscalYear}>
                <td className="px-5 py-3 font-semibold text-zinc-950">
                  {period.fiscalYear}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.revenue)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {formatPercent(
                    period.grossProfit && period.revenue
                      ? period.grossProfit / period.revenue
                      : null,
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {formatPercent(
                    period.operatingIncome && period.revenue
                      ? period.operatingIncome / period.revenue
                      : null,
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.netIncome)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.freeCashFlow)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {compactCurrency(period.debt)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {period.epsDiluted ? `$${period.epsDiluted.toFixed(2)}` : "n/a"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MemoPanel({
  snapshot,
  memo,
  memoState,
  adminMemoState,
  error,
  adminError,
  onGenerate,
  onPublishPublic,
  viewer,
  t,
}: {
  snapshot: CompanySnapshot | null;
  memo: ResearchMemo | null;
  memoState: MemoState;
  adminMemoState: MemoState;
  error: string | null;
  adminError: string | null;
  onGenerate: () => void;
  onPublishPublic: () => void;
  viewer: Viewer | null;
  t: Dictionary;
}) {
  const signedIn = Boolean(viewer);
  const isAdmin = Boolean(viewer?.isAdmin);
  const title = signedIn ? t.memo.privateTitle : t.memo.publicTitle;
  const subtitle = signedIn ? t.memo.privateSubtitle : t.memo.publicSubtitle;
  const generateLabel = signedIn ? t.memo.generatePrivate : t.memo.generatePublic;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <MeaningPill
            Icon={Sparkles}
            label={t.memo.badge}
            tooltip={t.memo.badgeTooltip}
            tone="teal"
          />
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {title}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            disabled={!snapshot || memoState === "loading"}
            onClick={onGenerate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {memoState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {generateLabel}
          </button>
          {!signedIn && (
            <Link
              href="/api/auth/signin"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-teal-500 hover:text-teal-700"
            >
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              {t.memo.signInForPrivate}
            </Link>
          )}
          {isAdmin && (
            <button
              type="button"
              disabled={!snapshot || adminMemoState === "loading"}
              onClick={onPublishPublic}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:border-amber-500 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {adminMemoState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t.memo.publishPublic}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {isAdmin && (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {t.memo.adminPublishHint}
        </p>
      )}
      {adminError && (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {adminError}
        </p>
      )}

      {memo ? (
        <div className="mt-5 space-y-3">
          {memo.mode === "fallback" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t.memo.fallbackNotice}
            </div>
          )}
          {memo.sections.map((section) => (
            <article
              key={section.title}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="flex items-start gap-3">
                <SignalBadge
                  signal={section.signal ?? "neutral"}
                  label={section.title}
                  t={t}
                  className="mt-0.5 p-1.5"
                />
                <div>
                  <h4 className="font-semibold text-zinc-950">{section.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-zinc-700">
                    {section.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
          <p className="text-xs leading-5 text-zinc-500">{memo.disclaimer}</p>
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
          {t.memo.empty}
        </div>
      )}
    </section>
  );
}

function WaitlistPanel({
  snapshot,
  memo,
  locale,
  t,
}: {
  snapshot: CompanySnapshot | null;
  memo: ResearchMemo | null;
  locale: Locale;
  t: Dictionary;
}) {
  const [email, setEmail] = useState("");
  const [investorProfile, setInvestorProfile] = useState(t.waitlist.profiles[0]);
  const [interestArea, setInterestArea] = useState(t.waitlist.interests[0]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [saveState, setSaveState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const workspaceTools = [
    { Icon: Bookmark, label: t.waitlist.tools[0] },
    { Icon: Bell, label: t.waitlist.tools[1] },
    { Icon: Download, label: t.waitlist.tools[2] },
    { Icon: LockKeyhole, label: t.waitlist.tools[3] },
  ];

  async function saveResearch() {
    if (!snapshot) {
      return;
    }

    setSaveState("loading");
    setSaveMessage(null);

    try {
      const response = await fetch("/api/research/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: snapshot.identity.ticker,
          includeMemo: Boolean(memo),
          locale,
          title: `${snapshot.identity.ticker} research - ${new Date().toISOString().slice(0, 10)}`,
        }),
      });

      if (response.status === 401) {
        setSaveState("error");
        setSaveMessage(t.waitlist.signInToSave);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to save research");
      }

      setSaveState("ready");
      setSaveMessage(t.waitlist.saved);
    } catch {
      setSaveState("error");
      setSaveMessage(t.waitlist.saveFailed);
    }
  }

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          investorProfile,
          interestArea,
          sourceTicker: snapshot?.identity.ticker,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save waitlist lead");
      }

      setStatus("ready");
      setMessage(t.waitlist.joined);
      setEmail("");
    } catch {
      setStatus("error");
      setMessage(t.waitlist.joinFailed);
    }
  }

  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <MeaningPill
          Icon={Bookmark}
          label={t.waitlist.workspaceBadge}
          tooltip={t.waitlist.workspaceTooltip}
          tone="sky"
        />
        <h3 className="mt-3 text-base font-semibold text-zinc-950">
          {t.waitlist.saveResearchTitle}
        </h3>
        <div className="mt-4 grid gap-2">
          <Link
            href="/api/auth/signin"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {t.waitlist.signIn}
          </Link>
          <button
            type="button"
            disabled={!snapshot || saveState === "loading"}
            onClick={() => void saveResearch()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {saveState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
            {t.waitlist.saveResearch}
          </button>
        </div>
        {saveMessage && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              saveState === "error"
                ? "bg-amber-50 text-amber-900"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {saveMessage}
          </p>
        )}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <MeaningPill
          Icon={LockKeyhole}
          label={t.waitlist.earlyAccessBadge}
          tooltip={t.waitlist.earlyAccessTooltip}
        />
        <h3 className="mt-3 text-base font-semibold text-zinc-950">
          {t.waitlist.earlyAccessTitle}
        </h3>
        <form onSubmit={submitWaitlist} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.waitlist.emailPlaceholder}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <select
            value={investorProfile}
            onChange={(event) => setInvestorProfile(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          >
            {t.waitlist.profiles.map((profile) => (
              <option key={profile}>{profile}</option>
            ))}
          </select>
          <select
            value={interestArea}
            onChange={(event) => setInterestArea(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          >
            {t.waitlist.interests.map((interest) => (
              <option key={interest}>{interest}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {t.waitlist.join}
          </button>
        </form>
        {message && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              status === "error"
                ? "bg-rose-50 text-rose-800"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {message}
          </p>
        )}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.waitlist.toolsTitle}
          </h3>
          <MeaningBadge
            Icon={Bell}
            label={t.waitlist.toolsTitle}
            tooltip={t.waitlist.toolsTooltip}
            tone="amber"
            tooltipAlign="right"
          />
        </div>
        <div className="mt-4 space-y-3">
          {workspaceTools.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-medium text-zinc-700">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function SourcesAndCaveats({
  snapshot,
  locale,
  t,
}: {
  snapshot: CompanySnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.sources.title}
          </h3>
          <MeaningBadge
            Icon={FileText}
            label={t.sources.title}
            tooltip={t.sources.titleTooltip}
            tone="sky"
            tooltipAlign="right"
          />
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.citations.map((citation) => (
            <a
              key={`${citation.label}-${citation.url}`}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-sky-400"
            >
              <span>
                <span className="block text-sm font-semibold text-zinc-800">
                  {citation.label}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {[citation.form, citation.filedDate].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ArrowUpRight
                className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      </article>

      <article className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-950">
            {t.sources.caveatsTitle}
          </h3>
          <MeaningBadge
            Icon={AlertTriangle}
            label={t.sources.caveatsTitle}
            tooltip={t.sources.caveatsTooltip}
            tone="amber"
            tooltipAlign="right"
          />
        </div>
        <div className="mt-4 space-y-3">
          {snapshot.caveats.length ? (
            snapshot.caveats.map((caveat) => (
              <div
                key={caveat}
                className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{translateCaveat(caveat, locale)}</span>
              </div>
            ))
          ) : (
            <div className="flex gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{t.sources.coreFactsAvailable}</span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

export function FinariApp({
  locale,
  initialTicker = DEFAULT_TICKER,
}: {
  locale: Locale;
  initialTicker?: string;
}) {
  const t = getDictionary(locale);
  const normalizedInitialTicker = initialTicker.trim().toUpperCase() || DEFAULT_TICKER;
  const [query, setQuery] = useState(normalizedInitialTicker);
  const [results, setResults] = useState<CompanyIdentity[]>([]);
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState(normalizedInitialTicker);
  const [memo, setMemo] = useState<ResearchMemo | null>(null);
  const [memoState, setMemoState] = useState<MemoState>("idle");
  const [adminMemoState, setAdminMemoState] = useState<MemoState>("idle");
  const [memoError, setMemoError] = useState<string | null>(null);
  const [adminMemoError, setAdminMemoError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const loading = loadState === "loading";
  const showSearchResults =
    query.trim().length > 0 && query.trim().toUpperCase() !== activeTicker;
  const visibleResults = showSearchResults ? results : [];

  const loadCompany = useCallback(async (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    setActiveTicker(normalized);
    setQuery(normalized);
    setResults([]);
    setMemo(null);
    setMemoState("idle");
    setAdminMemoState("idle");
    setMemoError(null);
    setAdminMemoError(null);
    setLoadState("loading");
    setLoadError(null);

    try {
      const response = await fetch(`/api/company/${encodeURIComponent(normalized)}`);
      const payload = (await response.json()) as {
        snapshot?: CompanySnapshot;
        error?: string;
      };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || t.errors.loadCompany);
      }

      setSnapshot(payload.snapshot);
      setLoadState("ready");
      window.history.replaceState(null, "", `/${locale}?ticker=${normalized}`);
    } catch (error) {
      setLoadState("error");
      setLoadError(
        error instanceof Error
          ? error.message
          : t.errors.loadFacts,
      );
    }
  }, [locale, t.errors.loadCompany, t.errors.loadFacts]);

  async function generateMemo() {
    if (!snapshot) {
      return;
    }

    setMemoState("loading");
    setMemoError(null);

    try {
      const memoEndpoint = viewer
        ? `/api/me/company/${encodeURIComponent(snapshot.identity.ticker)}/memo?locale=${locale}`
        : `/api/company/${encodeURIComponent(snapshot.identity.ticker)}/memo?locale=${locale}`;
      const response = await fetch(
        memoEndpoint,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        memo?: ResearchMemo;
        error?: string;
      };

      if (!response.ok || !payload.memo) {
        throw new Error(payload.error || t.errors.generateMemo);
      }

      setMemo(payload.memo);
      setMemoState("ready");
    } catch (error) {
      setMemoState("error");
      setMemoError(
        error instanceof Error
          ? error.message
          : t.memo.error,
      );
    }
  }

  async function publishPublicMemo() {
    if (!snapshot || !viewer?.isAdmin) {
      return;
    }

    setAdminMemoState("loading");
    setAdminMemoError(null);

    try {
      const response = await fetch(
        `/api/admin/company/${encodeURIComponent(snapshot.identity.ticker)}/memo?locale=${locale}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        memo?: ResearchMemo;
        error?: string;
      };

      if (!response.ok || !payload.memo) {
        throw new Error(payload.error || t.errors.generateMemo);
      }

      setMemo(payload.memo);
      setAdminMemoState("ready");
    } catch (error) {
      setAdminMemoState("error");
      setAdminMemoError(
        error instanceof Error
          ? error.message
          : t.memo.error,
      );
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadViewer() {
      try {
        const response = await fetch("/api/me");
        const payload = (await response.json()) as { user?: Viewer | null };
        if (mounted) {
          setViewer(payload.user ?? null);
        }
      } catch {
        if (mounted) {
          setViewer(null);
        }
      }
    }

    void loadViewer();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCompany(normalizedInitialTicker);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadCompany, normalizedInitialTicker]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1 || trimmed.toUpperCase() === activeTicker) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          results?: CompanyIdentity[];
        };
        setResults(payload.results ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeTicker, query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTicker = results[0]?.ticker ?? query;
    void loadCompany(nextTicker);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-100 text-zinc-950">
      <ResearchToolbar
        locale={locale}
        t={t}
        query={query}
        setQuery={setQuery}
        results={visibleResults}
        loading={loading}
        activeTicker={activeTicker}
        onSelectTicker={(ticker) => void loadCompany(ticker)}
        onSubmit={submitSearch}
      />

      <main className="mx-auto grid min-w-0 w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <SnapshotHeader
            snapshot={snapshot}
            loading={loading}
            error={loadError}
            onRefresh={() => void loadCompany(snapshot?.identity.ticker ?? activeTicker)}
            t={t}
            locale={locale}
          />

          {snapshot && (
            <>
              <DecisionScreen snapshot={snapshot} t={t} />
              <AdvisorSummary snapshot={snapshot} t={t} />
              <QuarterlyTrendPanel snapshot={snapshot} t={t} />
              <ChangeAnalysisPanel snapshot={snapshot} locale={locale} t={t} />
              <BusinessDriversPanel snapshot={snapshot} t={t} />
              <BalanceSheetPanel snapshot={snapshot} t={t} />
              <PeerComparisonPanel snapshot={snapshot} t={t} />
              <DataQualityPanel snapshot={snapshot} t={t} />
              <MetricGrid metrics={snapshot.metrics} t={t} />
              <FinancialCharts snapshot={snapshot} t={t} />
              <FinancialTable snapshot={snapshot} t={t} />
              <MemoPanel
                snapshot={snapshot}
                memo={memo}
                memoState={memoState}
                adminMemoState={adminMemoState}
                error={memoError}
                adminError={adminMemoError}
                onGenerate={() => void generateMemo()}
                onPublishPublic={() => void publishPublicMemo()}
                viewer={viewer}
                t={t}
              />
              <SourcesAndCaveats snapshot={snapshot} locale={locale} t={t} />
            </>
          )}
        </div>

        <div className="min-w-0">
          <WaitlistPanel snapshot={snapshot} memo={memo} locale={locale} t={t} />
        </div>
      </main>
    </div>
  );
}
