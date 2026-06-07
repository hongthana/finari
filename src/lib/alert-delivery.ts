import crypto from "node:crypto";

import {
  getLatestStoredSnapshot,
  listEnabledAlertPreferencesForDelivery,
  markAlertPreferenceTriggered,
  recordAlertDelivery,
  updateAlertDeliveryEmailStatus,
} from "@/lib/research-store";
import type {
  AlertCondition,
  AlertDeliveryJobSummary,
  AlertType,
  CompanySnapshot,
  MetricUnit,
} from "@/lib/types";
import { sendAlertDeliveryEmail } from "@/lib/alert-email";

type AlertSeries = {
  label: string;
  unit: MetricUnit;
  currentValue: number | null;
  previousValue: number | null;
};

const ALERT_TYPE_LABELS: Record<Exclude<AlertType, "custom">, string> = {
  revenue: "Annual revenue",
  "net-income": "Annual net income",
  fcf: "Annual free cash flow",
  cash: "Annual cash",
  debt: "Annual debt",
  "working-capital": "Annual working capital",
  "debt-to-equity": "Debt / equity",
  roe: "Return on equity",
};

function isSupportedAlertType(alertType: string): alertType is Exclude<AlertType, "custom"> {
  return alertType in ALERT_TYPE_LABELS;
}

