"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bookmark,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Languages,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
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
  CompanyIdentity,
  CompanySnapshot,
  FinancialMetric,
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

function signalIcon(signal: TrendSignal) {
  if (signal === "positive") {
    return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  }

  if (signal === "negative") {
    return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  }

  return <ShieldCheck className="h-4 w-4" aria-hidden="true" />;
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
      signal: metricSignal(snapshot, "revenue-growth"),
    },
    {
      title: t.advisor.readLabels.quality,
      body: qualityRead(snapshot, t),
      signal: metricSignal(snapshot, "operating-margin"),
    },
    {
      title: t.advisor.readLabels.balance,
      body: balanceSheetRead(snapshot, t),
      signal: metricSignal(snapshot, "liabilities-to-assets"),
    },
    {
      title: t.advisor.readLabels.decision,
      body: decisionTakeaway(snapshot, t),
      signal: "neutral" as const,
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
          <div className="inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t.advisor.badge}
          </div>
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
                  <span
                    className={`mt-0.5 inline-flex shrink-0 rounded-md border p-1.5 ${signalClasses(read.signal)}`}
                  >
                    {signalIcon(read.signal)}
                  </span>
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
                  <span
                    className={`mt-0.5 inline-flex shrink-0 rounded-md border p-1 ${signalClasses(item.signal)}`}
                  >
                    {signalIcon(item.signal)}
                  </span>
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
          <h2 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
            {snapshot.identity.name}
          </h2>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            {snapshot.identity.ticker} · CIK {snapshot.identity.cik}
            {latest?.fiscalYear
              ? ` · ${t.snapshot.fiscalYear} ${latest.fiscalYear}`
              : ""}
          </p>
        </div>

        <div className="grid min-w-0 max-w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[520px] xl:shrink-0">
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">{t.snapshot.revenue}</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {compactCurrency(latest?.revenue)}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">{t.snapshot.netIncome}</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {compactCurrency(latest?.netIncome)}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">{t.snapshot.fcf}</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {compactCurrency(latest?.freeCashFlow)}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">{t.snapshot.assets}</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {compactCurrency(latest?.assets)}
            </p>
          </div>
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
        {snapshot.latestFiling?.url && (
          <a
            href={snapshot.latestFiling.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-700 transition hover:border-sky-500 hover:text-sky-700"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t.snapshot.latestFiling}
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

function MetricGrid({ metrics, t }: { metrics: FinancialMetric[]; t: Dictionary }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.slice(0, 10).map((metric) => (
        <article
          key={metric.id}
          className="rounded-md border border-zinc-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">
                {t.metrics[metric.id as keyof typeof t.metrics]?.label ?? metric.label}
              </p>
              <p className={`mt-2 text-xl font-semibold ${metricTone(metric)}`}>
                {formatMetricValue(metric.value, metric.unit)}
              </p>
            </div>
            <span
              className={`inline-flex rounded-md border p-1.5 ${signalClasses(metric.signal)}`}
              aria-label={metric.signal}
            >
              {signalIcon(metric.signal)}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            {t.metrics[metric.id as keyof typeof t.metrics]?.description ??
              metric.description}
          </p>
        </article>
      ))}
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
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            {t.charts.cashBalance}
          </h3>
          <p className="text-sm text-zinc-500">
            {t.charts.cashBalanceSubtitle}
          </p>
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
      <div className="border-b border-zinc-200 px-5 py-4">
        <h3 className="text-base font-semibold text-zinc-950">
          {t.table.title}
        </h3>
        <p className="text-sm text-zinc-500">
          {t.table.subtitle}
        </p>
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
          <div className="inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t.memo.badge}
          </div>
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
                <span
                  className={`mt-0.5 inline-flex rounded-md border p-1.5 ${signalClasses(section.signal ?? "neutral")}`}
                >
                  {signalIcon(section.signal ?? "neutral")}
                </span>
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
        <div className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          {t.waitlist.workspaceBadge}
        </div>
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
        <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          {t.waitlist.earlyAccessBadge}
        </div>
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
        <h3 className="text-base font-semibold text-zinc-950">
          {t.waitlist.toolsTitle}
        </h3>
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
        <h3 className="text-base font-semibold text-zinc-950">{t.sources.title}</h3>
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
        <h3 className="text-base font-semibold text-zinc-950">
          {t.sources.caveatsTitle}
        </h3>
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
              <AdvisorSummary snapshot={snapshot} t={t} />
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
