import {
  countActivityEvents,
  listActivityEvents,
  recordActivityEvent,
  summarizeActivityEvents,
  type ActivityFilters,
} from "@/lib/activity";
import { forbidden, getCurrentUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

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
    limit: Number.parseInt(url.searchParams.get("limit") ?? "50", 10),
    offset: Number.parseInt(url.searchParams.get("offset") ?? "0", 10),
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
  const [events, total, summary] = await Promise.all([
    listActivityEvents(filters),
    countActivityEvents(filters),
    summarizeActivityEvents(filters),
  ]);

  void recordActivityEvent({
    userId: user.id,
    email: user.email,
    category: "admin",
    eventName: "admin.activity.view",
    path: url.pathname,
    method: request.method,
    status: "ok",
    metadata: {
      category: filters.category,
      eventName: filters.eventName,
      ticker: filters.ticker,
      limit: filters.limit,
      offset: filters.offset,
    },
  });

  return Response.json({ events, total, summary });
}
