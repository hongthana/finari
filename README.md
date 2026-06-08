# Finari

Institutional-grade equity research for retail investors.

Finari is a ticker-first equity research platform for US-listed stocks. It turns SEC filings, normalized XBRL facts, filing metadata, source-linked event headlines, and optional AI memos into a plain-English and Thai research screen for retail investors.

The product goal is Bloomberg Terminal + Morningstar + SEC filing analysis + AI, with a consumer-simple interface. Finari is educational research software. It does not provide buy/sell recommendations, price targets, stock-price predictions, or personalized investment advice.

## Current MVP

- Public ticker research for US-listed companies.
- English and Thai locale routes at `/en` and `/th`; `/` redirects by cookie or browser language.
- SEC-backed company snapshot, latest financial filing, annual trends, quarterly/TTM trends, balance-sheet analysis, peer comparison, and data-quality caveats.
- Decision screen with strongest evidence, main risk, metric to watch, latest financial filing, and confidence label.
- Statement charts for revenue/net income, cash flow, and balance sheet.
- Latest events and potential financial impact from RSS snippets and SEC filing metadata, with provider-ready architecture.
- Public deterministic memos and event impact reads for anonymous users.
- Private AI memos and private event impact analysis for signed-in users.
- Admin-published canonical public AI memos and event impact analysis.
- Email magic-link authentication, saved research, watchlists, waitlist capture, and S&P 500 ticker selection/backfill.

## Stack

- Next.js App Router 16, React 19, TypeScript, Tailwind CSS 4
- Recharts for financial visualizations
- Auth.js / NextAuth email magic links with Drizzle adapter
- Drizzle ORM and explicit Postgres migrations
- Railway Postgres for durable application, research, event, auth, and waitlist data
- Railway Redis for short-lived cache, rate-limit state, and refresh locks
- SEC EDGAR JSON APIs for ticker mapping, submissions, and company facts
- RSS event provider by default, with environment placeholders for future licensed news providers
- OpenAI API for server-side AI generation when configured
- Vitest, Testing Library, ESLint, TypeScript, and Gitleaks

## Data Sources

Finari v1 is fundamentals-first and source-linked.

- SEC ticker mapping resolves ticker to CIK.
- SEC submissions identify filings and primary filing links.
- SEC company facts supply normalized US-GAAP financial facts.
- RSS feeds supply headline/snippet-level latest event context.
- SEC filing metadata is also treated as an event source.

Finari does not scrape full news articles. Event analysis uses only headlines, feed summaries, source metadata, SEC filing metadata, and deterministic or AI analysis grounded in those inputs.

## Product Boundaries

Finari intentionally excludes these from v1:

- Live stock prices
- Valuation multiples
- Buy/sell/hold recommendations
- Price targets
- Personalized investment advice
- Full article scraping
- User-provided OpenAI API keys or ChatGPT subscription OAuth

OpenAI usage is Finari-managed and server-side through `OPENAI_API_KEY`. Anonymous users do not trigger OpenAI spend; they receive deterministic public analysis or admin-published public AI analysis.

## Environment

Copy `.env.example` to `.env.local` and set local values:

```bash
SEC_USER_AGENT="Finari/0.1 (research app; contact=you@example.com)"
DATABASE_URL="postgres://user:password@localhost:5432/finari"
REDIS_URL="redis://localhost:6379"
NEWS_PROVIDER="rss"
NEWS_RSS_URL_TEMPLATE="https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
NEWS_API_KEY=""
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
FINARI_INVITATION_ONLY="false"
FINARI_INVITED_EMAILS=""
ALERTS_CRON_SECRET="replace-with-a-long-random-secret"
EMAIL_FROM="Finari <research@example.com>"
RESEND_API_KEY=""
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
ADMIN_EMAILS="admin@example.com"
FMP_API_KEY=""
FMP_BASE_URL="https://financialmodelingprep.com/stable"
```

Important notes:

