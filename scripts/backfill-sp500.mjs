#!/usr/bin/env node

const DEFAULT_SOURCE_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const DEFAULT_DELAY_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_BASE_URL = "http://localhost:3000";

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.FINARI_BASE_URL || DEFAULT_BASE_URL,
    cronSecret: process.env.REFRESH_CRON_SECRET || process.env.FINARI_REFRESH_SECRET || "",
    sourceUrl: process.env.SP500_SOURCE_URL || DEFAULT_SOURCE_URL,
    delayMs: Number(process.env.SP500_BACKFILL_DELAY_MS || DEFAULT_DELAY_MS),
    timeoutMs: Number(process.env.SP500_BACKFILL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    limit: undefined,
    startAfter: undefined,
    tickers: undefined,
    tickerFile: undefined,
    output: undefined,
    dryRun: false,
    includeEvents: false,
    locale: "en",
    maxFailures: 25,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--") {
      continue;
    } else if (arg === "--base-url") {
      args.baseUrl = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--source-url") {
      args.sourceUrl = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--delay-ms") {
      args.delayMs = numberValue(arg, next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = numberValue(arg, next);
      index += 1;
    } else if (arg === "--limit") {
      args.limit = numberValue(arg, next);
      index += 1;
    } else if (arg === "--cron-secret") {
      args.cronSecret = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--start-after") {
      args.startAfter = normalizeTicker(requiredValue(arg, next));
      index += 1;
    } else if (arg === "--tickers") {
      args.tickers = requiredValue(arg, next)
        .split(",")
        .map(normalizeTicker)
        .filter(Boolean);
      index += 1;
    } else if (arg === "--ticker-file") {
      args.tickerFile = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--output") {
      args.output = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--locale") {
      args.locale = requiredValue(arg, next);
      index += 1;
    } else if (arg === "--max-failures") {
      args.maxFailures = numberValue(arg, next);
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--include-events") {
      args.includeEvents = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  args.baseUrl = args.baseUrl.replace(/\/+$/, "");
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1_000) {
    throw new Error("--timeout-ms must be at least 1000");
  }
  if (!Number.isFinite(args.maxFailures) || args.maxFailures < 1) {
    throw new Error("--max-failures must be at least 1");
  }

  return args;
}

function requiredValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function numberValue(flag, value) {
  const parsed = Number(requiredValue(flag, value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a number`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Backfill Finari company research for S&P 500 constituents.

Usage:
  FINARI_BASE_URL=https://your-finari-domain.example pnpm backfill:sp500

Options:
  --base-url <url>       Finari app URL. Defaults to FINARI_BASE_URL or localhost.
  --source-url <url>     S&P 500 constituent source. Defaults to Wikipedia.
  --tickers <list>       Comma-separated ticker override, e.g. AAPL,MSFT,NVDA.
  --ticker-file <path>   Newline or comma-separated ticker file override.
  --limit <n>            Process only the first n tickers after filtering.
  --cron-secret <secret> Refresh secret used to bypass invitation gating.
  --start-after <ticker> Resume after a ticker symbol.
  --delay-ms <n>         Delay between tickers. Default: ${DEFAULT_DELAY_MS}.
  --timeout-ms <n>       Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}.
  --include-events       Also warm latest event impact cards for each ticker.
  --locale <locale>      Locale for optional event warming. Default: en.
  --output <path>        JSONL report path. Default: .data/sp500-backfill-<timestamp>.jsonl.
  --max-failures <n>     Stop after n ticker failures. Default: 25.
  --dry-run              Print ticker list without calling Finari APIs.
`);
}

function normalizeTicker(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replaceAll(".", "-");
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

async function readTickerFile(path) {
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(path, "utf8");
  return text
    .split(/[\s,]+/)
    .map(normalizeTicker)
    .filter(Boolean);
}

async function fetchSp500Tickers(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Finari S&P 500 backfill (educational research; https://finari.local)",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch S&P 500 source (${response.status})`);
  }

  const html = await response.text();
  const tableMatch = /<table[^>]+id="constituents"[\s\S]*?<\/table>/i.exec(html);
  if (!tableMatch) {
    throw new Error("Unable to find S&P 500 constituents table");
  }

  const rows = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const tickers = rows
    .map((row) => {
      const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
      return normalizeTicker(stripTags(cells[0] ?? ""));
    })
    .filter((ticker) => /^[A-Z0-9-]{1,12}$/.test(ticker) && ticker !== "SYMBOL");

  return Array.from(new Set(tickers));
}

function applyTickerWindow(tickers, args) {
  let selected = tickers;
  if (args.startAfter) {
    const startIndex = selected.indexOf(args.startAfter);
    selected = startIndex >= 0 ? selected.slice(startIndex + 1) : selected;
  }
  if (args.limit !== undefined) {
    selected = selected.slice(0, args.limit);
  }
  return selected;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      json,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function appendJsonLine(path, value) {
  const fs = await import("node:fs/promises");
  const parent = path.split("/").slice(0, -1).join("/");
  if (parent) {
    await fs.mkdir(parent, { recursive: true });
  }
  await fs.appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

function defaultOutputPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `.data/sp500-backfill-${stamp}.jsonl`;
}

function snapshotSummary(payload) {
  const snapshot = payload?.snapshot;
  return {
    ticker: snapshot?.identity?.ticker,
    cik: snapshot?.identity?.cik,
    name: snapshot?.identity?.name,
    fiscalYear: snapshot?.latestAnnualPeriod?.fiscalYear,
    annualPeriods: snapshot?.periods?.length ?? 0,
    quarterlyPeriods: snapshot?.quarterlyPeriods?.length ?? 0,
    confidence: snapshot?.dataQuality?.confidence,
    generatedAt: snapshot?.generatedAt,
  };
}

async function warmTicker(ticker, args) {
  const companyUrl = `${args.baseUrl}/api/company/${encodeURIComponent(ticker)}`;
  const requestHeaders = args.cronSecret
    ? { Authorization: `Bearer ${args.cronSecret}` }
    : {};
  const companyResult = await fetchJsonWithTimeout(
    companyUrl,
    args.timeoutMs,
    requestHeaders,
  );
  if (!companyResult.ok || !companyResult.json?.snapshot) {
    return {
      ticker,
      status: "failed",
      endpointStatus: companyResult.status,
      elapsedMs: companyResult.elapsedMs,
      error: companyResult.json?.error || "Company snapshot request failed",
    };
  }

  let events = null;
  if (args.includeEvents) {
    const eventUrl = `${args.baseUrl}/api/company/${encodeURIComponent(ticker)}/events?locale=${encodeURIComponent(args.locale)}`;
    const eventResult = await fetchJsonWithTimeout(
      eventUrl,
      args.timeoutMs,
      requestHeaders,
    );
    events = {
      ok: eventResult.ok,
      status: eventResult.status,
      count: eventResult.json?.events?.length ?? 0,
      error: eventResult.ok ? undefined : eventResult.json?.error || "Event request failed",
    };
  }

  return {
    ticker,
    status: "stored",
    endpointStatus: companyResult.status,
    elapsedMs: companyResult.elapsedMs,
    snapshot: snapshotSummary(companyResult.json),
    events,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = args.output || defaultOutputPath();
  const sourceTickers = args.tickers
    ? args.tickers
    : args.tickerFile
      ? await readTickerFile(args.tickerFile)
      : await fetchSp500Tickers(args.sourceUrl);
  const tickers = applyTickerWindow(Array.from(new Set(sourceTickers)), args);

  console.log(
    JSON.stringify({
      event: "sp500-backfill-start",
      baseUrl: args.baseUrl,
      source: args.tickers ? "args" : args.tickerFile ? args.tickerFile : args.sourceUrl,
      count: tickers.length,
      delayMs: args.delayMs,
      includeEvents: args.includeEvents,
      dryRun: args.dryRun,
      output,
    }),
  );

  if (args.dryRun) {
    console.log(tickers.join(","));
    return;
  }

  let stored = 0;
  let failed = 0;

  for (let index = 0; index < tickers.length; index += 1) {
    const ticker = tickers[index];
    const recordBase = {
      index: index + 1,
      total: tickers.length,
      ticker,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await warmTicker(ticker, args);
      const record = { ...recordBase, ...result };
      if (record.status === "stored") {
        stored += 1;
      } else {
        failed += 1;
      }
      await appendJsonLine(output, record);
      console.log(JSON.stringify(record));
    } catch (error) {
      failed += 1;
      const record = {
        ...recordBase,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
      await appendJsonLine(output, record);
      console.error(JSON.stringify(record));
    }

    if (failed >= args.maxFailures) {
      throw new Error(`Stopping after ${failed} failures`);
    }

    if (index < tickers.length - 1 && args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  console.log(
    JSON.stringify({
      event: "sp500-backfill-finished",
      total: tickers.length,
      stored,
      failed,
      output,
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: "sp500-backfill-error",
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  process.exitCode = 1;
});
