# Finari

Institutional-grade equity research for retail investors.

Finari is a Next.js MVP that helps retail investors analyze US-listed companies from SEC filings. The first version focuses on fundamentals-first ticker research, normalized SEC XBRL statement facts, filing-backed research memos, and waitlist capture for future premium workflows.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Recharts for statement visualizations
- SEC EDGAR JSON APIs for ticker mapping, submissions, and company facts
- Node built-in SQLite for local waitlist storage
- Vitest and Testing Library for unit, API, and UI smoke tests

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
SEC_USER_AGENT="Finari/0.1 (research app; contact=you@example.com)"
FINARI_DB_PATH=".data/finari.sqlite"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
```

`OPENAI_API_KEY` is optional. Without it, Finari returns a deterministic filing-backed memo fallback.

## Development

```bash
pnpm install
pnpm dev
```

The app starts on `http://localhost:3000` unless that port is occupied.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Data Scope

Finari v1 intentionally avoids live price data, valuation multiples, buy/sell recommendations, and price targets. The analysis is educational and grounded in SEC facts. Valuation and market data should be added behind a provider abstraction when a reliable quote/fundamentals provider is selected.
