CREATE TABLE "tile_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"company_id" uuid,
	"ticker" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"tile_id" text NOT NULL,
	"tile_label" text NOT NULL,
	"page_path" text,
	"feedback" text NOT NULL,
	"screenshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tile_feedback_votes" (
	"feedback_id" uuid NOT NULL,
	"voter_key" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tile_feedback_votes_feedback_id_voter_key_pk" PRIMARY KEY("feedback_id","voter_key")
);
--> statement-breakpoint
ALTER TABLE "tile_feedback" ADD CONSTRAINT "tile_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_feedback" ADD CONSTRAINT "tile_feedback_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_feedback_votes" ADD CONSTRAINT "tile_feedback_votes_feedback_id_tile_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."tile_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_feedback_votes" ADD CONSTRAINT "tile_feedback_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tile_feedback_ticker_created_idx" ON "tile_feedback" USING btree ("ticker","created_at");--> statement-breakpoint
CREATE INDEX "tile_feedback_tile_created_idx" ON "tile_feedback" USING btree ("tile_id","created_at");--> statement-breakpoint
CREATE INDEX "tile_feedback_status_created_idx" ON "tile_feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tile_feedback_votes_user_id_idx" ON "tile_feedback_votes" USING btree ("user_id");