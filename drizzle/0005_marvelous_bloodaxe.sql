CREATE TABLE "user_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email_hash" text,
	"category" text NOT NULL,
	"event_name" text NOT NULL,
	"path" text,
	"method" text,
	"status" integer,
	"locale" text,
	"ticker" text,
	"duration_ms" integer,
	"ip_hash" text,
	"user_agent_hash" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_activity_events_user_created_idx" ON "user_activity_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_activity_events_event_created_idx" ON "user_activity_events" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX "user_activity_events_path_created_idx" ON "user_activity_events" USING btree ("path","created_at");--> statement-breakpoint
CREATE INDEX "user_activity_events_created_idx" ON "user_activity_events" USING btree ("created_at");