CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "alert_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cik" text NOT NULL,
	"legal_name" text NOT NULL,
	"sic" text,
	"sic_description" text,
	"fiscal_year_end" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_tickers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"exchange" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"accession_number" text NOT NULL,
	"form" text NOT NULL,
	"filing_date" timestamp with time zone,
	"report_date" timestamp with time zone,
	"primary_document_url" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"filing_id" uuid,
	"fiscal_year" integer NOT NULL,
	"period_end_date" timestamp with time zone,
	"metric_key" text NOT NULL,
	"us_gaap_tag" text,
	"unit" text NOT NULL,
	"value_numeric" double precision NOT NULL,
	"source_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_end_date" timestamp with time zone,
	"source_filing_id" uuid,
	"revenue" double precision,
	"gross_profit" double precision,
	"operating_income" double precision,
	"net_income" double precision,
	"assets" double precision,
	"liabilities" double precision,
	"equity" double precision,
	"cash" double precision,
	"debt" double precision,
	"operating_cash_flow" double precision,
	"capital_expenditure" double precision,
	"free_cash_flow" double precision,
	"eps_diluted" double precision,
	"shares_diluted" double precision,
	"caveats_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_memos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"sections_json" jsonb NOT NULL,
	"disclaimer" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_refresh_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"sec_request_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"citations_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"caveats_json" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_research" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"memo_id" uuid,
	"title" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"investor_profile" text,
	"experience_level" text,
	"preferences_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "waitlist_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"investor_profile" text NOT NULL,
	"interest_area" text NOT NULL,
	"source_ticker" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_leads_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"notes" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_tickers" ADD CONSTRAINT "company_tickers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filings" ADD CONSTRAINT "filings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_filing_id_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."filings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_source_filing_id_filings_id_fk" FOREIGN KEY ("source_filing_id") REFERENCES "public"."filings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_memos" ADD CONSTRAINT "research_memos_snapshot_id_research_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."research_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_memos" ADD CONSTRAINT "research_memos_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_refresh_runs" ADD CONSTRAINT "research_refresh_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_snapshots" ADD CONSTRAINT "research_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_research" ADD CONSTRAINT "saved_research_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_research" ADD CONSTRAINT "saved_research_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_research" ADD CONSTRAINT "saved_research_snapshot_id_research_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."research_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_research" ADD CONSTRAINT "saved_research_memo_id_research_memos_id_fk" FOREIGN KEY ("memo_id") REFERENCES "public"."research_memos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alert_preferences_user_company_idx" ON "alert_preferences" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_cik_idx" ON "companies" USING btree ("cik");--> statement-breakpoint
CREATE UNIQUE INDEX "company_tickers_active_ticker_idx" ON "company_tickers" USING btree ("ticker") WHERE "company_tickers"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "company_tickers_company_ticker_idx" ON "company_tickers" USING btree ("company_id","ticker");--> statement-breakpoint
CREATE INDEX "company_tickers_company_id_idx" ON "company_tickers" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "filings_accession_number_idx" ON "filings" USING btree ("accession_number");--> statement-breakpoint
CREATE INDEX "filings_company_filing_date_idx" ON "filings" USING btree ("company_id","filing_date");--> statement-breakpoint
CREATE INDEX "financial_facts_company_metric_year_idx" ON "financial_facts" USING btree ("company_id","metric_key","fiscal_year");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_periods_company_year_idx" ON "financial_periods" USING btree ("company_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "financial_periods_company_fiscal_year_idx" ON "financial_periods" USING btree ("company_id","fiscal_year");--> statement-breakpoint
CREATE UNIQUE INDEX "research_memos_snapshot_model_prompt_idx" ON "research_memos" USING btree ("snapshot_id","model","prompt_hash");--> statement-breakpoint
CREATE INDEX "research_memos_company_generated_idx" ON "research_memos" USING btree ("company_id","generated_at");--> statement-breakpoint
CREATE INDEX "research_refresh_runs_company_started_idx" ON "research_refresh_runs" USING btree ("company_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "research_snapshots_company_source_idx" ON "research_snapshots" USING btree ("company_id","source_hash");--> statement-breakpoint
CREATE INDEX "research_snapshots_company_generated_idx" ON "research_snapshots" USING btree ("company_id","generated_at");--> statement-breakpoint
CREATE INDEX "research_snapshots_expires_idx" ON "research_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "saved_research_user_created_idx" ON "saved_research" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_research_company_id_idx" ON "saved_research" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_items_watchlist_company_idx" ON "watchlist_items" USING btree ("watchlist_id","company_id");--> statement-breakpoint
CREATE INDEX "watchlist_items_watchlist_id_idx" ON "watchlist_items" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlists_user_id_idx" ON "watchlists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlists_user_name_idx" ON "watchlists" USING btree ("user_id","name");