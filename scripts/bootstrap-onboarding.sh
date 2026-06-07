#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${FINARI_BASE_URL:-http://localhost:3000}"
DELAY_MS="${FINARI_BACKFILL_DELAY_MS:-3000}"
MAX_FAILURES="${FINARI_BACKFILL_MAX_FAILURES:-30}"
DEV_LOG="/tmp/finari-dev.log"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL. Copy .env.local from .env.example and set DATABASE_URL first."
  exit 1
fi

echo "Installing dependencies..."
pnpm install

echo "Running database migrations..."
pnpm db:migrate

needs_shutdown="false"
if curl -fsS "$BASE_URL/api/sp500" >/dev/null 2>&1; then
  echo "Finari app is already running at $BASE_URL"
else
  echo "Starting Finari locally (running in background)..."
  pnpm dev >"$DEV_LOG" 2>&1 &
  DEV_PID=$!
  needs_shutdown="true"

  trap 'if [[ "$needs_shutdown" == "true" ]]; then
          kill "$DEV_PID" >/dev/null 2>&1 || true;
        fi' EXIT

  for _ in {1..60}; do
    if curl -fsS "$BASE_URL/api/sp500" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  if ! curl -fsS "$BASE_URL/api/sp500" >/dev/null 2>&1; then
    echo "Finari did not become ready in time. Check logs: $DEV_LOG"
    exit 1
  fi
fi

echo "Warming all S&P 500 analyses and saving to database..."
FINARI_BASE_URL="$BASE_URL" pnpm bootstrap:sp500 -- --delay-ms "$DELAY_MS" --max-failures "$MAX_FAILURES"

echo "Done."