- `SEC_USER_AGENT` should include a real contact address for SEC fair-access compliance.
- `DATABASE_URL` is required for durable data.
- `REDIS_URL` is optional for local development, but recommended for cache and lock behavior.
- `AUTH_SECRET` must be a long random value in production.
- `AUTH_URL` should match the deployed app URL in production.
- Set `FINARI_INVITATION_ONLY=true` and `FINARI_INVITED_EMAILS` to a comma-separated email allowlist to make `www.finari.co` invitation-only. `ADMIN_EMAILS` are also allowed.
- `ALERTS_CRON_SECRET` must match the GitHub Actions secret used by the scheduled alert-delivery workflow.
- `EMAIL_FROM` must use a sender domain verified by the email provider.
- `RESEND_API_KEY` is required for production magic-link delivery.
- `OPENAI_API_KEY` is optional; without it, Finari returns deterministic fallback memos and event analysis.
- `ADMIN_EMAILS` is a comma-separated list of signed-in Finari emails that can publish canonical public analysis.

## Local Development

Requirements:

- Node.js 24+
- pnpm 9+
- Postgres
- Redis, optional but recommended

Install and run:

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

The app starts on `http://localhost:3000` unless the port is occupied.

For non-technical users on Windows, macOS, or Linux who want everything ready with one command:

```bash
pnpm bootstrap:one-click
```

This single command:

1. Installs dependencies
2. Runs migrations
3. Starts Finari if not already running
4. Warm-loads all S&P 500 ticker analyses into your local database
5. Shuts down the temporary local server when done

Before running it, make sure `.env.local` is set with `DATABASE_URL` and `SEC_USER_AGENT`.

For a fully cloned repo where you want all current ticker analyses available immediately, run:

```bash
# In one terminal: start the app
pnpm dev

# In another terminal: run full S&P 500 bootstrap
pnpm bootstrap:repo
```

`bootstrap:repo` runs migrations (if needed) and then warms all S&P 500 company snapshots in a conservative pace.

## Database

The database schema is managed by Drizzle migrations in `drizzle/`.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Core durable tables include:

- Auth: `users`, `accounts`, `sessions`, `verification_tokens`, `user_profiles`
- Companies and filings: `companies`, `company_tickers`, `filings`
- Financial data: `financial_facts`, `financial_periods`
- Research: `research_snapshots`, `research_memos`, `research_refresh_runs`
- Events: `company_events`, `event_impacts`
- Product data: `watchlists`, `watchlist_items`, `saved_research`, `alert_preferences`, `alert_deliveries`, `waitlist_leads`
- Audit and cost control: `ai_usage_events`

Redis is used only for short-lived cache, rate-limit state, and refresh locks. Do not store durable research or user data in Redis.

## Railway Deployment

The intended Railway topology is:

- `web`: Next.js app
- `Postgres`: durable database
- `Redis`: cache and locks

Use Railway reference variables for private service networking:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

Recommended web service settings:

- Pre-deploy command: `pnpm db:migrate`
- Start command: `pnpm start`
- Serverless/App Sleeping can be enabled for the web service
- Postgres and Redis should remain durable infrastructure services
- Keep OpenAI, Resend, auth, and database credentials only in Railway variables

Do not commit Railway project IDs, environment IDs, service IDs, public database URLs, API keys, or tokens.

## API Surface

Public routes:

- `GET /api/search?q=`
- `GET /api/sp500`
- `GET /api/company/[ticker]`
- `GET /api/company/[ticker]/events?locale=en|th`
- `POST /api/company/[ticker]/memo?locale=en|th`
- `POST /api/waitlist`

Authenticated user routes:

- `GET /api/me`
- `POST /api/me/company/[ticker]/memo?locale=en|th`
- `POST /api/me/company/[ticker]/events/analysis?locale=en|th`
- `GET /api/research/saved`
- `POST /api/research/saved`
- `GET /api/watchlists`
- `POST /api/watchlists`
- `POST /api/watchlists/[id]/items`
- `GET /api/watchlists/[id]/items`
- `GET /api/alerts`
- `POST /api/alerts`
- `PATCH /api/alerts/[id]`
- `GET /api/alerts/deliveries`
- `PATCH /api/alerts/deliveries/[id]`
- `GET /api/valuation/[ticker]`
- `GET /api/workspace/export`

