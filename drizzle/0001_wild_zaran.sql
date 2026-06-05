CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"company_id" uuid,
	"snapshot_id" uuid,
	"memo_id" uuid,
	"model" text NOT NULL,
	"request_id" text,
	"prompt_hash" text NOT NULL,
	"locale" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "research_memos_snapshot_model_prompt_idx";--> statement-breakpoint
ALTER TABLE "research_memos" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "research_memos" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "research_memos" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "research_memos" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "research_memos" ADD COLUMN "published_by_user_id" text;--> statement-breakpoint
UPDATE "research_memos" SET "published_at" = "generated_at" WHERE "published_at" IS NULL AND "visibility" = 'public';--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_snapshot_id_research_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."research_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_memo_id_research_memos_id_fk" FOREIGN KEY ("memo_id") REFERENCES "public"."research_memos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_events_user_created_idx" ON "ai_usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_company_created_idx" ON "ai_usage_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_memo_id_idx" ON "ai_usage_events" USING btree ("memo_id");--> statement-breakpoint
ALTER TABLE "research_memos" ADD CONSTRAINT "research_memos_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_memos" ADD CONSTRAINT "research_memos_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "research_memos_public_cache_idx" ON "research_memos" USING btree ("snapshot_id","model","prompt_hash","locale") WHERE "research_memos"."visibility" = 'public';--> statement-breakpoint
CREATE UNIQUE INDEX "research_memos_private_cache_idx" ON "research_memos" USING btree ("snapshot_id","model","prompt_hash","locale","owner_user_id") WHERE "research_memos"."visibility" = 'private' and "research_memos"."owner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "research_memos_owner_user_id_idx" ON "research_memos" USING btree ("owner_user_id");
