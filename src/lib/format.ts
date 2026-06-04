export function compactCurrency(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) {
    return "n/a";
  }

  const absValue = Math.abs(value as number);
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: absValue >= 1_000_000_000 ? 1 : 0,
    notation: "compact",
    compactDisplay: "short",
  });

  return `$${formatter.format(value as number)}`;
}

export function compactNumber(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: "compact",
    compactDisplay: "short",
  }).format(value as number);
}

export function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value as number);
}

export function formatRatio(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value as number);
}

export function formatMetricValue(
  value: number | null | undefined,
  unit: "currency" | "percent" | "ratio" | "number",
): string {
  if (unit === "currency") {
    return compactCurrency(value);
  }

  if (unit === "percent") {
    return formatPercent(value);
  }

  if (unit === "ratio") {
    return formatRatio(value);
  }

  return compactNumber(value);
}
