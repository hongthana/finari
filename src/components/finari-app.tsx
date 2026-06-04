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
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
import type {
  CompanyIdentity,
  CompanySnapshot,
  FinancialMetric,
  ResearchMemo,
  TrendSignal,
} from "@/lib/types";

type LoadState = "idle" | "loading" | "ready" | "error";
type MemoState = "idle" | "loading" | "ready" | "error";

const STARTER_TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "META"];

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

function describeChange(label: string, value: number | null): string {
  if (!hasNumber(value)) {
    return `${label} did not have a comparable prior-year figure in the normalized filing data`;
  }

  if (Math.abs(value) < 0.005) {
    return `${label} was roughly flat year over year`;
  }

  const direction = value > 0 ? "increased" : "declined";
  return `${label} ${direction} ${formatPercent(Math.abs(value))} year over year`;
}

function qualityRead(snapshot: CompanySnapshot): string {
  const grossMargin = metricValue(snapshot, "gross-margin");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const fcfMargin = metricValue(snapshot, "free-cash-flow-margin");

  const marginParts = [
    hasNumber(grossMargin) ? `gross margin was ${formatPercent(grossMargin)}` : null,
    hasNumber(operatingMargin)
      ? `operating margin was ${formatPercent(operatingMargin)}`
      : null,
  ].filter(Boolean);

  let cashRead = "free-cash-flow conversion needs more review";
  if (hasNumber(fcfMargin)) {
    if (fcfMargin >= 0.15) {
      cashRead = `free-cash-flow conversion was strong at ${formatPercent(fcfMargin)} of revenue`;
    } else if (fcfMargin >= 0.05) {
      cashRead = `free-cash-flow conversion was positive at ${formatPercent(fcfMargin)} of revenue`;
    } else if (fcfMargin >= 0) {
      cashRead = `free-cash-flow conversion was thin at ${formatPercent(fcfMargin)} of revenue`;
    } else {
      cashRead = `free cash flow was negative at ${formatPercent(fcfMargin)} of revenue`;
    }
  }

  return `${marginParts.length ? `${marginParts.join(" and ")}; ` : ""}${cashRead}.`;
}

function balanceSheetRead(snapshot: CompanySnapshot): string {
  const debtToEquity = metricValue(snapshot, "debt-to-equity");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");

  if (!hasNumber(debtToEquity) && !hasNumber(liabilitiesToAssets)) {
    return "Balance-sheet leverage was not fully available from standard SEC tags.";
  }

  const leverageText = [
    hasNumber(debtToEquity)
      ? `debt/equity was ${formatMetricValue(debtToEquity, "ratio")}`
      : null,
    hasNumber(liabilitiesToAssets)
      ? `liabilities/assets was ${formatPercent(liabilitiesToAssets)}`
      : null,
  ].filter(Boolean);

  const elevated =
    (hasNumber(debtToEquity) && debtToEquity > 1) ||
    (hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7);

  return `${leverageText.join(" and ")}; ${
    elevated
      ? "an advisor would ask how much flexibility the balance sheet provides if demand weakens."
      : "the balance sheet does not screen as the first concern from these filing metrics."
  }`;
}

