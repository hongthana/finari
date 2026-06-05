import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
    userIdx: index("accounts_user_id_idx").on(table.userId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    userIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  investorProfile: text("investor_profile"),
  experienceLevel: text("experience_level"),
  preferencesJson: jsonb("preferences_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cik: text("cik").notNull(),
    legalName: text("legal_name").notNull(),
    sic: text("sic"),
    sicDescription: text("sic_description"),
    fiscalYearEnd: text("fiscal_year_end"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cikIdx: uniqueIndex("companies_cik_idx").on(table.cik),
  }),
);

export const companyTickers = pgTable(
  "company_tickers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    ticker: text("ticker").notNull(),
    exchange: text("exchange"),
    isActive: boolean("is_active").default(true).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    activeTickerIdx: uniqueIndex("company_tickers_active_ticker_idx")
      .on(table.ticker)
      .where(sql`${table.isActive} = true`),
    companyTickerIdx: uniqueIndex("company_tickers_company_ticker_idx").on(
      table.companyId,
      table.ticker,
    ),
    companyIdx: index("company_tickers_company_id_idx").on(table.companyId),
  }),
);

export const filings = pgTable(
  "filings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    accessionNumber: text("accession_number").notNull(),
    form: text("form").notNull(),
    filingDate: timestamp("filing_date", { withTimezone: true, mode: "string" }),
    reportDate: timestamp("report_date", { withTimezone: true, mode: "string" }),
    primaryDocumentUrl: text("primary_document_url"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accessionIdx: uniqueIndex("filings_accession_number_idx").on(table.accessionNumber),
    companyFilingDateIdx: index("filings_company_filing_date_idx").on(
      table.companyId,
      table.filingDate,
    ),
  }),
);

export const financialPeriods = pgTable(
  "financial_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fiscalYear: integer("fiscal_year").notNull(),
    periodType: text("period_type").default("annual").notNull(),
    fiscalPeriod: text("fiscal_period").default("FY").notNull(),
    periodStartDate: timestamp("period_start_date", { withTimezone: true, mode: "string" }),
    periodEndDate: timestamp("period_end_date", { withTimezone: true, mode: "string" }),
    sourceFilingId: uuid("source_filing_id").references(() => filings.id, { onDelete: "set null" }),
    revenue: doublePrecision("revenue"),
    grossProfit: doublePrecision("gross_profit"),
    operatingIncome: doublePrecision("operating_income"),
    netIncome: doublePrecision("net_income"),
    assets: doublePrecision("assets"),
    liabilities: doublePrecision("liabilities"),
    currentAssets: doublePrecision("current_assets"),
    currentLiabilities: doublePrecision("current_liabilities"),
    workingCapital: doublePrecision("working_capital"),
    equity: doublePrecision("equity"),
    cash: doublePrecision("cash"),
    debt: doublePrecision("debt"),
    operatingCashFlow: doublePrecision("operating_cash_flow"),
    capitalExpenditure: doublePrecision("capital_expenditure"),
    freeCashFlow: doublePrecision("free_cash_flow"),
    researchAndDevelopment: doublePrecision("research_and_development"),
    sellingGeneralAdministrative: doublePrecision("selling_general_administrative"),
    buybacks: doublePrecision("buybacks"),
    dividends: doublePrecision("dividends"),
    epsDiluted: doublePrecision("eps_diluted"),
    sharesDiluted: doublePrecision("shares_diluted"),
    caveatsJson: jsonb("caveats_json").$type<string[]>().default([]).notNull(),
    sourceHash: text("source_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyPeriodIdx: uniqueIndex("financial_periods_company_period_idx").on(
      table.companyId,
      table.periodType,
      table.fiscalYear,
      table.fiscalPeriod,
    ),
    companyFiscalYearIdx: index("financial_periods_company_fiscal_year_idx").on(
      table.companyId,
      table.periodType,
      table.fiscalYear,
    ),
  }),
);

export const financialFacts = pgTable(
  "financial_facts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    filingId: uuid("filing_id").references(() => filings.id, { onDelete: "set null" }),
    fiscalYear: integer("fiscal_year").notNull(),
    periodType: text("period_type").default("annual").notNull(),
    fiscalPeriod: text("fiscal_period").default("FY").notNull(),
    periodStartDate: timestamp("period_start_date", { withTimezone: true, mode: "string" }),
    periodEndDate: timestamp("period_end_date", { withTimezone: true, mode: "string" }),
    metricKey: text("metric_key").notNull(),
    usGaapTag: text("us_gaap_tag"),
    unit: text("unit").notNull(),
    valueNumeric: doublePrecision("value_numeric").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    metricIdx: index("financial_facts_company_metric_year_idx").on(
      table.companyId,
      table.metricKey,
      table.periodType,
      table.fiscalYear,
    ),
  }),
);

