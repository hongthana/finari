import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { listTileFeedback } from "@/lib/tile-feedback";

type FeedbackPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function dateTime(value: Date | string | null): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().replace("T", " ").slice(0, 19);
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/signin?callbackUrl=/admin/feedback");
  }
  if (!user.isAdmin) {
    notFound();
  }

  const resolvedSearchParams = await searchParams ?? {};
  const ticker = firstParam(resolvedSearchParams, "ticker") || undefined;
  const tileId = firstParam(resolvedSearchParams, "tileId") || undefined;
  const feedback = await listTileFeedback({ ticker, tileId, limit: 200 });

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-medium text-teal-700">Finari admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Tile feedback
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Public improvement requests, vote counts, and captured card snapshots.
          </p>
        </header>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <form className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-zinc-600">
              Ticker
              <input
                name="ticker"
                defaultValue={ticker ?? ""}
                className="mt-1 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
              />
            </label>
            <label className="text-xs font-semibold text-zinc-600">
              Tile ID
              <input
                name="tileId"
                defaultValue={tileId ?? ""}
                className="mt-1 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-9 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
              >
                Filter
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          {feedback.length ? (
            feedback.map((item) => (
              <article
                key={item.id}
                className="rounded-md border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      {item.ticker} · {item.tileLabel}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-zinc-950">
                      {item.feedback}
                    </h2>
                    <p className="mt-2 text-xs text-zinc-500">
                      {dateTime(item.createdAt)} · {item.locale} · {item.tileId}
                    </p>
                  </div>
                  <span className="inline-flex h-8 items-center rounded-md border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-800">
                    {item.votes} votes
                  </span>
                </div>
                <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
                    Captured card snapshot
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-700">
                    {JSON.stringify(item.screenshot, null, 2)}
                  </pre>
                </details>
              </article>
            ))
          ) : (
            <p className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
              No feedback found.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