Admin routes:

- `POST /api/admin/company/[ticker]/memo?locale=en|th`
- `POST /api/admin/company/[ticker]/events/refresh?locale=en|th`
- `PATCH /api/admin/company/[ticker]/events/[eventId]`
- `POST /api/admin/alerts/deliver` (admin session or `Authorization: Bearer <ALERTS_CRON_SECRET>` for scheduled delivery)

Admin authorization is based on the signed-in user's email matching `ADMIN_EMAILS`.
The alert-delivery route also accepts the cron secret so GitHub Actions can trigger it automatically on a schedule.

## Research Backfill

Finari can warm and persist research snapshots for the current S&P 500 constituent list. The script calls the app's existing API one ticker at a time, so normal persistence stores companies, filings, normalized periods, facts, snapshots, citations, and optional event impacts.

Dry-run the ticker list:

```bash
pnpm backfill:sp500 -- --dry-run
```

Smoke-test a small run:

```bash
FINARI_BASE_URL=https://your-finari-domain.example pnpm backfill:sp500 -- --limit 5 --delay-ms 2500
```

Run the full S&P 500 backfill conservatively:

```bash
FINARI_BASE_URL=https://your-finari-domain.example pnpm backfill:sp500 -- --delay-ms 3000 --max-failures 25
```

Or use the new shorthand bootstrap script:

```bash
pnpm bootstrap:sp500
```

Run bootstrap against a deployment or different locale by passing any standard backfill flags:

```bash
FINARI_BASE_URL=https://your-finari-domain.example pnpm bootstrap:sp500 -- --locale th --include-events
```

Resume after the last successful ticker from the JSONL report:

```bash
FINARI_BASE_URL=https://your-finari-domain.example pnpm backfill:sp500 -- --start-after MSFT --delay-ms 3000
```

Useful options:

- `--include-events` also warms event impact cards.
- `--locale th` warms optional event reads in Thai.
- `--tickers AAPL,MSFT,NVDA` limits the run to explicit tickers.
- `--ticker-file ./tickers.txt` reads tickers from a file.
- `--output .data/backfill.jsonl` writes a JSONL report.

Public AI memos are not generated by the backfill script.

## Verification

Run the local verification suite before opening or merging changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Security scans:

```bash
pnpm security:secrets
pnpm security:secrets:current
```

GitHub Actions currently run:

- `ci`: lint, typecheck, tests, and build
- `Gitleaks`: full git-history and checked-out file secret scanning
- `alert-delivery`: scheduled `POST /api/admin/alerts/deliver` trigger using `ALERTS_CRON_SECRET`

For the scheduled alert-delivery workflow:

- Set the repository variable `FINARI_BASE_URL` to the deployed app URL.
- Set the repository secret `ALERTS_CRON_SECRET` to the same value used by the app runtime.

## Localization

Finari supports English and Thai.

- `/en` renders the English product experience.
- `/th` renders the Thai product experience.
- `/` redirects by saved locale preference, then browser language, then English fallback.
- Source names, company names, ticker symbols, SEC forms, filing links, and published headlines remain as source data.
- Finari-generated UI labels, summaries, deterministic analysis, fallback memos, prompts, disclaimers, and errors should be localized through `src/lib/i18n.ts`.

## Security And Public Repo Hygiene

Before making the repository public or accepting external contributions:

- Keep `.env*` files out of git.
- Keep Railway, OpenAI, Resend, database, Redis, and auth secrets only in environment variables.
- Run `pnpm security:secrets` before publishing sensitive branches.
- Keep GitHub secret scanning and Gitleaks enabled.
- Avoid hardcoding production domains, project IDs, service IDs, or private infrastructure details in docs or code.
- Review generated files before committing; browser artifacts and local `.data/` reports should not be committed.

## Contributing

This codebase uses protected `main` with pull requests and required checks. Keep changes focused, add or update tests for behavior changes, and preserve the educational research boundary: no recommendations, no price targets, and no personalized advice.
