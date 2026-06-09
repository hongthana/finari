"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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

import { compactCurrency, compactNumber } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { CompanySnapshot } from "@/lib/types";

type FinancialChartVisualsProps = {
  snapshot: CompanySnapshot;
  t: Dictionary;
  variant: "revenue-net-income" | "cash-flow";
};

function makeChartRows(snapshot: CompanySnapshot) {
  return snapshot.periods
    .slice()
    .reverse()
    .map((period) => ({
      year: String(period.fiscalYear),
      revenue: period.revenue ?? 0,
      netIncome: period.netIncome ?? 0,
      freeCashFlow: period.freeCashFlow ?? 0,
      assets: period.assets ?? 0,
      liabilities: period.liabilities ?? 0,
    }));
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

export function FinancialChartVisuals({
  snapshot,
  t,
  variant,
}: FinancialChartVisualsProps) {
  const chartRows = useMemo(() => makeChartRows(snapshot), [snapshot]);

  if (variant === "cash-flow") {
    return (
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
    );
  }

  return (
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
  );
}
