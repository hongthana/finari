#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.FINARI_BASE_URL?.trim() || "http://localhost:3000";
const DELAY_MS = Number(process.env.FINARI_BACKFILL_DELAY_MS || 3000);
const MAX_FAILURES = Number(process.env.FINARI_BACKFILL_MAX_FAILURES || 30);
const DEV_LOG_PATH = path.join(os.tmpdir(), "finari-dev.log");
const API_HEALTH_PATH = "/api/sp500";
const MAX_WAIT_MS = 120_000;

function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: options.env ?? process.env,
    cwd: process.cwd(),
    detached: false,
  });

  return new Promise((resolve, reject) => {
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function isApiReady(url) {
  return fetch(`${url}${API_HEALTH_PATH}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
    .then((response) => response.ok)
    .catch(() => false);
}

async function waitForApp(baseUrl, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isApiReady(baseUrl)) {
      return true;
    }
    await wait(2000);
  }

  return false;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "Missing DATABASE_URL. Copy .env.local from .env.example and set DATABASE_URL first.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Installing dependencies...");
  await runCommand("pnpm", ["install"]);

  console.log("Running database migrations...");
  await runCommand("pnpm", ["db:migrate"]);

  let devServer;
  let needsShutdown = false;
  const cleanUp = () => {
    if (needsShutdown && devServer && !devServer.killed) {
      devServer.kill();
    }
  };

  process.once("exit", cleanUp);
  process.once("SIGINT", () => {
    cleanUp();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    cleanUp();
    process.exit(143);
  });

  if (!(await isApiReady(BASE_URL))) {
    console.log(`Finari app is not running. Starting local dev server at ${BASE_URL}...`);
    const log = createWriteStream(DEV_LOG_PATH, { flags: "w" });
    devServer = spawn("pnpm", ["dev"], {
      cwd: process.cwd(),
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    devServer.stdout?.pipe(log);
    devServer.stderr?.pipe(log);
    needsShutdown = true;

    devServer.on("exit", (code) => {
      if (code && code !== 0) {
        console.error(`pnpm dev exited with code ${code}`);
      }
    });

    const ready = await waitForApp(BASE_URL, MAX_WAIT_MS);
    log.end();
    if (!ready) {
      console.error(`Finari did not become ready in time. Check logs: ${DEV_LOG_PATH}`);
      process.exitCode = 1;
      return;
    }
  } else {
    console.log(`Finari app is already running at ${BASE_URL}`);
  }

  console.log("Warming all S&P 500 analyses and saving them to the database...");
  await runCommand("pnpm", [
    "bootstrap:sp500",
    "--",
    "--delay-ms",
    String(DELAY_MS),
    "--max-failures",
    String(MAX_FAILURES),
  ], {
    env: {
      ...process.env,
      FINARI_BASE_URL: BASE_URL,
    },
  });

  console.log("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