export const researchSnapshots = pgTable(
  "research_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    sourceHash: text("source_hash").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>().notNull(),
    citationsJson: jsonb("citations_json").$type<Record<string, unknown>[]>().default([]).notNull(),
    caveatsJson: jsonb("caveats_json").$type<string[]>().default([]).notNull(),
  },
  (table) => ({
    companySourceIdx: uniqueIndex("research_snapshots_company_source_idx").on(
      table.companyId,
      table.sourceHash,
    ),
    companyGeneratedIdx: index("research_snapshots_company_generated_idx").on(
      table.companyId,
      table.generatedAt,
    ),
    expiresIdx: index("research_snapshots_expires_idx").on(table.expiresAt),
  }),
);

export const researchMemos = pgTable(
  "research_memos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => researchSnapshots.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    model: text("model").notNull(),
    promptHash: text("prompt_hash").notNull(),
    locale: text("locale").default("en").notNull(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    visibility: text("visibility").default("public").notNull(),
    sectionsJson: jsonb("sections_json").$type<Record<string, unknown>[]>().notNull(),
    disclaimer: text("disclaimer").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedByUserId: text("published_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    publicMemoCacheIdx: uniqueIndex("research_memos_public_cache_idx")
      .on(table.snapshotId, table.model, table.promptHash, table.locale)
      .where(sql`${table.visibility} = 'public'`),
    privateMemoCacheIdx: uniqueIndex("research_memos_private_cache_idx")
      .on(
        table.snapshotId,
        table.model,
        table.promptHash,
        table.locale,
        table.ownerUserId,
      )
      .where(sql`${table.visibility} = 'private' and ${table.ownerUserId} is not null`),
    ownerIdx: index("research_memos_owner_user_id_idx").on(table.ownerUserId),
    companyGeneratedIdx: index("research_memos_company_generated_idx").on(
      table.companyId,
      table.generatedAt,
    ),
  }),
);

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    snapshotId: uuid("snapshot_id").references(() => researchSnapshots.id, {
      onDelete: "set null",
    }),
    memoId: uuid("memo_id").references(() => researchMemos.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    requestId: text("request_id"),
    promptHash: text("prompt_hash").notNull(),
    locale: text("locale").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("ai_usage_events_user_created_idx").on(table.userId, table.createdAt),
    companyCreatedIdx: index("ai_usage_events_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    memoIdx: index("ai_usage_events_memo_id_idx").on(table.memoId),
  }),
);

export const researchRefreshRuns = pgTable(
  "research_refresh_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    secRequestCount: integer("sec_request_count").default(0).notNull(),
  },
  (table) => ({
    companyStartedIdx: index("research_refresh_runs_company_started_idx").on(
      table.companyId,
      table.startedAt,
    ),
  }),
);

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("watchlists_user_id_idx").on(table.userId),
    userNameIdx: uniqueIndex("watchlists_user_name_idx").on(table.userId, table.name),
  }),
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    notes: text("notes"),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueItemIdx: uniqueIndex("watchlist_items_watchlist_company_idx").on(
      table.watchlistId,
      table.companyId,
    ),
    watchlistIdx: index("watchlist_items_watchlist_id_idx").on(table.watchlistId),
  }),
);

export const savedResearch = pgTable(
  "saved_research",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => researchSnapshots.id, { onDelete: "cascade" }),
    memoId: uuid("memo_id").references(() => researchMemos.id, { onDelete: "set null" }),
    title: text("title"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("saved_research_user_created_idx").on(table.userId, table.createdAt),
    companyIdx: index("saved_research_company_id_idx").on(table.companyId),
  }),
);

export const alertPreferences = pgTable(
  "alert_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    alertType: text("alert_type").notNull(),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().default({}).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCompanyIdx: index("alert_preferences_user_company_idx").on(table.userId, table.companyId),
  }),
);

export const waitlistLeads = pgTable("waitlist_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  investorProfile: text("investor_profile").notNull(),
  interestArea: text("interest_area").notNull(),
  sourceTicker: text("source_ticker"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  watchlists: many(watchlists),
  savedResearch: many(savedResearch),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  tickers: many(companyTickers),
  filings: many(filings),
  periods: many(financialPeriods),
  snapshots: many(researchSnapshots),
}));

export const researchSnapshotsRelations = relations(researchSnapshots, ({ one, many }) => ({
  company: one(companies, {
    fields: [researchSnapshots.companyId],
    references: [companies.id],
  }),
  memos: many(researchMemos),
}));

export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  user: one(users, {
    fields: [watchlists.userId],
    references: [users.id],
  }),
  items: many(watchlistItems),
}));