function normalizeCondition(condition: AlertCondition): string {
  switch (condition) {
    case "above":
      return "above";
    case "above-or-equal":
      return "at or above";
    case "below":
      return "below";
    case "below-or-equal":
      return "at or below";
    case "change-above":
      return "increased by more than";
    case "change-below":
      return "decreased by more than";
    default:
      return condition;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatValue(value: number | null, unit: MetricUnit): string {
  if (value === null || !Number.isFinite(value)) {
    return "unavailable";
  }

  switch (unit) {
    case "currency":
      return formatCurrency(value);
    case "percent":
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(value);
    case "ratio":
      return `${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(value)}x`;
    case "number":
    default:
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value);
  }
}

function formatThreshold(value: number, unit: MetricUnit): string {
  return formatValue(value, unit);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveAlertSeries(snapshot: CompanySnapshot, alertType: string): AlertSeries | null {
  const latestAnnual = snapshot.periods[0];
  const previousAnnual = snapshot.periods[1];

  if (!latestAnnual) {
    return null;
  }

  switch (alertType) {
    case "revenue":
      return {
        label: ALERT_TYPE_LABELS.revenue,
        unit: "currency",
        currentValue: latestAnnual.revenue ?? null,
        previousValue: previousAnnual?.revenue ?? null,
      };
    case "net-income":
      return {
        label: ALERT_TYPE_LABELS["net-income"],
        unit: "currency",
        currentValue: latestAnnual.netIncome ?? null,
        previousValue: previousAnnual?.netIncome ?? null,
      };
    case "fcf":
      return {
        label: ALERT_TYPE_LABELS.fcf,
        unit: "currency",
        currentValue: latestAnnual.freeCashFlow ?? null,
        previousValue: previousAnnual?.freeCashFlow ?? null,
      };
    case "cash":
      return {
        label: ALERT_TYPE_LABELS.cash,
        unit: "currency",
        currentValue: latestAnnual.cash ?? null,
        previousValue: previousAnnual?.cash ?? null,
      };
    case "debt":
      return {
        label: ALERT_TYPE_LABELS.debt,
        unit: "currency",
        currentValue: latestAnnual.debt ?? null,
        previousValue: previousAnnual?.debt ?? null,
      };
    case "working-capital":
      return {
        label: ALERT_TYPE_LABELS["working-capital"],
        unit: "currency",
        currentValue: latestAnnual.workingCapital ?? null,
        previousValue: previousAnnual?.workingCapital ?? null,
      };
    case "debt-to-equity": {
      const currentValue =
        latestAnnual.debt !== undefined &&
        latestAnnual.debt !== null &&
        latestAnnual.equity !== undefined &&
        latestAnnual.equity !== null &&
        latestAnnual.equity !== 0
          ? latestAnnual.debt / latestAnnual.equity
          : null;
      const previousValue =
        previousAnnual?.debt !== undefined &&
        previousAnnual?.debt !== null &&
        previousAnnual.equity !== undefined &&
        previousAnnual.equity !== null &&
        previousAnnual.equity !== 0
          ? previousAnnual.debt / previousAnnual.equity
          : null;

      return {
        label: ALERT_TYPE_LABELS["debt-to-equity"],
        unit: "ratio",
        currentValue,
        previousValue,
      };
    }
    case "roe": {
      const currentValue =
        latestAnnual.netIncome !== undefined &&
        latestAnnual.netIncome !== null &&
        latestAnnual.equity !== undefined &&
        latestAnnual.equity !== null &&
        latestAnnual.equity !== 0
          ? latestAnnual.netIncome / latestAnnual.equity
          : null;
      const previousValue =
        previousAnnual?.netIncome !== undefined &&
        previousAnnual?.netIncome !== null &&
        previousAnnual.equity !== undefined &&
        previousAnnual.equity !== null &&
        previousAnnual.equity !== 0
          ? previousAnnual.netIncome / previousAnnual.equity
          : null;

      return {
        label: ALERT_TYPE_LABELS.roe,
        unit: "percent",
        currentValue,
        previousValue,
      };
    }
    default:
      return null;
  }
}

function evaluateCondition(
  condition: AlertCondition,
  currentValue: number,
  previousValue: number | null,
  threshold: number,
): boolean {
  switch (condition) {
    case "above":
      return currentValue > threshold;
    case "above-or-equal":
      return currentValue >= threshold;
    case "below":
      return currentValue < threshold;
    case "below-or-equal":
      return currentValue <= threshold;
    case "change-above":
      return previousValue !== null && currentValue - previousValue > threshold;
    case "change-below":
      return previousValue !== null && currentValue - previousValue < threshold;
    default:
      return false;
  }
}

function buildDeliveryText(params: {
  ticker: string;
  companyName: string;
  series: AlertSeries;
  condition: AlertCondition;
  threshold: number;
  notes?: string | null;
}): { subject: string; text: string; html: string } {
  const thresholdText = formatThreshold(params.threshold, params.series.unit);
  const currentText = formatValue(params.series.currentValue, params.series.unit);
  const previousText = formatValue(params.series.previousValue, params.series.unit);
  const conditionText = normalizeCondition(params.condition);
  const subject = `${params.ticker} ${params.series.label.toLowerCase()} ${conditionText} ${thresholdText}`;
  const text = [
    `${params.companyName} (${params.ticker})`,
    `${params.series.label}: ${currentText}`,
    `Threshold: ${conditionText} ${thresholdText}`,
    `Previous annual value: ${previousText}`,
    params.notes ? `Notes: ${params.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#18181b">
      <h1 style="font-size:20px;margin:0 0 12px">Alert triggered for ${escapeHtml(params.ticker)}</h1>
      <p style="margin:0 0 12px">${escapeHtml(params.companyName)}</p>
      <ul style="padding-left:18px;margin:0 0 12px">
        <li><strong>${escapeHtml(params.series.label)}:</strong> ${escapeHtml(currentText)}</li>
        <li><strong>Threshold:</strong> ${escapeHtml(conditionText)} ${escapeHtml(thresholdText)}</li>
        <li><strong>Previous annual value:</strong> ${escapeHtml(previousText)}</li>
      </ul>
      ${
        params.notes
          ? `<p style="font-size:14px;color:#52525b;margin:0 0 12px"><strong>Notes:</strong> ${escapeHtml(params.notes)}</p>`
          : ""
      }
      <p style="font-size:12px;color:#71717a;margin:0">This alert was queued in Finari's in-app inbox.</p>
    </div>
  `;

  return { subject, text, html };
}

async function hashDeliveryKey(input: Record<string, unknown>): Promise<string> {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function runAlertDeliveryJob(): Promise<AlertDeliveryJobSummary> {
  const preferences = await listEnabledAlertPreferencesForDelivery();
  const summary: AlertDeliveryJobSummary = {
    scanned: preferences.length,
    triggered: 0,
    queued: 0,
    emailSent: 0,
    emailFailed: 0,
    skipped: 0,
    deduped: 0,
  };

  for (const preference of preferences) {
    const snapshot = await getLatestStoredSnapshot(preference.ticker);
    if (!snapshot) {
      summary.skipped += 1;
      continue;
    }

    if (!isSupportedAlertType(preference.alertType)) {
      summary.skipped += 1;
      continue;
    }

    const series = resolveAlertSeries(snapshot.snapshot, preference.alertType);
    if (!series || series.currentValue === null) {
      summary.skipped += 1;
      continue;
    }

    const shouldTrigger = evaluateCondition(
      preference.config.condition,
      series.currentValue,
      series.previousValue,
      preference.config.threshold,
    );

    if (!shouldTrigger) {
      continue;
    }

    const deliveryText = buildDeliveryText({
      ticker: preference.ticker,
      companyName: preference.companyName ?? preference.ticker,
      series,
      condition: preference.config.condition,
      threshold: preference.config.threshold,
      notes: preference.config.notes,
    });

    const dedupeKey = await hashDeliveryKey({
      alertPreferenceId: preference.id,
      sourceHash: snapshot.sourceHash,
      alertType: preference.alertType,
      condition: preference.config.condition,
      threshold: preference.config.threshold,
    });

    const created = await recordAlertDelivery({
      userId: preference.userId,
      alertPreferenceId: preference.id,
      companyId: snapshot.companyId,
      companyName: preference.companyName ?? preference.ticker,
      ticker: preference.ticker,
      alertType: preference.alertType,
      channel: "in-app",
      status: "queued",
      emailStatus: preference.email ? "queued" : "skipped",
      emailError: null,
      subject: deliveryText.subject,
      body: deliveryText.text,
      payloadJson: {
        ticker: preference.ticker,
        companyName: preference.companyName ?? preference.ticker,
        alertType: preference.alertType,
        condition: preference.config.condition,
        threshold: preference.config.threshold,
        notes: preference.config.notes ?? null,
        currentValue: series.currentValue,
        previousValue: series.previousValue,
        sourceHash: snapshot.sourceHash,
        snapshotId: snapshot.snapshotId,
      },
      dedupeKey,
      currentValue: series.currentValue,
      previousValue: series.previousValue,
      threshold: preference.config.threshold,
      condition: preference.config.condition,
      unit: series.unit,
      deliveredAt: new Date(),
    });

    if (!created) {
      summary.deduped += 1;
      continue;
    }

    await markAlertPreferenceTriggered({
      userId: preference.userId,
      alertId: preference.id,
      triggeredAt: new Date(),
    });

    summary.triggered += 1;
    summary.queued += 1;

    if (preference.email) {
      const emailResult = await sendAlertDeliveryEmail({
        to: preference.email,
        subject: deliveryText.subject,
        text: deliveryText.text,
        html: deliveryText.html,
      });

      if (emailResult.status === "sent") {
        summary.emailSent += 1;
      } else if (emailResult.status === "failed") {
        summary.emailFailed += 1;
      }

      await updateAlertDeliveryEmailStatus({
        userId: preference.userId,
        alertDeliveryId: created.id,
        emailStatus: emailResult.status,
        emailError: emailResult.errorMessage ?? null,
      });
    }
  }

  return summary;
}
