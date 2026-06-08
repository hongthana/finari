import { jsonError } from "@/lib/api";
import { recordRouteActivity } from "@/lib/activity";
import { normalizeLocale } from "@/lib/i18n";
import { getPrivateResearchMemoForTicker, getStoredSnapshotForTicker } from "@/lib/research-service";
import { buildWorkspaceExportPayload } from "@/lib/research-store";
import { getCurrentUser } from "@/lib/session";
import type { WorkspaceExportPayload } from "@/lib/types";

export const runtime = "nodejs";

function toCsv(payload: WorkspaceExportPayload): string {
  const rows: Array<[string, string]> = [
    ["field", "value"],
    ["ticker", payload.ticker as string],
    ["companyName", payload.companyName as string],
    ["scope", payload.scope as string],
    ["generatedAt", payload.generatedAt],
    ["latestFiling", payload.snapshotSummary.latestFiling || ""],
    ["latestFinancialFiling", payload.snapshotSummary.latestFinancialFiling || ""],
    ["latestAnnualFiling", payload.snapshotSummary.latestAnnualFiling || ""],
    ["latestQuarterlyFiling", payload.snapshotSummary.latestQuarterlyFiling || ""],
    ["latestRevenue", String(payload.snapshotSummary.latestRevenue ?? "")],
    ["latestNetIncome", String(payload.snapshotSummary.latestNetIncome ?? "")],
    ["latestFreeCashFlow", String(payload.snapshotSummary.latestFreeCashFlow ?? "")],
    ["latestDebt", String(payload.snapshotSummary.latestDebt ?? "")],
    ["balanceSheetSignal", payload.snapshotSummary.balanceSheetSignal],
  ];

  if (payload.memo) {
    rows.push(["memoMode", payload.memo.mode]);
    rows.push(["memoDisclaimer", payload.memo.disclaimer || ""]);
    payload.memo.sections.forEach((section, index) => {
      rows.push([`memoSection${index + 1}Title`, section.title]);
      rows.push([`memoSection${index + 1}Signal`, section.signal ?? ""]);
      rows.push([`memoSection${index + 1}Body`, section.body]);
    });
  }

  return rows
    .map((row) =>
      row
        .map((value) =>
          String(value)
            .replaceAll("\\", "\\\\")
            .replaceAll('"', '""'),
        )
        .map((value) => `"${value}"`)
        .join(","),
    )
    .join("\n");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const userId = user?.id;
  if (!userId) {
    return jsonError("Authentication required", 401);
  }

  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker");
  if (!ticker) {
    return jsonError("Ticker is required", 400);
  }

  const scope = url.searchParams.get("scope") === "snapshot" ? "snapshot" : "memo";
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const locale = normalizeLocale(url.searchParams.get("locale"));

  return recordRouteActivity(
    request,
    {
      userId,
      email: user.email,
      category: "workspace",
      eventName: "workspace.export",
      ticker,
      locale,
      metadata: { scope, format },
    },
    async () => {
      try {
        const snapshot = await getStoredSnapshotForTicker(ticker);
        let memo = null;
        if (scope === "memo") {
          try {
            memo = await getPrivateResearchMemoForTicker(userId, snapshot.snapshot.identity.ticker, locale);
          } catch (error) {
            return jsonError(
              error instanceof Error
                ? error.message
                : "Unable to generate workspace memo export",
              502,
            );
          }
        }

        const payload = await buildWorkspaceExportPayload({
          scope,
          snapshot: snapshot.snapshot,
          memo: memo
            ? {
                memo: memo.memo,
                memoId: memo.memoId,
              }
            : null,
        });

        if (format === "csv") {
          const csv = toCsv(payload);
          return new Response(csv, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="finari-${snapshot.snapshot.identity.ticker.toUpperCase()}-${scope}-export.csv"`,
            },
          });
        }

        return Response.json({ payload });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Unknown ticker:")) {
          return jsonError(error.message, 404);
        }

        return jsonError(
          error instanceof Error ? error.message : "Unable to export workspace payload",
          502,
        );
      }
    },
  );
}
