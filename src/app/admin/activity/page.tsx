import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthSignInPage } from "@/components/auth-signin-page";
import { hasSessionCookie } from "@/lib/auth-cookies";
import type { ActivityFilters } from "@/lib/activity";

type ActivityPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function dateParam(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function filtersFromParams(
  searchParams: Record<string, string | string[] | undefined>,
): ActivityFilters {
  const status = Number.parseInt(firstParam(searchParams, "status"), 10);
  const page = Math.max(Number.parseInt(firstParam(searchParams, "page") || "1", 10), 1);
  const limit = 50;

  return {
    userId: firstParam(searchParams, "userId") || undefined,
    email: firstParam(searchParams, "email") || undefined,
    category: firstParam(searchParams, "category") || undefined,
    eventName: firstParam(searchParams, "eventName") || undefined,
    path: firstParam(searchParams, "path") || undefined,
    ticker: firstParam(searchParams, "ticker") || undefined,
    status: Number.isFinite(status) ? status : undefined,
    from: dateParam(firstParam(searchParams, "from")),
    to: dateParam(firstParam(searchParams, "to")),
    limit,
    offset: (page - 1) * limit,
  };
}

function searchLink(
  searchParams: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | number | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(searchParams)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) {
      params.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return `/admin/activity${query ? `?${query}` : ""}`;
}

function exportLink(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(searchParams)) {
    if (key === "page") {
      continue;
    }
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return `/api/admin/activity/export${query ? `?${query}` : ""}`;
}

function dateTime(value: Date | string | null): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().replace("T", " ").slice(0, 19);
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const user = (await hasSessionCookie())
    ? await (await import("@/lib/session")).getCurrentUser()
    : null;
  if (!user) {
    return <AuthSignInPage callbackUrl="/admin/activity" />;
  }
  if (!user.isAdmin) {
    notFound();
  }

  const resolvedSearchParams = await searchParams ?? {};
  const filters = filtersFromParams(resolvedSearchParams);
  const currentPage = Math.max(
    Number.parseInt(firstParam(resolvedSearchParams, "page") || "1", 10),
    1,
  );
  const {
    countActivityEvents,
    listActivityEvents,
    summarizeActivityEvents,
  } = await import("@/lib/activity");
  const [events, total, summary] = await Promise.all([
    listActivityEvents(filters),
    countActivityEvents(filters),
    summarizeActivityEvents(filters),
  ]);
  const pageCount = Math.max(Math.ceil(total / (filters.limit ?? 50)), 1);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">Finari admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              User activity
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Privacy-minimized auth, API, workspace, and client clickstream events.
            </p>
          </div>
          <a
            href={exportLink(resolvedSearchParams)}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white"
          >
            Export CSV
          </a>
        </header>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            {[
              ["email", "Email"],
              ["category", "Category"],
              ["eventName", "Event"],
              ["ticker", "Ticker"],
              ["path", "Path"],
              ["status", "Status"],
              ["from", "From"],
              ["to", "To"],
            ].map(([name, label]) => (
              <label key={name} className="text-xs font-semibold text-zinc-600">
                {label}
                <input
                  name={name}
                  defaultValue={firstParam(resolvedSearchParams, name)}
                  className="mt-1 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
                />
              </label>
            ))}
            <div className="flex items-end gap-2 md:col-span-2">
              <button
                type="submit"
                className="h-9 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
              >
                Filter
              </button>
              <Link
                href="/admin/activity"
                className="inline-flex h-9 items-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-800"
              >
                Clear
              </Link>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Events</p>
            <p className="mt-2 text-3xl font-semibold">{total}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white p-4 md:col-span-2">
            <p className="text-xs font-semibold uppercase text-zinc-500">By category</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.byCategory.length ? (
                summary.byCategory.map((item) => (
                  <span
                    key={item.category}
                    className="rounded-md bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
                  >
                    {item.category}: {item.total}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-500">No events</span>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-base font-semibold">Recent events</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ticker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                      {dateTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {event.userEmail ?? event.userId ?? event.emailHash ?? "anonymous"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{event.eventName}</p>
                      <p className="text-xs text-zinc-500">{event.category}</p>
                    </td>
                    <td className="max-w-sm truncate px-4 py-3 text-zinc-600">
                      {[event.method, event.path].filter(Boolean).join(" ")}
                    </td>
                    <td className="px-4 py-3">{event.status ?? ""}</td>
                    <td className="px-4 py-3">{event.ticker ?? ""}</td>
                  </tr>
                ))}
                {!events.length && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-500" colSpan={6}>
                      No matching activity events.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 p-4 text-sm">
            <span>
              Page {currentPage} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Link
                href={searchLink(resolvedSearchParams, { page: Math.max(currentPage - 1, 1) })}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700"
              >
                Previous
              </Link>
              <Link
                href={searchLink(resolvedSearchParams, { page: Math.min(currentPage + 1, pageCount) })}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700"
              >
                Next
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <h2 className="text-base font-semibold">Recent failures</h2>
          <div className="mt-3 grid gap-2">
            {summary.recentFailures.length ? (
              summary.recentFailures.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-1 rounded-md border border-rose-100 bg-rose-50 p-3 text-sm sm:grid-cols-[160px_1fr_80px]"
                >
                  <span className="text-rose-900">{dateTime(event.createdAt)}</span>
                  <span className="font-medium text-rose-950">{event.eventName}</span>
                  <span className="text-rose-800">{event.status}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No recent failed activity events.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
