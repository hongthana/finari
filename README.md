# Finari

Institutional-grade equity research for retail investors.

Finari is a Next.js MVP that helps retail investors analyze US-listed companies from SEC filings. The first version focuses on fundamentals-first ticker research, normalized SEC XBRL statement facts, filing-backed research memos, and waitlist capture for future premium workflows.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Recharts for statement visualizations
- SEC EDGAR JSON APIs for ticker mapping, submissions, and company facts
- Railway Postgres with Drizzle migrations for durable research, accounts, watchlists, saved research, and waitlist storage
- Railway Redis for short-lived SEC/search cache and refresh locks
- Vitest and Testing Library for unit, API, and UI smoke tests

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
SEC_USER_AGENT="Finari/0.1 (research app; contact=you@example.com)"
DATABASE_URL="postgres://user:password@localhost:5432/finari"
REDIS_URL="redis://localhost:6379"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
EMAIL_FROM="Finari <research@example.com>"
RESEND_API_KEY=""
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
ADMIN_EMAILS="admin@example.com"
```

`OPENAI_API_KEY` is optional. Without it, Finari returns a deterministic filing-backed memo fallback. Set `ADMIN_EMAILS` to a comma-separated list of Finari login emails that can publish canonical public memos.
`RESEND_API_KEY` is required for production magic-link email delivery.

## Development

```bash
pnpm install
pnpm db:migrate
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

## Database

Finari stores durable product data in Postgres and uses Redis only for short-lived cache/locks. The database schema is managed by Drizzle:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

On Railway, set `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` and `REDIS_URL` to `${{Redis.REDIS_URL}}`, then run `pnpm db:migrate` as the web service pre-deploy command.

## Data Scope

Finari v1 intentionally avoids live price data, valuation multiples, buy/sell recommendations, and price targets. The analysis is educational and grounded in SEC facts. Valuation and market data should be added behind a provider abstraction when a reliable quote/fundamentals provider is selected.