function advisorQuestions(snapshot: CompanySnapshot): string[] {
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");
  const operatingMargin = metricValue(snapshot, "operating-margin");
  const liabilitiesToAssets = metricValue(snapshot, "liabilities-to-assets");

  const questions = [
    hasNumber(revenueGrowth) && revenueGrowth < -0.005
      ? "What evidence could reverse the latest revenue decline?"
      : "Can revenue growth continue without weakening margins?",
    hasNumber(netIncomeGrowth) && netIncomeGrowth < -0.005
      ? "Is lower net income temporary, or is profitability structurally softer?"
      : "Are earnings gains backed by durable operations rather than one-time items?",
    hasNumber(operatingMargin) && operatingMargin > 0.15
      ? "How defensible are these operating margins against competition and pricing pressure?"
      : "What operating leverage could improve margins from here?",
  ];

  if (hasNumber(liabilitiesToAssets) && liabilitiesToAssets > 0.7) {
    questions.push("Does the company have enough balance-sheet flexibility for a downturn?");
  }

  questions.push("Does the current market price already reflect these fundamentals?");
  return questions.slice(0, 4);
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

function AdvisorSummary({ snapshot }: { snapshot: CompanySnapshot }) {
  const latest = snapshot.periods[0];
  const revenueGrowth = metricValue(snapshot, "revenue-growth");
  const netIncomeGrowth = metricValue(snapshot, "net-income-growth");
  const questions = advisorQuestions(snapshot);

  return (
    <section className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex min-w-0 max-w-full flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 max-w-full xl:max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Advisor summary
          </div>
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            What the latest filing says
          </h3>
          <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
            A financial advisor would separate business quality from stock price.
            {` ${snapshot.identity.name} generated ${compactCurrency(latest?.revenue)} of revenue, ${compactCurrency(latest?.netIncome)} of net income, and ${compactCurrency(latest?.freeCashFlow)} of free cash flow in FY ${latest?.fiscalYear ?? "the latest annual period"}. `}
            {describeChange("Revenue", revenueGrowth)} and{" "}
            {describeChange("net income", netIncomeGrowth)}.
          </p>
          <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
            {qualityRead(snapshot)} {balanceSheetRead(snapshot)} This is a
            research starting point, not a buy/sell recommendation; valuation,
            risk tolerance, and portfolio fit still need separate review.
          </p>
        </div>

        <div className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-zinc-50 p-4 xl:w-80 xl:shrink-0">
          <h4 className="text-sm font-semibold text-zinc-950">
            Investor questions
          </h4>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-700">
            {questions.map((question) => (
              <li key={question} className="flex min-w-0 gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" />
                <span className="min-w-0 break-words">{question}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ResearchToolbar({
  query,
  setQuery,
  results,
  loading,
  onSelectTicker,
  onSubmit,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: CompanyIdentity[];
  loading: boolean;
  onSelectTicker: (ticker: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
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
                  Finari
                </p>
                <h1 className="text-xl font-semibold tracking-normal text-zinc-950 sm:text-2xl">
                  Institutional-grade equity research for retail investors
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600">
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <Database className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
              SEC-backed
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-700"
                aria-hidden="true"
              />
              Education only
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
              placeholder="Search ticker or company, e.g. AAPL"
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
              Research
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
}: {
  snapshot: CompanySnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  if (loading && !snapshot) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3 text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading SEC filings and normalized company facts...
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
            <h2 className="font-semibold">Research unavailable</h2>
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
              {snapshot.identity.exchange || "US listed"}
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
            {latest?.fiscalYear ? ` · FY ${latest.fiscalYear}` : ""}
          </p>
        </div>

        <div className="grid min-w-0 max-w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[520px] xl:shrink-0">
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">Revenue</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {compactCurrency(latest?.revenue)}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">Net income</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {compactCurrency(latest?.netIncome)}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">FCF</p>
            <p className="mt-1 break-words text-lg font-semibold text-zinc-950">
              {compactCurrency(latest?.freeCashFlow)}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-500">Assets</p>
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
          Refresh
        </button>
        {snapshot.latestFiling?.url && (
          <a
            href={snapshot.latestFiling.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 font-semibold text-zinc-700 transition hover:border-sky-500 hover:text-sky-700"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Latest filing
          </a>
        )}
        <span className="text-xs font-medium text-zinc-500">
          Generated {new Date(snapshot.generatedAt).toLocaleString()}
        </span>
      </div>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: FinancialMetric[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.slice(0, 10).map((metric) => (
        <article
          key={metric.id}
          className="rounded-md border border-zinc-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">{metric.label}</p>
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
            {metric.description}
          </p>
        </article>
      ))}
    </section>
  );
}

function FinancialCharts({ snapshot }: { snapshot: CompanySnapshot }) {
  const chartRows = useMemo(() => makeChartRows(snapshot), [snapshot]);

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-950">
              Revenue and net income
            </h3>
            <p className="text-sm text-zinc-500">
              Annual SEC XBRL facts by fiscal year
            </p>
          </div>
        </div>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
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
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="netIncome"
                stroke="#ea580c"
                strokeWidth={2}
                fill="transparent"
                name="Net income"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-md border border-zinc-200 bg-white p-5">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            Cash flow and balance sheet
          </h3>
          <p className="text-sm text-zinc-500">
            Free cash flow, assets, and liabilities
          </p>
        </div>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
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
              <Bar dataKey="liabilities" fill="#f59e0b" name="Liabilities" radius={3} />
              <Bar dataKey="assets" fill="#71717a" name="Assets" radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}

function FinancialTable({ snapshot }: { snapshot: CompanySnapshot }) {
  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h3 className="text-base font-semibold text-zinc-950">
          Annual statement screen
        </h3>
        <p className="text-sm text-zinc-500">
          Values are normalized from standard SEC XBRL tags.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.08em] text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">FY</th>
              <th className="px-5 py-3 font-semibold">Revenue</th>
              <th className="px-5 py-3 font-semibold">Gross margin</th>
              <th className="px-5 py-3 font-semibold">Op margin</th>
              <th className="px-5 py-3 font-semibold">Net income</th>
              <th className="px-5 py-3 font-semibold">FCF</th>
              <th className="px-5 py-3 font-semibold">Debt</th>
              <th className="px-5 py-3 font-semibold">EPS</th>
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
  error,
  onGenerate,
}: {
  snapshot: CompanySnapshot | null;
  memo: ResearchMemo | null;
  memoState: MemoState;
  error: string | null;
  onGenerate: () => void;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Filing-backed memo
          </div>
          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            Analyst memo
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Grounded in normalized SEC facts and source links.
          </p>
        </div>
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
          Generate memo
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {memo ? (
        <div className="mt-5 space-y-3">
          {memo.mode === "fallback" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Deterministic memo shown because AI is not configured or is unavailable.
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
          Select a company and generate a memo to see the research narrative.
        </div>
      )}
    </section>
  );
}

function WaitlistPanel({
  snapshot,
  memo,
}: {
  snapshot: CompanySnapshot | null;
  memo: ResearchMemo | null;
}) {
  const [email, setEmail] = useState("");
  const [investorProfile, setInvestorProfile] = useState("Long-term individual investor");
  const [interestArea, setInterestArea] = useState("Saved research and alerts");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [saveState, setSaveState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
          title: `${snapshot.identity.ticker} research - ${new Date().toISOString().slice(0, 10)}`,
        }),
      });

      if (response.status === 401) {
        setSaveState("error");
        setSaveMessage("Sign in with email to save this research.");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to save research");
      }

      setSaveState("ready");
      setSaveMessage("Research saved to your Finari workspace.");
    } catch {
      setSaveState("error");
      setSaveMessage("This research could not be saved right now.");
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
      setMessage("You are on the Finari early-access list.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("That email could not be saved. Check it and try again.");
    }
  }

  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <div className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          Workspace
        </div>
        <h3 className="mt-3 text-base font-semibold text-zinc-950">
          Save company research
        </h3>
        <div className="mt-4 grid gap-2">
          <Link
            href="/api/auth/signin"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-teal-500 hover:text-teal-700"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Sign in
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
            Save research
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
          Early access
        </div>
        <h3 className="mt-3 text-base font-semibold text-zinc-950">
          Save research, alerts, and exports
        </h3>
        <form onSubmit={submitWaitlist} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          <select
            value={investorProfile}
            onChange={(event) => setInvestorProfile(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          >
            <option>Long-term individual investor</option>
            <option>Active retail investor</option>
            <option>Student or learner</option>
            <option>Advisor or analyst</option>
          </select>
          <select
            value={interestArea}
            onChange={(event) => setInterestArea(event.target.value)}
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          >
            <option>Saved research and alerts</option>
            <option>Memo exports</option>
            <option>Advanced valuation</option>
            <option>Portfolio watchlist</option>
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
            Join waitlist
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
        <h3 className="text-base font-semibold text-zinc-950">Workspace tools</h3>
        <div className="mt-4 space-y-3">
          {[
            [Bookmark, "Saved company research"],
            [Bell, "Filing and metric alerts"],
            [Download, "Exportable investment memos"],
            [LockKeyhole, "Valuation provider integration"],
          ].map(([Icon, label]) => (
            <div key={label as string} className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-medium text-zinc-700">{label as string}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function SourcesAndCaveats({ snapshot }: { snapshot: CompanySnapshot }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-md border border-zinc-200 bg-white p-5">
        <h3 className="text-base font-semibold text-zinc-950">Source links</h3>
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
          Normalization caveats
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
                <span>{caveat}</span>
              </div>
            ))
          ) : (
            <div className="flex gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>Core annual facts were available in standard SEC tags.</span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

export function FinariApp() {
  const [query, setQuery] = useState("AAPL");
  const [results, setResults] = useState<CompanyIdentity[]>([]);
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState("AAPL");
  const [memo, setMemo] = useState<ResearchMemo | null>(null);
  const [memoState, setMemoState] = useState<MemoState>("idle");
  const [memoError, setMemoError] = useState<string | null>(null);

  const loading = loadState === "loading";
  const showSearchResults =
    query.trim().length > 0 && query.trim().toUpperCase() !== activeTicker;
  const visibleResults = showSearchResults ? results : [];

  async function loadCompany(ticker: string) {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    setActiveTicker(normalized);
    setQuery(normalized);
    setResults([]);
    setMemo(null);
    setMemoState("idle");
    setMemoError(null);
    setLoadState("loading");
    setLoadError(null);

    try {
      const response = await fetch(`/api/company/${encodeURIComponent(normalized)}`);
      const payload = (await response.json()) as {
        snapshot?: CompanySnapshot;
        error?: string;
      };

      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || "Unable to load company");
      }

      setSnapshot(payload.snapshot);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load SEC company facts right now",
      );
    }
  }

  async function generateMemo() {
    if (!snapshot) {
      return;
    }

    setMemoState("loading");
    setMemoError(null);

    try {
      const response = await fetch(
        `/api/company/${encodeURIComponent(snapshot.identity.ticker)}/memo`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        memo?: ResearchMemo;
        error?: string;
      };

      if (!response.ok || !payload.memo) {
        throw new Error(payload.error || "Unable to generate memo");
      }

      setMemo(payload.memo);
      setMemoState("ready");
    } catch (error) {
      setMemoState("error");
      setMemoError(
        error instanceof Error
          ? error.message
          : "Unable to generate a research memo right now",
      );
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCompany("AAPL");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

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
        query={query}
        setQuery={setQuery}
        results={visibleResults}
        loading={loading}
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
          />

          {snapshot && (
            <>
              <AdvisorSummary snapshot={snapshot} />
              <MetricGrid metrics={snapshot.metrics} />
              <FinancialCharts snapshot={snapshot} />
              <FinancialTable snapshot={snapshot} />
              <MemoPanel
                snapshot={snapshot}
                memo={memo}
                memoState={memoState}
                error={memoError}
                onGenerate={() => void generateMemo()}
              />
              <SourcesAndCaveats snapshot={snapshot} />
            </>
          )}
        </div>

        <div className="min-w-0">
          <WaitlistPanel snapshot={snapshot} memo={memo} />
        </div>
      </main>
    </div>
  );
}
