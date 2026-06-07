#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_BASE_URL = process.env.FINARI_BASE_URL || "http://localhost:3000";
const DEFAULT_DELAY_MS = "3000";
const DEFAULT_MAX_FAILURES = "30";

function parseFlags(argv) {
  const args = [...argv];
  const parsed = {
    baseUrl: DEFAULT_BASE_URL,
    forwardedArgs: [...argv],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--base-url" && next && !next.startsWith("--")) {
      parsed.baseUrl = next;
    }
  }

  if (!parsed.forwardedArgs.includes("--base-url")) {
    parsed.forwardedArgs.push("--base-url", parsed.baseUrl);
  }

  if (!parsed.forwardedArgs.includes("--delay-ms")) {
    parsed.forwardedArgs.push("--delay-ms", DEFAULT_DELAY_MS);
  }

  if (!parsed.forwardedArgs.includes("--max-failures")) {
    parsed.forwardedArgs.push("--max-failures", DEFAULT_MAX_FAILURES);
  }

  return parsed;
}

function printHelp() {
  console.log(`Bootstrap Finari analyses from all S&P 500 tickers.

Usage:
  FINARI_BASE_URL=http://localhost:3000 pnpm bootstrap:sp500

Equivalent to a full S&P 500 backfill using the /api/company workflow.

Options:
  --base-url <url>        Finari app URL (defaults to FINARI_BASE_URL or http://localhost:3000).
  --limit <n>             Limit tickers for testing.
  --start-after <ticker>   Resume after a given ticker.
  --delay-ms <n>          Delay between requests (default: 3000).
  --max-failures <n>      Stop after n ticker failures (default: 30).
  --locale <locale>       th or en for event warming.
  --include-events         Also warm event impacts.
  --dry-run                Print ticker list without calls.

Tip:
  Run this with your app running and database migrations applied.
`);
}

async function ensureApiAvailable(baseUrl) {
  const response = await fetch(`${baseUrl}/api/sp500`);
  if (!response.ok) {
    throw new Error(`Finari app API is not ready at ${baseUrl} (${response.status})`);
  }
}

async function main() {
  const { baseUrl, forwardedArgs } = parseFlags(process.argv.slice(2));

  await ensureApiAvailable(baseUrl);

  const child = spawn(
    process.execPath,
    [
      `${process.cwd()}/scripts/backfill-sp500.mjs`,
      ...forwardedArgs,
    ],
    {
      stdio: "inherit",
    },
  );

  const exitCode = await new Promise((resolve, reject) => {
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", reject);
  });

  if (exitCode !== 0) {
    throw new Error(`Backfill exited with code ${exitCode}`);
  }
}

main()
  .then(() => {
    console.log("Bootstrap completed.");
  })
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: "sp500-bootstrap-error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    process.exitCode = 1;
  });
