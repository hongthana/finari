DROP INDEX "financial_periods_company_year_idx";--> statement-breakpoint
DROP INDEX "financial_facts_company_metric_year_idx";--> statement-breakpoint
DROP INDEX "financial_periods_company_fiscal_year_idx";--> statement-breakpoint
ALTER TABLE "financial_facts" ADD COLUMN "period_type" text DEFAULT 'annual' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_facts" ADD COLUMN "fiscal_period" text DEFAULT 'FY' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_facts" ADD COLUMN "period_start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "period_type" text DEFAULT 'annual' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "fiscal_period" text DEFAULT 'FY' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "period_start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "current_assets" double precision;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "current_liabilities" double precision;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "working_capital" double precision;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "research_and_development" double precision;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "selling_general_administrative" double precision;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "buybacks" double precision;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD COLUMN "dividends" double precision;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_periods_company_period_idx" ON "financial_periods" USING btree ("company_id","period_type","fiscal_year","fiscal_period");--> statement-breakpoint
CREATE INDEX "financial_facts_company_metric_year_idx" ON "financial_facts" USING btree ("company_id","metric_key","period_type","fiscal_year");--> statement-breakpoint
CREATE INDEX "financial_periods_company_fiscal_year_idx" ON "financial_periods" USING btree ("company_id","period_type","fiscal_year");