CREATE TABLE "company_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"source_type" text NOT NULL,
	"source_name" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"form" text,
	"source_fingerprint" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"curated_by_user_id" text,
	"curated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_impacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_event_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"owner_user_id" text,
	"analysis_mode" text NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"event_type" text NOT NULL,
	"drivers_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impact" text NOT NULL,
	"horizon" text NOT NULL,
	"watch_metric" text NOT NULL,
	"confidence" text NOT NULL,
	"impact_summary" text NOT NULL,
	"investor_meaning" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "event_impact_id" uuid;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_curated_by_user_id_users_id_fk" FOREIGN KEY ("curated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_impacts" ADD CONSTRAINT "event_impacts_company_event_id_company_events_id_fk" FOREIGN KEY ("company_event_id") REFERENCES "public"."company_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_impacts" ADD CONSTRAINT "event_impacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_impacts" ADD CONSTRAINT "event_impacts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_impacts" ADD CONSTRAINT "event_impacts_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_events_company_fingerprint_idx" ON "company_events" USING btree ("company_id","source_fingerprint");--> statement-breakpoint
CREATE INDEX "company_events_company_published_idx" ON "company_events" USING btree ("company_id","published_at");--> statement-breakpoint
CREATE INDEX "company_events_source_fingerprint_idx" ON "company_events" USING btree ("source_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "event_impacts_public_cache_idx" ON "event_impacts" USING btree ("company_event_id","locale","model","prompt_hash") WHERE "event_impacts"."visibility" = 'public';--> statement-breakpoint
CREATE UNIQUE INDEX "event_impacts_private_cache_idx" ON "event_impacts" USING btree ("company_event_id","locale","model","prompt_hash","owner_user_id") WHERE "event_impacts"."visibility" = 'private' and "event_impacts"."owner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "event_impacts_event_locale_idx" ON "event_impacts" USING btree ("company_event_id","locale");--> statement-breakpoint
CREATE INDEX "event_impacts_owner_user_id_idx" ON "event_impacts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "event_impacts_company_generated_idx" ON "event_impacts" USING btree ("company_id","generated_at");--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_event_impact_id_event_impacts_id_fk" FOREIGN KEY ("event_impact_id") REFERENCES "public"."event_impacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_events_event_impact_id_idx" ON "ai_usage_events" USING btree ("event_impact_id");