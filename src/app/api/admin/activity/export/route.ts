import { exportActivityEvents, recordActivityEvent, type ActivityFilters } from "@/lib/activity";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

function csvValue(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function dateParam(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function filtersFromUrl(url: URL): ActivityFilters {
  const status = Number.parseInt(url.searchParams.get("status") ?? "", 10);
  return {
    userId: url.searchParams.get("userId")?.trim() || undefined,
    email: url.searchParams.get("email")?.trim() || undefined,
    category: url.searchParams.get("category")?.trim() || undefined,
    eventName: url.searchParams.get("eventName")?.trim() || undefined,
    path: url.searchParams.get("path")?.trim() || undefined,
    ticker: url.searchParams.get("ticker")?.trim() || undefined,
    status: Number.isFinite(status) ? status : undefined,
    from: dateParam(url.searchParams.get("from")),
    to: dateParam(url.searchParams.get("to")),
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }
  if (!user.isAdmin) {
    return forbidden();
  }

  const url = new URL(request.url);
  const filters = filtersFromUrl(url);
  const rows = await exportActivityEvents(filters);
  const csv = [
    [
      "id",
      "createdAt",
      "userId",
      "userEmail",
      "category",
      "eventName",
      "method",
      "path",
      "status",
      "locale",
      "ticker",
      "durationMs",
    ].map(csvValue).join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        row.userId,
        row.userEmail,
        row.category,
        row.eventName,
        row.method,
        row.path,
        row.status,
        row.locale,
        row.ticker,
        row.durationMs,
      ].map(csvValue).join(","),
    ),
  ].join("\n");

  void recordActivityEvent({
    userId: user.id,
    email: user.email,
    category: "admin",
    eventName: "admin.activity.export",
    path: url.pathname,
    method: request.method,
    status: "ok",
    metadata: { rowCount: rows.length },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"finari-activity.csv\"",
    },
  });
}
